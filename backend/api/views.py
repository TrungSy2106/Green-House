from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    Alert,
    ControlState,
    Device,
    DeviceCommand,
    DeviceState,
    SensorCurrent,
    SensorData,
    ThresholdRule,
)
from .serializers import (
    AlertSerializer,
    ControlStateSerializer,
    DeviceCommandSerializer,
    DeviceSerializer,
    LoginSerializer,
    SensorCurrentSerializer,
    ThresholdRuleSerializer,
)
from .services import build_uptime_hint, enqueue_device_command, notify_pending_commands, refresh_device_statuses

def _check_ingest_token(request):
    header = request.headers.get('X-Device-Token') or ''
    auth = request.headers.get('Authorization') or ''
    bearer = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else ''

    if header == settings.INGEST_DEVICE_TOKEN or bearer == settings.INGEST_DEVICE_TOKEN:
        return True

    raise PermissionDenied('Sai X-Device-Token cho ESP32')


def _to_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in {'1', 'true', 'on', 'yes'}


def _get_control_state():
    control, _ = ControlState.objects.get_or_create(singleton_key='main')
    return control


def _turn_off_all_actuators():
    actuators = Device.objects.exclude(device_type=Device.DeviceType.CONTROLLER)

    for device in actuators:
        state, _ = DeviceState.objects.get_or_create(device=device)
        state.desired_on = False
        state.last_command = 'set_power'
        state.last_value = 'off'
        state.save(update_fields=['desired_on', 'last_command', 'last_value', 'updated_at'])

        DeviceCommand.objects.create(
            device=device,
            command='set_power',
            value='off',
            payload={'source': 'auto_mode_enable'},
        )

    notify_pending_commands()


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer


class DashboardOverviewView(APIView):
    def get(self, request):
        refresh_device_statuses()

        current = SensorCurrent.objects.order_by('-recorded_at', '-id').first()
        recent_alerts = Alert.objects.order_by('-happened_at', '-id')[:5]
        control = _get_control_state()

        payload = {
            'latest': SensorCurrentSerializer(current).data if current else None,
            'control': ControlStateSerializer(control).data,
            'device_count': Device.objects.exclude(device_type=Device.DeviceType.CONTROLLER).count(),
            'online_devices': Device.objects.exclude(device_type=Device.DeviceType.CONTROLLER).filter(
                status=Device.DeviceStatus.ONLINE
            ).count(),
            'unread_alerts': Alert.objects.filter(is_read=False).count(),
            'uptime_hint': build_uptime_hint(),
            'recent_alerts': AlertSerializer(recent_alerts, many=True).data,
            'esp32_online': Device.objects.filter(
                device_type=Device.DeviceType.CONTROLLER,
                status=Device.DeviceStatus.ONLINE,
            ).exists(),
        }
        return Response(payload)


class LatestReadingView(APIView):
    def get(self, request):
        esp32_online = Device.objects.filter(
            device_type=Device.DeviceType.CONTROLLER,
            status=Device.DeviceStatus.ONLINE,
        ).exists()
        if not esp32_online:
            return Response(None)

        current = SensorCurrent.objects.order_by('-recorded_at', '-id').first()
        if not current:
            return Response(None)
        return Response(SensorCurrentSerializer(current).data)


class ChartView(APIView):
    def get(self, request):
        metric = request.query_params.get('metric')
        hours = int(request.query_params.get('hours', '24'))

        if metric not in {'temperature', 'humidity', 'light', 'soil_moisture'}:
            raise ValidationError('metric không hợp lệ')

        since = timezone.now() - timedelta(hours=hours)
        points = []

        for item in SensorData.objects.filter(recorded_at__gte=since).order_by('recorded_at', 'id'):
            value = getattr(item, metric, None)
            points.append({'recorded_at': item.recorded_at, 'value': value})

        return Response({'metric': metric, 'points': points})


class ControlStateView(APIView):
    def get(self, request):
        control = _get_control_state()
        return Response(ControlStateSerializer(control).data)


