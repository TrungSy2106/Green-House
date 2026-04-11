import json
from datetime import datetime

from channels.generic.websocket import AsyncWebsocketConsumer

frontend_group = "frontend"
esp_group = "esp"

_runtime = {
    "latest": {
        "temperature": None,
        "humidity": None,
        "light": None,
        "soil_moisture": None,
        "updated_at": None,
    },
    "control": {
        "mode": "AUTO",
    },
    "devices": [
        {
            "id": 1,
            "code": "fan",
            "name": "Fan",
            "device_type": "fan",
            "is_on": False,
            "status": "online",
        },
        {
            "id": 2,
            "code": "pump",
            "name": "Pump",
            "device_type": "pump",
            "is_on": False,
            "status": "online",
        },
        {
            "id": 3,
            "code": "light",
            "name": "Light",
            "device_type": "light",
            "is_on": False,
            "status": "online",
        },
    ],
    "alerts": [],
    "history": [],
    "esp32_online": False,
    "updated_at": None,
}


def _num(value):
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _set_device(code, is_on):
    for device in _runtime["devices"]:
        if device["code"] == code:
            device["is_on"] = bool(is_on)
            device["status"] = "online"
            return


def _update_runtime_from_esp(data):
    now = datetime.utcnow().isoformat() + "Z"

    temperature = _num(data.get("temperature", data.get("temp")))
    humidity = _num(data.get("humidity", data.get("humi")))
    light = _num(data.get("light", data.get("light_level")))
    soil_moisture = _num(data.get("soil_moisture", data.get("soil")))

    if temperature is not None:
        _runtime["latest"]["temperature"] = temperature
    if humidity is not None:
        _runtime["latest"]["humidity"] = humidity
    if light is not None:
        _runtime["latest"]["light"] = light
    if soil_moisture is not None:
        _runtime["latest"]["soil_moisture"] = soil_moisture

    _runtime["latest"]["updated_at"] = now
    _runtime["updated_at"] = now
    _runtime["esp32_online"] = True

    mode = data.get("mode")
    if mode:
        _runtime["control"]["mode"] = mode

    if "fan" in data:
        _set_device("fan", data.get("fan"))

    if "pump" in data:
        _set_device("pump", data.get("pump"))

    light_state = data.get("light_state", data.get("light_on"))
    if light_state is not None:
        _set_device("light", light_state)

    _runtime["history"].append(
        {
            "temperature": _runtime["latest"]["temperature"],
            "humidity": _runtime["latest"]["humidity"],
            "light": _runtime["latest"]["light"],
            "soil_moisture": _runtime["latest"]["soil_moisture"],
            "updated_at": now,
        }
    )
    _runtime["history"] = _runtime["history"][-20:]


def _build_state_packet():
    return {
        "type": "state",
        "data": {
            "latest": _runtime["latest"],
            "control": _runtime["control"],
            "devices": _runtime["devices"],
            "alerts": _runtime["alerts"],
            "history": _runtime["history"],
            "esp32_online": _runtime["esp32_online"],
            "updated_at": _runtime["updated_at"],
        },
    }


class FrontendConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(frontend_group, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps(_build_state_packet()))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(frontend_group, self.channel_name)

    async def receive(self, text_data):
        print("FRONTEND RAW:", text_data)

    async def send_state(self, event):
        print("FRONTEND PUSH:", json.dumps(event["data"], ensure_ascii=False))
        await self.send(text_data=json.dumps(event["data"]))


class ESPConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(esp_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(esp_group, self.channel_name)

    async def receive(self, text_data):
        print("ESP RAW:", text_data)

        data = json.loads(text_data)
        _update_runtime_from_esp(data)

        packet = _build_state_packet()
        print("SEND TO FRONTEND:", json.dumps(packet, ensure_ascii=False))

        await self.channel_layer.group_send(
            frontend_group,
            {
                "type": "send_state",
                "data": packet,
            },
        )