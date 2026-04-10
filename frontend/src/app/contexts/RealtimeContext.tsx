import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  GreenhouseWebSocket,
  type AlertItem,
  type DeviceItem,
  type GreenhouseStatePacket,
  type SensorReading,
  type ControlState,
} from "../lib/websocket";

export type DashboardOverview = {
  latest: SensorReading | null;
  control: ControlState;
  device_count: number;
  online_devices: number;
  unread_alerts: number;
  uptime_hint: string;
  recent_alerts: AlertItem[];
  esp32_online: boolean;
};

type RealtimeContextType = {
  overview: DashboardOverview | null;
  latest: SensorReading | null;
  devices: DeviceItem[];
  alerts: AlertItem[];
  chartHistory: SensorReading[];
  connected: boolean;
  lastUpdated: Date | null;
  sendMode: (mode: "AUTO" | "MANUAL") => void;
  sendDeviceControl: (device: "fan" | "pump" | "light", state: "ON" | "OFF") => void;
  markAlertRead: (id: number) => void;
  markAllAlertsRead: () => void;
};

const RealtimeContext = createContext<RealtimeContextType | null>(null);

const WS_URL =
  (import.meta as any).env?.VITE_WS_URL ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8000/ws/frontend/`;

function formatUptime(updatedAt?: string | null) {
  if (!updatedAt) return "—";
  const diff = Date.now() - new Date(updatedAt).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ`;
  return `${Math.floor(hrs / 24)} ngày`;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<GreenhouseWebSocket | null>(null);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [latest, setLatest] = useState<SensorReading | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [chartHistory, setChartHistory] = useState<SensorReading[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const rebuildOverview = (
    nextLatest: SensorReading | null,
    nextDevices: DeviceItem[],
    nextAlerts: AlertItem[],
    nextControl: ControlState,
    updatedAt: string | null,
    esp32Online: boolean,
  ) => {
    setOverview({
      latest: nextLatest,
      control: nextControl,
      device_count: nextDevices.length,
      online_devices: nextDevices.filter((d) => d.status === "online").length,
      unread_alerts: nextAlerts.filter((a) => !a.is_read).length,
      uptime_hint: formatUptime(updatedAt),
      recent_alerts: nextAlerts.slice(0, 5),
      esp32_online: esp32Online,
    });
  };

  const applyStatePacket = (payload: GreenhouseStatePacket) => {
    const nextLatest = payload.latest ?? null;
    const nextDevices = payload.devices ?? [];
    const nextAlerts = payload.alerts ?? [];
    const nextControl = payload.control;
    const nextHistory = payload.history ?? [];

    setLatest(nextLatest);
    setDevices(nextDevices);
    setAlerts(nextAlerts);
    setChartHistory(nextHistory);

    rebuildOverview(
      nextLatest,
      nextDevices,
      nextAlerts,
      nextControl,
      payload.updated_at,
      !!payload.esp32_online,
    );

    setLastUpdated(new Date());
  };

  useEffect(() => {
    const socket = new GreenhouseWebSocket(WS_URL);
    socketRef.current = socket;

    const offOpen = socket.on("open", () => setConnected(true));
    const offClose = socket.on("close", () => setConnected(false));
    const offError = socket.on("error", () => setConnected(false));

    const offMessage = socket.on("message", (msg) => {
      if (msg.type === "bootstrap" || msg.type === "state") {
        applyStatePacket(msg.data);
        return;
      }

      if (msg.type === "sensor_update") {
        setLatest(msg.data);
        setChartHistory((prev) => [...prev.slice(-119), msg.data]);
        setLastUpdated(new Date());

        setOverview((prev) =>
          prev
            ? {
                ...prev,
                latest: msg.data,
                uptime_hint: formatUptime(msg.data.recorded_at),
              }
            : prev
        );
        return;
      }

      if (msg.type === "device_state") {
        setDevices((prev) => {
          const nextDevices = prev.map((d) =>
            d.device_type === msg.data.device
              ? {
                  ...d,
                  state: { ...(d.state ?? { is_on: false }), is_on: msg.data.is_on },
                }
              : d
          );

          setOverview((prevOverview) =>
            prevOverview
              ? {
                  ...prevOverview,
                  device_count: nextDevices.length,
                  online_devices: nextDevices.filter((d) => d.status === "online").length,
                }
              : prevOverview
          );

          return nextDevices;
        });
        return;
      }

      if (msg.type === "alert_created") {
        setAlerts((prev) => {
          const nextAlerts = [msg.data, ...prev];
          setOverview((prevOverview) =>
            prevOverview
              ? {
                  ...prevOverview,
                  unread_alerts: nextAlerts.filter((a) => !a.is_read).length,
                  recent_alerts: nextAlerts.slice(0, 5),
                }
              : prevOverview
          );
          return nextAlerts;
        });
      }
    });

    socket.connect();

    return () => {
      offOpen();
      offClose();
      offError();
      offMessage();
      socket.disconnect();
    };
  }, []);

  const value = useMemo<RealtimeContextType>(() => ({
    overview,
    latest,
    devices,
    alerts,
    chartHistory,
    connected,
    lastUpdated,
    sendMode: (mode) => socketRef.current?.sendMode(mode),
    sendDeviceControl: (device, state) => socketRef.current?.sendDeviceControl(device, state),
    markAlertRead: (id) => {
      setAlerts((prev) => {
        const nextAlerts = prev.map((a) => (a.id === id ? { ...a, is_read: true } : a));
        setOverview((prevOverview) =>
          prevOverview
            ? {
                ...prevOverview,
                unread_alerts: nextAlerts.filter((a) => !a.is_read).length,
                recent_alerts: nextAlerts.slice(0, 5),
              }
            : prevOverview
        );
        return nextAlerts;
      });
      socketRef.current?.markAlertRead(id);
    },
    markAllAlertsRead: () => {
      setAlerts((prev) => {
        const nextAlerts = prev.map((a) => ({ ...a, is_read: true }));
        setOverview((prevOverview) =>
          prevOverview
            ? {
                ...prevOverview,
                unread_alerts: 0,
                recent_alerts: nextAlerts.slice(0, 5),
              }
            : prevOverview
        );
        return nextAlerts;
      });
      socketRef.current?.markAllAlertsRead();
    },
  }), [overview, latest, devices, alerts, chartHistory, connected, lastUpdated]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return ctx;
}