class ControlModeView(APIView):
    def post(self, request):
        mode = str(request.data.get('mode') or '').upper().strip()
        if mode not in {'AUTO', 'MANUAL'}:
            raise ValidationError('mode phải là AUTO hoặc MANUAL')

        control = _get_control_state()
        control.mode = mode
        control.manual_reason = str(request.data.get('reason') or '').strip()

        if mode == ControlState.Mode.AUTO:
            control.manual_changed_at = None
            control.save(update_fields=['mode', 'manual_reason', 'manual_changed_at', 'updated_at'])
            _turn_off_all_actuators()
        else:
            control.manual_changed_at = timezone.now()
            control.save(update_fields=['mode', 'manual_reason', 'manual_changed_at', 'updated_at'])

        return Response(ControlStateSerializer(control).data)


class DeviceListView(generics.ListAPIView):
    serializer_class = DeviceSerializer

    def get_queryset(self):
        refresh_device_statuses()
        return Device.objects.order_by('id')


class DeviceToggleView(APIView):
    def post(self, request, pk: int):
        device = generics.get_object_or_404(Device, pk=pk)

        if device.device_type == Device.DeviceType.CONTROLLER:
            raise ValidationError('ESP32 Main là bộ điều khiển trung tâm, không hỗ trợ bật/tắt kiểu actuator.')

        control = _get_control_state()
        control.mode = ControlState.Mode.MANUAL
        control.manual_reason = f'manual_toggle:{device.code}'
        control.manual_changed_at = timezone.now()
        control.save(update_fields=['mode', 'manual_reason', 'manual_changed_at', 'updated_at'])

        state, _ = DeviceState.objects.get_or_create(device=device)
        state.is_on = not state.is_on
        state.desired_on = state.is_on
        state.last_command = 'toggle'
        state.last_value = 'on' if state.is_on else 'off'
        state.save(update_fields=['is_on', 'desired_on', 'last_command', 'last_value', 'updated_at'])

        enqueue_device_command(device=device, command='set_power', value=state.last_value)
        notify_pending_commands()
        return Response(DeviceSerializer(device).data)


class DeviceCommandView(APIView):
    def post(self, request, pk: int):
        device = generics.get_object_or_404(Device, pk=pk)
        command = (request.data.get('command') or '').strip()
        payload = request.data.get('payload') or {}
        value = str(request.data.get('value') or '')

        if not command:
            raise ValidationError('Thiếu command')

        if device.device_type == Device.DeviceType.CONTROLLER:
            raise ValidationError('Không gửi command actuator tới controller trung tâm.')

        control = _get_control_state()
        control.mode = ControlState.Mode.MANUAL
        control.manual_reason = f'manual_command:{device.code}:{command}'
        control.manual_changed_at = timezone.now()
        control.save(update_fields=['mode', 'manual_reason', 'manual_changed_at', 'updated_at'])

        cmd = enqueue_device_command(
            device=device,
            command=command,
            value=value,
            payload=payload,
        )

        state, _ = DeviceState.objects.get_or_create(device=device)
        state.last_command = command

        if value:
            state.last_value = value
            if value.lower() in {'on', 'off'}:
                state.desired_on = value.lower() == 'on'

        state.save(update_fields=['last_command', 'last_value', 'desired_on', 'updated_at'])
        notify_pending_commands()
        return Response(DeviceCommandSerializer(cmd).data, status=status.HTTP_201_CREATED)


class AlertListView(generics.ListAPIView):
    serializer_class = AlertSerializer

    def get_queryset(self):
        refresh_device_statuses()
        return Alert.objects.order_by('-happened_at', '-id')


class AlertMarkReadView(APIView):
    def post(self, request, pk: int):
        alert = generics.get_object_or_404(Alert, pk=pk)
        alert.is_read = True
        alert.save(update_fields=['is_read', 'updated_at'])
        return Response(AlertSerializer(alert).data)


class AlertMarkAllReadView(APIView):
    def post(self, request):
        updated = Alert.objects.filter(is_read=False).update(is_read=True, updated_at=timezone.now())
        return Response({'updated': updated})


class RuleListView(generics.ListCreateAPIView):
    queryset = ThresholdRule.objects.select_related('target_device').order_by('metric', 'condition', 'id')
    serializer_class = ThresholdRuleSerializer


class RuleDetailView(generics.RetrieveUpdateAPIView):
    queryset = ThresholdRule.objects.select_related('target_device').all()
    serializer_class = ThresholdRuleSerializer


class IngestReadingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        _check_ingest_token(request)

        recorded_raw = request.data.get('recorded_at')
        recorded_at = parse_datetime(recorded_raw) if isinstance(recorded_raw, str) else recorded_raw
        recorded_at = recorded_at or timezone.now()

        reading = SensorData.objects.create(
            temperature=request.data.get('temperature'),
            humidity=request.data.get('humidity'),
            light=request.data.get('light'),
            soil_moisture=request.data.get('soil_moisture'),
            payload=request.data.get('payload') or {},
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

        controller, _ = Device.objects.get_or_create(
            code='esp32-main',
            defaults={
                'name': 'ESP32 Main',
                'device_type': Device.DeviceType.CONTROLLER,
                'status': Device.DeviceStatus.OFFLINE,
            },
        )
        controller.status = Device.DeviceStatus.ONLINE
        controller.last_seen_at = timezone.now()
        firmware = request.data.get('firmware_version')
        if firmware:
            controller.firmware_version = firmware
            controller.save(update_fields=['status', 'last_seen_at', 'firmware_version', 'updated_at'])
        else:
            controller.save(update_fields=['status', 'last_seen_at', 'updated_at'])

        states = request.data.get('device_states') or {}
        state_map = {'fan_on': 'fan', 'pump_on': 'pump', 'light_on': 'light'}

        for field_name, device_type in state_map.items():
            if field_name not in states:
                continue

            device = Device.objects.filter(device_type=device_type).first()
            if not device:
                continue

            device.status = Device.DeviceStatus.ONLINE
            device.last_seen_at = timezone.now()
            device.save(update_fields=['status', 'last_seen_at', 'updated_at'])

            current_value = _to_bool(states[field_name])

            state, _ = DeviceState.objects.get_or_create(device=device)
            state.is_on = current_value
            state.desired_on = current_value
            state.last_command = 'telemetry_sync'
            state.last_value = 'on' if current_value else 'off'
            state.save(update_fields=['is_on', 'desired_on', 'last_command', 'last_value', 'updated_at'])

        return Response({'id': reading.id, 'message': 'Đã nhận dữ liệu cảm biến'})


class IngestHeartbeatView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        _check_ingest_token(request)

        controller, _ = Device.objects.get_or_create(
            code='esp32-main',
            defaults={
                'name': 'ESP32 Main',
                'device_type': Device.DeviceType.CONTROLLER,
                'status': Device.DeviceStatus.OFFLINE,
            },
        )

        controller.status = Device.DeviceStatus.ONLINE
        controller.last_seen_at = timezone.now()
        firmware = request.data.get('firmware_version')
        if firmware:
            controller.firmware_version = firmware
        controller.metadata = {**controller.metadata, **(request.data.get('metadata') or {})}

        update_fields = ['status', 'last_seen_at', 'metadata', 'updated_at']
        if firmware:
            update_fields.append('firmware_version')

        controller.save(update_fields=update_fields)
        return Response({'message': 'heartbeat ok'})


class IngestPendingCommandsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        _check_ingest_token(request)

        commands = (
            DeviceCommand.objects
            .filter(status=DeviceCommand.CommandStatus.PENDING)
            .select_related('device')
            .order_by('created_at', 'id')[:5]
        )

        return Response(DeviceCommandSerializer(commands, many=True).data)


class IngestCommandAckView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk: int):
        _check_ingest_token(request)

        cmd = generics.get_object_or_404(DeviceCommand, pk=pk)
        cmd.status = request.data.get('status') or DeviceCommand.CommandStatus.ACK
        cmd.acked_at = timezone.now()
        cmd.save(update_fields=['status', 'acked_at', 'updated_at'])

        state, _ = DeviceState.objects.get_or_create(device=cmd.device)

        if 'actual_state' in request.data:
            actual_state = _to_bool(request.data.get('actual_state'))
            state.is_on = actual_state
            state.desired_on = actual_state
        elif cmd.value.lower() in {'on', 'off'}:
            state.is_on = cmd.value.lower() == 'on'
            state.desired_on = state.is_on

        state.last_command = cmd.command
        state.last_value = cmd.value
        state.save(update_fields=['is_on', 'desired_on', 'last_command', 'last_value', 'updated_at'])

        cmd.device.status = Device.DeviceStatus.ONLINE
        cmd.device.last_seen_at = timezone.now()
        cmd.device.save(update_fields=['status', 'last_seen_at', 'updated_at'])

        return Response({'message': 'ack ok'})