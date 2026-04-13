export type SensorReading = {
  id: number;
  temperature: number | null;
  humidity: number | null;
  light: number | null;
  soil_moisture: number | null;
  recorded_at: string;
};

export type SensorErrors = {
  dht: boolean;
  soil: boolean;
  light: boolean;
  gas: boolean;
};

export type ControlState = {
  mode: "AUTO" | "MANUAL";
  manual_reason: string;
  manual_changed_at: string | null;
  updated_at: string;
};

export type DeviceItem = {
  id: number;
  name: string;
  code: string;
  device_type: "fan" | "pump" | "light" | "controller";
  status: "online" | "offline";
  state: {
    is_on: boolean;
    updated_at?: string;
  } | null;
};

export type AlertItem = {
  id: number;
  title: string;
  message: string;
  level: "info" | "warning" | "error" | "success";
  is_read: boolean;
  happened_at: string;
};

export type GreenhouseStatePacket = {
  latest: SensorReading | null;
  control: ControlState;
  devices: DeviceItem[];
  alerts: AlertItem[];
  history: SensorReading[];
  sensor_errors: SensorErrors;
  esp32_online: boolean;
  updated_at: string | null;
};

export type GreenhouseMessage =
  | { type: "bootstrap"; data: GreenhouseStatePacket }
  | { type: "state"; data: GreenhouseStatePacket }
  | { type: "sensor_update"; data: SensorReading }
  | { type: "device_state"; data: { device: "fan" | "pump" | "light"; is_on: boolean } }
  | { type: "alert_created"; data: AlertItem }
  | { type: "command_result"; data: unknown }
  | { type: "error"; data?: unknown; reason?: string };

type ListenerMap = {
  open: () => void;
  close: () => void;
  error: () => void;
  message: (message: GreenhouseMessage) => void;
};

type Listener<T> = T extends (...args: infer A) => void ? (...args: A) => void : never;

export class GreenhouseWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private manuallyClosed = false;
  private readonly url: string;
  private readonly reconnectDelay: number;

  private listeners: {
    [K in keyof ListenerMap]: Set<Listener<ListenerMap[K]>>;
  } = {
    open: new Set(),
    close: new Set(),
    error: new Set(),
    message: new Set(),
  };

  constructor(url: string, reconnectDelay = 1500) {
    this.url = url;
    this.reconnectDelay = reconnectDelay;
  }

  connect() {
    this.manuallyClosed = false;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.emit("open");
    };

    ws.onclose = () => {
      this.emit("close");
      this.ws = null;

      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      this.emit("error");
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as GreenhouseMessage;
        console.log("Message:", parsed);
        if (parsed && typeof parsed === "object" && "type" in parsed) {
          this.emit("message", parsed);
        }
      } catch {
        // .
      }
    };
  }

  disconnect() {
    this.manuallyClosed = true;

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.ws?.close();
    this.ws = null;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  on<K extends keyof ListenerMap>(event: K, listener: Listener<ListenerMap[K]>) {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  sendRaw(payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  sendMode(mode: "AUTO" | "MANUAL") {
    return this.sendRaw({ type: "mode", value: mode });
  }

  sendDeviceControl(device: "fan" | "pump" | "light", state: "ON" | "OFF") {
    return this.sendRaw({ type: "device_control", device, state });
  }

  markAlertRead(id: number) {
    return this.sendRaw({ type: "alert_mark_read", id });
  }

  markAllAlertsRead() {
    return this.sendRaw({ type: "alert_mark_all_read" });
  }

  private emit<K extends keyof ListenerMap>(event: K, ...args: Parameters<ListenerMap[K]>) {
    this.listeners[event].forEach((listener) => {
      (listener as (...a: Parameters<ListenerMap[K]>) => void)(...args);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }
}