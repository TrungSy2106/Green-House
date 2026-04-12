from __future__ import annotations

import secrets
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Device(TimeStampedModel):
    class DeviceType(models.TextChoices):
        CONTROLLER = 'controller', 'Controller'
        FAN = 'fan', 'Fan'
        PUMP = 'pump', 'Pump'
        LIGHT = 'light', 'Light'

    class DeviceStatus(models.TextChoices):
        ONLINE = 'online', 'Online'
        OFFLINE = 'offline', 'Offline'
        ERROR = 'error', 'Error'

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True)
    device_type = models.CharField(max_length=20, choices=DeviceType.choices)
    status = models.CharField(
        max_length=20,
        choices=DeviceStatus.choices,
        default=DeviceStatus.OFFLINE,
    )
    is_enabled = models.BooleanField(default=True)
    firmware_version = models.CharField(max_length=50, blank=True)
    api_token = models.CharField(max_length=64, unique=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['id']

    def save(self, *args, **kwargs):
        if not self.api_token:
            self.api_token = secrets.token_hex(24)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.code})'


class DeviceState(TimeStampedModel):
    device = models.OneToOneField(Device, on_delete=models.CASCADE, related_name='state')
    is_on = models.BooleanField(default=False)
    desired_on = models.BooleanField(default=False)
    last_command = models.CharField(max_length=50, blank=True)
    last_value = models.CharField(max_length=50, blank=True)
    extra = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f'{self.device.code} state'


class SensorData(TimeStampedModel):
    temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    humidity = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    light = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    soil_moisture = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    recorded_at = models.DateTimeField(default=timezone.now, db_index=True)
    received_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-recorded_at', '-id']
        indexes = [
            models.Index(fields=['recorded_at'], name='sensor_recorded_idx'),
        ]

    def __str__(self):
        return f'Reading #{self.pk} @ {self.recorded_at.isoformat()}'


class ControlState(TimeStampedModel):
    class Mode(models.TextChoices):
        AUTO = 'AUTO', 'AUTO'
        MANUAL = 'MANUAL', 'MANUAL'

    singleton_key = models.CharField(max_length=20, unique=True, default='main')
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.MANUAL)
    manual_reason = models.CharField(max_length=255, blank=True)
    manual_changed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Control state'
        verbose_name_plural = 'Control state'

    def __str__(self):
        return f'Control<{self.mode}>'


class Alert(TimeStampedModel):
    class Level(models.TextChoices):
        INFO = 'info', 'Info'
        WARNING = 'warning', 'Warning'
        ERROR = 'error', 'Error'
        SUCCESS = 'success', 'Success'

    level = models.CharField(max_length=20, choices=Level.choices, default=Level.WARNING)
    title = models.CharField(max_length=100)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    happened_at = models.DateTimeField(default=timezone.now, db_index=True)
    sensor_data = models.ForeignKey(
        SensorData,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='alerts',
    )
    device = models.ForeignKey(
        Device,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='alerts',
    )

    class Meta:
        ordering = ['-happened_at', '-id']

    def __str__(self):
        return f'[{self.level}] {self.title}'


class DeviceCommand(TimeStampedModel):
    class CommandStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACK = 'ack', 'Acknowledged'
        FAILED = 'failed', 'Failed'

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='commands')
    command = models.CharField(max_length=50)
    value = models.CharField(max_length=50, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20,
        choices=CommandStatus.choices,
        default=CommandStatus.PENDING,
    )
    acked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['status', '-created_at', '-id']
        indexes = [
            models.Index(fields=['status', 'created_at'], name='cmd_status_created_idx'),
        ]

    def __str__(self):
        return f'{self.device.code}:{self.command}:{self.status}'