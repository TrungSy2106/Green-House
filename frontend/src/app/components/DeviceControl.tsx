import { useMemo, useState } from "react";
import { Wind, Lightbulb, Droplets, Power, Activity, Zap, Loader2 } from "lucide-react";
import type { ControlState } from "../lib/websocket";
import { useRealtime } from "../contexts/RealtimeContext";

const DEVICE_META: Record<
  string,
  {
    label: string;
    description: string;
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
    power: number;
  }
> = {
  fan: {
    label: "Quạt thông gió",
    description: "Điều hòa nhiệt độ",
    icon: Wind,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
    power: 0,
  },
  light: {
    label: "Đèn chiếu sáng",
    description: "Bổ sung ánh sáng",
    icon: Lightbulb,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
    power: 0,
  },
  pump: {
    label: "Bơm tưới nước",
    description: "Hệ thống tưới nhỏ giọt",
    icon: Droplets,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50",
    power: 0,
  },
};

interface DeviceControlProps {
  control: ControlState | null;
}

export function DeviceControl({ control }: DeviceControlProps) {
  const { devices, sendMode, sendDeviceControl } = useRealtime();
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [switchingAuto, setSwitchingAuto] = useState(false);

  const visibleDevices = useMemo(
    () => devices.filter((d) => d.device_type !== "controller" && !d.name.toLowerCase().includes("esp")),
    [devices]
  );

  const isAuto = control?.mode === "AUTO";

  const handleToggleAuto = async () => {
    setSwitchingAuto(true);
    sendMode(isAuto ? "MANUAL" : "AUTO");
    setTimeout(() => setSwitchingAuto(false), 500);
  };

  const handleToggle = async (deviceType: "fan" | "pump" | "light", isOn: boolean) => {
    if (isAuto) return;
    setTogglingKey(deviceType);
    sendDeviceControl(deviceType, isOn ? "OFF" : "ON");
    setTimeout(() => setTogglingKey(null), 400);
  };

  const handleAllDevices = async (turnOn: boolean) => {
    if (isAuto) return;
    ["fan", "pump", "light"].forEach((device) => {
      sendDeviceControl(device as "fan" | "pump" | "light", turnOn ? "ON" : "OFF");
    });
  };

  const activeCount = visibleDevices.filter((d) => d.state?.is_on).length;

  return (
    <div className="elevated-card rounded-3xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
            <Zap className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-slate-900">Điều khiển thiết bị</h3>
            <p className="text-slate-400" style={{ fontSize: "11px" }}>
              {isAuto ? "Đang bật chế độ tự động" : "Đang ở chế độ thủ công"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleAuto}
            disabled={switchingAuto}
            className={`px-3 py-2 rounded-xl transition-all duration-300 disabled:opacity-60 flex items-center gap-2 ${
              isAuto
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
            }`}
            style={{ fontSize: "12px", fontWeight: 700 }}
          >
            {switchingAuto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
            {isAuto ? "Tắt tự động" : "Bật tự động"}
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-lg">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-blue-700" style={{ fontSize: "12px", fontWeight: 600 }}>
              {activeCount}/{visibleDevices.length} hoạt động
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {isAuto && (
          <div
            className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700"
            style={{ fontSize: "12px" }}
          >
            Chế độ tự động đang bật.
          </div>
        )}

        {visibleDevices.length === 0 ? (
          <p className="text-center text-slate-400 py-6" style={{ fontSize: "13px" }}>
            Không có thiết bị nào
          </p>
        ) : (
          visibleDevices.map((device) => {
            const meta = DEVICE_META[device.device_type] ?? {
              label: device.name,
              description: device.code,
              icon: Zap,
              iconColor: "text-slate-500",
              iconBg: "bg-slate-50",
              power: 0,
            };

            const Icon = meta.icon;
            const isOn = device.state?.is_on ?? false;
            const isToggling = togglingKey === device.device_type;

            return (
              <div
                key={device.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                  isOn ? "border-blue-100 bg-blue-50/50" : "border-slate-200 bg-slate-50/60"
                } ${isAuto ? "opacity-70" : ""}`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all border ${
                    isOn ? `${meta.iconBg} border-white` : "bg-white border-slate-200"
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-colors ${isOn ? meta.iconColor : "text-slate-400"}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`${isOn ? "text-slate-900" : "text-slate-500"}`}
                      style={{ fontSize: "14px", fontWeight: 600 }}
                    >
                      {meta.label}
                    </p>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        device.status === "online" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {device.status === "online" ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="text-slate-400" style={{ fontSize: "12px" }}>
                    {meta.description} · {meta.power}W
                  </p>

                  {isOn && (
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden w-24">
                      <div className="h-full bg-blue-500 rounded-full animate-pulse-soft" style={{ width: "70%" }}></div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      isOn ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
                    }`}
                    style={{ fontSize: "11px" }}
                  >
                    {isOn ? "Bật" : "Tắt"}
                  </span>

                  <button
                    onClick={() => handleToggle(device.device_type as "fan" | "pump" | "light", isOn)}
                    disabled={isAuto || isToggling}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isOn ? "bg-blue-600" : "bg-slate-300"
                    }`}
                  >
                    {isToggling ? (
                      <Loader2 className="w-3.5 h-3.5 text-white absolute top-1 left-3.5 animate-spin" />
                    ) : (
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
                          isOn ? "left-6" : "left-0.5"
                        }`}
                      ></span>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-5 pb-5 flex gap-3">
        <button
          onClick={() => handleAllDevices(true)}
          disabled={isAuto}
          className="flex-1 py-2 gradient-action text-white rounded-xl transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: "13px", fontWeight: 600 }}
        >
          <Power className="w-3.5 h-3.5" /> Bật tất cả
        </button>

        <button
          onClick={() => handleAllDevices(false)}
          disabled={isAuto}
          className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors hover:bg-slate-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: "13px", fontWeight: 600 }}
        >
          <Power className="w-3.5 h-3.5" /> Tắt tất cả
        </button>
      </div>
    </div>
  );
}