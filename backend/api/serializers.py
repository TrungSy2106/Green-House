from __future__ import annotations

from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Alert,
    ControlState,
    Device,
    DeviceCommand,
    DeviceState,
    SensorData,
)


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.get_username()
        return token


class DeviceStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceState
        fields = ['is_on', 'desired_on', 'last_command', 'last_value', 'extra', 'updated_at']


class DeviceSerializer(serializers.ModelSerializer):
    state = serializers.SerializerMethodField()
    zone = serializers.SerializerMethodField()
    zone_name = serializers.SerializerMethodField()
    uid = serializers.CharField(source='code', read_only=True)

    class Meta:
        model = Device
        fields = [
            'id',
            'zone',
            'zone_name',
            'name',
            'uid',
            'code',
            'device_type',
            'status',
            'is_enabled',
            'firmware_version',
            'last_seen_at',
            'metadata',
            'state',
        ]

    def get_state(self, obj):
        state, _ = DeviceState.objects.get_or_create(device=obj)
        return DeviceStateSerializer(state).data

    def get_zone(self, obj):
        return getattr(settings, 'APP_ZONE_ID', 1)

    def get_zone_name(self, obj):
        return getattr(settings, 'APP_ZONE_NAME', 'Nhà kính chính')


class SensorDataSerializer(serializers.ModelSerializer):
    zone = serializers.SerializerMethodField()
    zone_name = serializers.SerializerMethodField()

    class Meta:
        model = SensorData
        fields = [
            'id',
            'zone',
            'zone_name',
            'temperature',
            'humidity',
            'light',
            'soil_moisture',
            'payload',
            'recorded_at',
        ]

    def get_zone(self, obj):
        return getattr(settings, 'APP_ZONE_ID', 1)

    def get_zone_name(self, obj):
        return getattr(settings, 'APP_ZONE_NAME', 'Nhà kính chính')


class ControlStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ControlState
        fields = ['mode', 'manual_reason', 'manual_changed_at', 'updated_at']


class AlertSerializer(serializers.ModelSerializer):
    zone = serializers.SerializerMethodField()
    zone_name = serializers.SerializerMethodField()
    device_name = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = [
            'id',
            'zone',
            'zone_name',
            'device',
            'device_name',
            'level',
            'title',
            'message',
            'is_read',
            'happened_at',
        ]

    def get_zone(self, obj):
        return getattr(settings, 'APP_ZONE_ID', 1)

    def get_zone_name(self, obj):
        return getattr(settings, 'APP_ZONE_NAME', 'Nhà kính chính')

    def get_device_name(self, obj):
        return obj.device.name if obj.device else ''


class DeviceCommandSerializer(serializers.ModelSerializer):
    device_code = serializers.CharField(source='device.code', read_only=True)

    class Meta:
        model = DeviceCommand
        fields = [
            'id',
            'device',
            'device_code',
            'command',
            'value',
            'payload',
            'status',
            'created_at',
            'acked_at',
        ]