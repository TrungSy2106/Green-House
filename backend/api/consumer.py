import json
from channels.generic.websocket import AsyncWebsocketConsumer

frontend_group = "frontend"
esp_group = "esp"


class FrontendConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(frontend_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(frontend_group, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        # gửi lệnh sang ESP
        await self.channel_layer.group_send(
            esp_group,
            {
                "type": "esp.command",
                "message": data
            }
        )

    async def send_state(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class ESPConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(esp_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(esp_group, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        # broadcast cho frontend
        await self.channel_layer.group_send(
            frontend_group,
            {
                "type": "send_state",
                "data": {
                    "type": "state",
                    "data": data
                }
            }
        )

    async def esp_command(self, event):
        await self.send(text_data=json.dumps(event["message"]))