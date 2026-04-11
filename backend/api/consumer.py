import json
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone

from .models import Alert, ControlState, Device, SensorCurrent, SensorData
from .serializers import (
    AlertSerializer,
    ControlStateSerializer,
    DeviceSerializer,
    SensorCurrentSerializer,
    SensorDataSerializer,
)
from .services import (
    ack_device_command_payload,
    enqueue_device_command,
    get_controller,
    get_pending_commands,
    ingest_heartbeat_payload,
    ingest_sensor_payload,
    mark_device_offline,
)

frontend_group = "frontend"


def _control_state():
    control, _ = ControlState.objects.get_or_create(singleton_key="main")
    return control


def _dashboard_packet():
    current = SensorCurrent.objects.order_by("-recorded_at", "-id").first()
    history = list(SensorData.objects.order_by("-recorded_at", "-id")[:20])
    history.reverse()
    alerts = list(Alert.objects.order_by("-happened_at", "-id")[:20])
    control = _control_state()

    return {
        "type": "state",
        "data": {
            "latest": SensorCurrentSerializer(current).data if current else None,
            "control": ControlStateSerializer(control).data,
            "devices": DeviceSerializer(Device.objects.order_by("id"), many=True).data,
            "alerts": AlertSerializer(alerts, many=True).data,
            "history": SensorDataSerializer(history, many=True).data,
            "esp32_online": Device.objects.filter(
                device_type=Device.DeviceType.CONTROLLER,
                status=Device.DeviceStatus.ONLINE,
            ).exists(),
            "updated_at": timezone.now().isoformat(),
        },
    }


def _set_manual_mode(reason: str = ""):
    control = _control_state()
    control.mode = ControlState.Mode.MANUAL
    control.manual_reason = reason
    control.manual_changed_at = timezone.now()
    control.save(
        update_fields=["mode", "manual_reason", "manual_changed_at", "updated_at"]
    )


def _set_mode(mode: str):
    control = _control_state()
    mode = mode.upper().strip()

    if mode not in {ControlState.Mode.AUTO, ControlState.Mode.MANUAL}:
        raise ValueError("mode phải là AUTO hoặc MANUAL")

    control.mode = mode
    if mode == ControlState.Mode.AUTO:
        control.manual_reason = ""
        control.manual_changed_at = None
        control.save(
            update_fields=["mode", "manual_reason", "manual_changed_at", "updated_at"]
        )
    else:
        control.manual_changed_at = timezone.now()
        control.save(update_fields=["mode", "manual_changed_at", "updated_at"])


@database_sync_to_async
def auth_device(device_code: str, token: str | None):
    device = Device.objects.filter(code=device_code).first()
    if not device:
        device = get_controller(device_code=device_code)

    if token and device.api_token and device.api_token != token:
        return False
    return True


@database_sync_to_async
def build_state_packet():
    return _dashboard_packet()


@database_sync_to_async
def ingest_telemetry(data: dict, device_code: str):
    ingest_sensor_payload(data, device_code=device_code)


@database_sync_to_async
def ingest_heartbeat(data: dict, device_code: str):
    ingest_heartbeat_payload(data, device_code=device_code)


@database_sync_to_async
def ack_command(data: dict):
    ack_device_command_payload(data)


@database_sync_to_async
def pending_commands():
    return get_pending_commands()


@database_sync_to_async
def queue_manual_command(device_code: str, state: str):
    device = Device.objects.filter(code=device_code).first()
    if not device:
        device = Device.objects.filter(device_type=device_code).first()
    if not device:
        raise ValueError(f"Không tìm thấy device {device_code}")

    _set_manual_mode(reason=f"manual_ws:{device.code}")
    enqueue_device_command(device=device, command="set_power", value=state.lower())


@database_sync_to_async
def update_mode_only(mode: str):
    _set_mode(mode)


class FrontendConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(frontend_group, self.channel_name)
        await self.accept()

        packet = await build_state_packet()
        packet["type"] = "bootstrap"

        await self.send(text_data=json.dumps(packet, cls=DjangoJSONEncoder))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(frontend_group, self.channel_name)

    async def receive(self, text_data):
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(
                text_data=json.dumps({"type": "error", "reason": "invalid_json"})
            )
            return

        msg_type = payload.get("type")

        try:
            if msg_type == "mode":
                await update_mode_only(str(payload.get("value") or ""))

                packet = await build_state_packet()
                await self.channel_layer.group_send(
                    frontend_group,
                    {
                        "type": "send_state",
                        "packet": packet,
                    },
                )
                return

            if msg_type == "device_control":
                device = str(payload.get("device") or "").strip().lower()
                state = str(payload.get("state") or "").strip().lower()

                if device not in {"fan", "pump", "light"} or state not in {"on", "off"}:
                    raise ValueError("device_control không hợp lệ")

                await queue_manual_command(device, state)

                esp_group = "esp32.esp32-main"
                await self.channel_layer.group_send(
                    esp_group,
                    {
                        "type": "ws_message",
                        "event_type": "pending_commands",
                        "data": {
                            "commands": await pending_commands(),
                        },
                    },
                )

                packet = await build_state_packet()
                await self.channel_layer.group_send(
                    frontend_group,
                    {
                        "type": "send_state",
                        "packet": packet,
                    },
                )
                return

            if msg_type in {"alert_mark_read", "alert_mark_all_read"}:
                return

            await self.send(
                text_data=json.dumps({"type": "error", "reason": f"unsupported:{msg_type}"})
            )

        except Exception as exc:
            await self.send(text_data=json.dumps({"type": "error", "reason": str(exc)}))

    async def send_state(self, event):
        await self.send(
            text_data=json.dumps(event["packet"], cls=DjangoJSONEncoder)
        )


class ESPConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.device_code = (
            self.scope.get("url_route", {}).get("kwargs", {}).get("device_code")
            or "esp32-main"
        )

        raw_qs = (self.scope.get("query_string") or b"").decode()
        token = parse_qs(raw_qs).get("token", [None])[0]

        ok = await auth_device(self.device_code, token)
        if ok is False:
            await self.close(code=4003)
            return

        self.group_name = f"esp32.{self.device_code}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send_pending_commands()
        await self.push_state_to_frontend()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        await sync_to_async(mark_device_offline)(self.device_code)
        await self.push_state_to_frontend()

    async def receive(self, text_data):
        try:
            packet = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(
                text_data=json.dumps({"type": "error", "message": "invalid_json"})
            )
            return

        msg_type = packet.get("type")
        data = packet.get("data") or {}

        try:
            if msg_type == "telemetry":
                await ingest_telemetry(data, self.device_code)
                await self.send(text_data=json.dumps({"type": "telemetry_ack"}))
                await self.push_state_to_frontend()
                return

            if msg_type == "heartbeat":
                await ingest_heartbeat(data, self.device_code)
                await self.send(text_data=json.dumps({"type": "heartbeat_ack"}))
                await self.push_state_to_frontend()
                return

            if msg_type == "ack":
                await ack_command(data)
                await self.send(text_data=json.dumps({"type": "command_ack_result"}))
                await self.push_state_to_frontend()
                return

            if msg_type == "sync_commands":
                await self.send_pending_commands()
                return

            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": f"unsupported_type:{msg_type}"}
                )
            )

        except Exception as exc:
            await self.send(
                text_data=json.dumps({"type": "error", "message": str(exc)})
            )

    async def send_pending_commands(self):
        commands = await pending_commands()
        await self.send(
            text_data=json.dumps(
                {
                    "type": "pending_commands",
                    "data": {"commands": commands},
                }
            )
        )

    async def push_state_to_frontend(self):
        packet = await build_state_packet()
        await self.channel_layer.group_send(
            frontend_group,
            {
                "type": "send_state",
                "packet": packet,
            },
        )

    async def ws_message(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": event["event_type"],
                    "data": event["data"],
                }
            )
        )