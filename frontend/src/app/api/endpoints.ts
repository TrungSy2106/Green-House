import { apiClient } from "./client";

// ─── Auth ───────────────────────────────────────────────────────────────────
export interface LoginResponse {
  access: string;
  refresh: string;
}
export const authLogin = (username: string, password: string) =>
  apiClient.post<LoginResponse>("/auth/login/", { username, password });

// ─── Control ────────────────────────────────────────────────────────────────
export interface ControlState {
  mode: "AUTO" | "MANUAL";
  manual_reason: string;
  manual_changed_at: string | null;
  updated_at: string;
}
export const getControlState = () =>
  apiClient.get<ControlState>("/control/state/");
export const setControlMode = (mode: "AUTO" | "MANUAL", reason = "") =>
  apiClient.post<ControlState>("/control/mode/", { mode, reason });

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardOverview {
  latest: SensorReading | null;
  control: ControlState;
  device_count: number;
  online_devices: number;
  unread_alerts: number;
  uptime_hint: string;
  recent_alerts: AlertItem[];
  esp32_online: boolean;
}
export const getDashboardOverview = () =>
  apiClient.get<DashboardOverview>("/dashboard/overview/");

// ─── Sensor Readings ─────────────────────────────────────────────────────────
export interface SensorReading {
  id: number;
  temperature: number | null;
  humidity: number | null;
  light: number | null;
  soil_moisture: number | null;
  recorded_at: string;
}
export const getLatestReading = () =>
  apiClient.get<SensorReading>("/sensor-readings/latest/");

export type ChartMetric = "temperature" | "humidity" | "light" | "soil_moisture";
export interface ChartPoint {
  recorded_at: string;
  value: number;
}
export interface ChartResponse {
  metric: ChartMetric;
  points: ChartPoint[];
}
export const getChartData = (metric: ChartMetric, hours: number) =>
  apiClient.get<ChartResponse>(`/sensor-readings/chart/?metric=${metric}&hours=${hours}`);

// ─── Devices ─────────────────────────────────────────────────────────────────
export interface DeviceItem {
  id: number;
  name: string;
  code: string;
  uid?: string;
  device_type: "controller" | "fan" | "pump" | "light";
  status: "online" | "offline" | "error";
  is_enabled: boolean;
  state?: {
    is_on: boolean;
    desired_on: boolean;
    last_command: string;
    last_value: string;
  };
}
export const getDevices = () => apiClient.get<DeviceItem[]>("/devices/");
export const toggleDevice = (pk: number) =>
  apiClient.post<DeviceItem>(`/devices/${pk}/toggle/`);
export const sendDeviceCommand = (pk: number, command: string, value: string) =>
  apiClient.post(`/devices/${pk}/command/`, { command, value });

// ─── Alerts ──────────────────────────────────────────────────────────────────
export interface AlertItem {
  id: number;
  level: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  is_read: boolean;
  happened_at: string;
}
export const getAlerts = () => apiClient.get<AlertItem[]>("/alerts/");
export const markAlertRead = (pk: number) =>
  apiClient.post<AlertItem>(`/alerts/${pk}/mark_read/`);
export const markAllAlertsRead = () =>
  apiClient.post<{ updated: number }>("/alerts/mark_all_read/");

// ─── Rules ───────────────────────────────────────────────────────────────────
export interface RuleItem {
  id: number;
  metric: "temperature" | "humidity" | "light" | "soil_moisture";
  condition: "lte" | "gte";
  threshold: number;
  action_type: "alert_only" | "toggle_device" | "set_device";
  target_device: number | null;
  target_value: string;
  enabled: boolean;
  cooldown_seconds: number;
  message_template: string;
}
export const getRules = () => apiClient.get<RuleItem[]>("/rules/");
export const createRule = (data: Partial<RuleItem>) =>
  apiClient.post<RuleItem>("/rules/", data);
export const updateRule = (pk: number, data: Partial<RuleItem>) =>
  apiClient.patch<RuleItem>(`/rules/${pk}/`, data);