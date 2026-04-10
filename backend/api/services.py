from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import Alert, Device, DeviceCommand, DeviceState, SensorCurrent, SensorData, ThresholdRule
from .serializers import DeviceCommandSerializer


HEARTBEAT_TIMEOUT_SECONDS = 15
HEARTBEAT_SLOW_SECONDS = 30

METRIC_FIELD_MAP = {
    'temperature': 'temperature',
    'humidity': 'humidity',
    'light': 'light',
    'soil_moisture': 'soil_moisture',
}


def get_metric_value(sensor_data: SensorData, metric: str):
    field_name = METRIC_FIELD_MAP.get(metric)
    return getattr(sensor_data, field_name, None) if field_name else None


def get_controller(device_code: str = 'esp32-main') -> Device:
    controller, _ = Device.objects.get_or_create(
        code=device_code,
        defaults={
            'name': 'ESP32 Main',
            'device_type': Device.DeviceType.CONTROLLER,
            'status': Device.DeviceStatus.OFFLINE,
        },
    )
    return controller


def sync_device_online(device: Device, firmware_version: str | None = None, metadata: dict | None = None):
    previous_status = device.status
    now = timezone.now()

    device.status = Device.DeviceStatus.ONLINE
    device.last_seen_at = now

    update_fields = ['status', 'last_seen_at', 'updated_at']

    if firmware_version:
        device.firmware_version = firmware_version
        update_fields.append('firmware_version')

    if metadata:
        device.metadata = {**device.metadata, **metadata}
        update_fields.append('metadata')

    device.save(update_fields=update_fields)

    if previous_status != Device.DeviceStatus.ONLINE:
        Alert.objects.create(
            level=Alert.Level.SUCCESS,
            title=f'{device.name} online',
            message=f'{device.name} đã kết nối lại hệ thống.',
            device=device,
        )


def mark_device_offline(device_code: str = 'esp32-main'):
    device = Device.objects.filter(code=device_code).first()
    if not device:
        return

    if device.status != Device.DeviceStatus.OFFLINE:
        device.status = Device.DeviceStatus.OFFLINE
        device.save(update_fields=['status', 'updated_at'])
        Alert.objects.create(
            level=Alert.Level.ERROR,
            title=f'{device.name} mất kết nối',
            message=f'Kết nối WebSocket từ {device.name} đã ngắt.',
            device=device,
        )


def refresh_device_statuses(now=None):
    now = now or timezone.now()
    timeout = timedelta(seconds=HEARTBEAT_TIMEOUT_SECONDS)

    for device in Device.objects.all():
        previous_status = device.status

        if not device.last_seen_at:
            new_status = Device.DeviceStatus.OFFLINE
        elif now - device.last_seen_at > timeout:
            new_status = Device.DeviceStatus.OFFLINE
        else:
            new_status = Device.DeviceStatus.ONLINE

        if new_status == previous_status:
            continue

        device.status = new_status
        device.save(update_fields=['status', 'updated_at'])

        if previous_status == Device.DeviceStatus.ONLINE and new_status == Device.DeviceStatus.OFFLINE:
            Alert.objects.create(
                level=Alert.Level.ERROR,
                title=f'{device.name} mất kết nối',
                message=f'Không nhận heartbeat từ {device.name} trong hơn {HEARTBEAT_TIMEOUT_SECONDS} giây.',
                device=device,
            )
        elif previous_status != Device.DeviceStatus.ONLINE and new_status == Device.DeviceStatus.ONLINE:
            Alert.objects.create(
                level=Alert.Level.SUCCESS,
                title=f'{device.name} online',
                message=f'{device.name} đã kết nối lại hệ thống.',
                device=device,
            )


def evaluate_rules(sensor_data: SensorData):
    now = timezone.now()

    for rule in ThresholdRule.objects.filter(enabled=True).select_related('target_device'):
        value = get_metric_value(sensor_data, rule.metric)
        if value is None:
            continue

        breached = False
        if rule.condition == ThresholdRule.Condition.LTE:
            breached = Decimal(value) <= rule.threshold
        elif rule.condition == ThresholdRule.Condition.GTE:
            breached = Decimal(value) >= rule.threshold

        if not breached:
            continue

        if rule.last_triggered_at and (now - rule.last_triggered_at).total_seconds() < rule.cooldown_seconds:
            continue

        title = f'Ngưỡng {rule.metric} bị vượt'
        message = rule.message_template or f'{rule.metric}={value} đã chạm ngưỡng {rule.condition} {rule.threshold}'

        Alert.objects.create(
            level=Alert.Level.WARNING,
            title=title,
            message=message,
            source_rule=rule,
            sensor_data=sensor_data,
            device=rule.target_device,
        )

        if rule.action_type in {ThresholdRule.ActionType.TOGGLE_DEVICE, ThresholdRule.ActionType.SET_DEVICE} and rule.target_device:
            desired_on = str(rule.target_value).lower() in {'1', 'on', 'true', 'yes'}
            state, _ = DeviceState.objects.get_or_create(device=rule.target_device)
            state.desired_on = desired_on
            state.last_command = 'auto_rule'
            state.last_value = 'on' if desired_on else 'off'
            state.save(update_fields=['desired_on', 'last_command', 'last_value', 'updated_at'])

            enqueue_device_command(
                device=rule.target_device,
                command='set_power',
                value='on' if desired_on else 'off',
                payload={'rule_id': rule.id, 'metric': rule.metric},
            )

        rule.last_triggered_at = now
        rule.save(update_fields=['last_triggered_at', 'updated_at'])


def build_uptime_hint() -> str:
    refresh_device_statuses()

    controller = Device.objects.filter(device_type=Device.DeviceType.CONTROLLER).first()
    if not controller or not controller.last_seen_at:
        return 'Chưa có heartbeat từ ESP32'

    delta = timezone.now() - controller.last_seen_at

    if delta <= timedelta(seconds=HEARTBEAT_TIMEOUT_SECONDS):
        return 'ESP32 đang online'
    if delta <= timedelta(seconds=HEARTBEAT_SLOW_SECONDS):
        return 'ESP32 phản hồi chậm'
    return 'ESP32 đang mất kết nối'


def _to_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in {'1', 'true', 'on', 'yes'}


def _push_ws_message(device_code: str, event_type: str, data: dict):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        f'esp32.{device_code}',
        {
            'type': 'ws_message',
            'event_type': event_type,
            'data': data,
        },
    )


def get_pending_commands(limit: int = 5):
    commands = (
        DeviceCommand.objects
        .filter(status=DeviceCommand.CommandStatus.PENDING)
        .select_related('device')
        .order_by('-updated_at', '-id')[:limit]
    )
    return DeviceCommandSerializer(list(reversed(commands)), many=True).data


def notify_pending_commands(device_code: str = 'esp32-main'):
    _push_ws_message(
        device_code=device_code,
        event_type='pending_commands',
        data={'commands': get_pending_commands()},
    )


def ingest_sensor_payload(payload: dict, device_code: str = 'esp32-main'):
    recorded_raw = payload.get('recorded_at')
    recorded_at = parse_datetime(recorded_raw) if isinstance(recorded_raw, str) else recorded_raw
    recorded_at = recorded_at or timezone.now()

    reading = SensorData.objects.create(
        temperature=payload.get('temperature'),
        humidity=payload.get('humidity'),
        light=payload.get('light'),
        soil_moisture=payload.get('soil_moisture'),
        payload=payload.get('payload') or {},
        recorded_at=recorded_at,
    )

    SensorCurrent.objects.update_or_create(
        singleton_key='main',
        defaults={
            'temperature': reading.temperature,
            'humidity': reading.humidity,
            'light': reading.light,
            'soil_moisture': reading.soil_moisture,
            'payload': reading.payload,
            'recorded_at': reading.recorded_at,
            'source_reading': reading,
        },
    )

    controller = get_controller(device_code=device_code)
    metadata = payload.get('metadata') or {}
    metadata = {**metadata, 'transport': 'websocket'}
    sync_device_online(
        controller,
        firmware_version=payload.get('firmware_version'),
        metadata=metadata,
    )

    states = payload.get('device_states') or {}
    state_map = {'fan_on': 'fan', 'pump_on': 'pump', 'light_on': 'light'}

    for field_name, device_type in state_map.items():
        if field_name not in states:
            continue

        device = Device.objects.filter(device_type=device_type).first()
        if not device:
            continue

        sync_device_online(device)

        current_value = _to_bool(states[field_name])

        state, _ = DeviceState.objects.get_or_create(device=device)
        state.is_on = current_value
        state.desired_on = current_value
        state.last_command = 'telemetry_sync'
        state.last_value = 'on' if current_value else 'off'
        state.save(update_fields=['is_on', 'desired_on', 'last_command', 'last_value', 'updated_at'])

    evaluate_rules(reading)
    notify_pending_commands(device_code=device_code)
    return reading


def ingest_heartbeat_payload(payload: dict, device_code: str = 'esp32-main'):
    controller = get_controller(device_code=device_code)
    metadata = payload.get('metadata') or {}
    metadata = {**metadata, 'transport': 'websocket'}
    sync_device_online(
        controller,
        firmware_version=payload.get('firmware_version'),
        metadata=metadata,
    )
    return controller


def ack_device_command_payload(payload: dict):
    command_id = payload.get('command_id')
    if not command_id:
        raise ValueError('Thiếu command_id')

    cmd = DeviceCommand.objects.select_related('device').filter(pk=command_id).first()
    if not cmd:
        raise ValueError('Command không tồn tại')

    cmd.status = payload.get('status') or DeviceCommand.CommandStatus.ACK
    cmd.acked_at = timezone.now()
    cmd.save(update_fields=['status', 'acked_at', 'updated_at'])

    state, _ = DeviceState.objects.get_or_create(device=cmd.device)

    if 'actual_state' in payload:
        actual_state = _to_bool(payload.get('actual_state'))
        state.is_on = actual_state
        state.desired_on = actual_state
    elif cmd.value.lower() in {'on', 'off'}:
        state.is_on = cmd.value.lower() == 'on'
        state.desired_on = state.is_on

    state.last_command = cmd.command
    state.last_value = cmd.value
    state.save(update_fields=['is_on', 'desired_on', 'last_command', 'last_value', 'updated_at'])

    sync_device_online(cmd.device)
    return cmd

def enqueue_device_command(*, device: Device, command: str, value: str = '', payload: dict | None = None):
    """Chỉ giữ lệnh pending mới nhất cho mỗi cặp device + command."""
    payload = payload or {}

    pending = (
        DeviceCommand.objects
        .filter(
            device=device,
            command=command,
            status=DeviceCommand.CommandStatus.PENDING,
        )
        .order_by('-created_at', '-id')
        .first()
    )

    if pending:
        pending.value = value
        pending.payload = payload
        pending.save(update_fields=['value', 'payload', 'updated_at'])

        DeviceCommand.objects.filter(
            device=device,
            command=command,
            status=DeviceCommand.CommandStatus.PENDING,
        ).exclude(pk=pending.pk).update(
            status=DeviceCommand.CommandStatus.FAILED,
            payload={'reason': 'obsolete_replaced_by_newer_command'},
            updated_at=timezone.now(),
        )
        return pending

    return DeviceCommand.objects.create(
        device=device,
        command=command,
        value=value,
        payload=payload,
    )