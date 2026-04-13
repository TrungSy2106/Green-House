import { Thermometer, Droplets, Sprout, Fan, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Droplet, ThumbsUp, Info } from "lucide-react"; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

type ForecastRow = {
    time: string;
    temperature: number;
    humidity: number;
    soilMoisture: number;
    isForecast: boolean;
    temperatureActual: number | null;
    humidityActual: number | null;
    soilMoistureActual: number | null;
    temperatureForecastSegment: number | null;
    humidityForecastSegment: number | null;
    soilMoistureForecastSegment: number | null;
    temperatureForecastPoint: number | null;
    humidityForecastPoint: number | null;
    soilMoistureForecastPoint: number | null;
};

const current = {
    temperature: 28.5,
    humidity: 67.2,
    soilMoisture: 69.1,
};

const forecast = {
    // time: "Sau 1 giờ",
    forecastLabel: "20:53",
    temperature: 31.2,
    humidity: 62.5,
    soilMoisture: 65.8,
};

const chartData: ForecastRow[] = [
    {
        time: "13:00",
        temperature: 27.0,
        humidity: 69.0,
        soilMoisture: 71.0,
        isForecast: false,
        temperatureActual: 27.0,
        humidityActual: 69.0,
        soilMoistureActual: 71.0,
        temperatureForecastSegment: null,
        humidityForecastSegment: null,
        soilMoistureForecastSegment: null,
        temperatureForecastPoint: null,
        humidityForecastPoint: null,
        soilMoistureForecastPoint: null,
    },
    {
        time: "14:00",
        temperature: 27.2,
        humidity: 68.5,
        soilMoisture: 70.8,
        isForecast: false,
        temperatureActual: 27.2,
        humidityActual: 68.5,
        soilMoistureActual: 70.8,
        temperatureForecastSegment: null,
        humidityForecastSegment: null,
        soilMoistureForecastSegment: null,
        temperatureForecastPoint: null,
        humidityForecastPoint: null,
        soilMoistureForecastPoint: null,
    },
    {
        time: "15:00",
        temperature: 27.5,
        humidity: 68.0,
        soilMoisture: 70.4,
        isForecast: false,
        temperatureActual: 27.5,
        humidityActual: 68.0,
        soilMoistureActual: 70.4,
        temperatureForecastSegment: null,
        humidityForecastSegment: null,
        soilMoistureForecastSegment: null,
        temperatureForecastPoint: null,
        humidityForecastPoint: null,
        soilMoistureForecastPoint: null,
    },
    {
        time: "16:00",
        temperature: 27.8,
        humidity: 67.8,
        soilMoisture: 70.0,
        isForecast: false,
        temperatureActual: 27.8,
        humidityActual: 67.8,
        soilMoistureActual: 70.0,
        temperatureForecastSegment: null,
        humidityForecastSegment: null,
        soilMoistureForecastSegment: null,
        temperatureForecastPoint: null,
        humidityForecastPoint: null,
        soilMoistureForecastPoint: null,
    },
    {
        time: "17:00",
        temperature: 28.0,
        humidity: 67.5,
        soilMoisture: 69.6,
        isForecast: false,
        temperatureActual: 28.0,
        humidityActual: 67.5,
        soilMoistureActual: 69.6,
        temperatureForecastSegment: null,
        humidityForecastSegment: null,
        soilMoistureForecastSegment: null,
        temperatureForecastPoint: null,
        humidityForecastPoint: null,
        soilMoistureForecastPoint: null,
    },
    {
        time: "18:00",
        temperature: 28.3,
        humidity: 67.3,
        soilMoisture: 69.3,
        isForecast: false,
        temperatureActual: 28.3,
        humidityActual: 67.3,
        soilMoistureActual: 69.3,
        temperatureForecastSegment: null,
        humidityForecastSegment: null,
        soilMoistureForecastSegment: null,
        temperatureForecastPoint: null,
        humidityForecastPoint: null,
        soilMoistureForecastPoint: null,
    },
    {
        time: "Hiện tại",
        temperature: 28.5,
        humidity: 67.2,
        soilMoisture: 69.1,
        isForecast: false,
        temperatureActual: 28.5,
        humidityActual: 67.2,
        soilMoistureActual: 69.1,
        temperatureForecastSegment: 28.5,
        humidityForecastSegment: 67.2,
        soilMoistureForecastSegment: 69.1,
        temperatureForecastPoint: null,
        humidityForecastPoint: null,
        soilMoistureForecastPoint: null,
    },
    {
        time: "Sau 1 giờ",
        temperature: 31.2,
        humidity: 62.5,
        soilMoisture: 65.8,
        isForecast: true,
        temperatureActual: null,
        humidityActual: null,
        soilMoistureActual: null,
        temperatureForecastSegment: 31.2,
        humidityForecastSegment: 62.5,
        soilMoistureForecastSegment: 65.8,
        temperatureForecastPoint: 31.2,
        humidityForecastPoint: 62.5,
        soilMoistureForecastPoint: 65.8,
    },
];

// Trạng thái thiết bị mẫu
const deviceStatus = {
    fan: { active: false, label: "Quạt" },
    pump: { active: false, label: "Bơm tưới" },
};

function getCurrentStatusLabel(
    type: "temperature" | "humidity" | "soilMoisture",
    value: number
) {
    if (type === "temperature") {
        if (value <= 32) return { label: "Ổn định", className: "bg-green-100 text-green-700" };
        return { label: "Cần chú ý", className: "bg-amber-100 text-amber-700" };
    }

    if (type === "humidity") {
        if (value >= 60) return { label: "Ổn định", className: "bg-green-100 text-green-700" };
        return { label: "Cần chú ý", className: "bg-amber-100 text-amber-700" };
    }

    if (value >= 65) return { label: "Ổn định", className: "bg-green-100 text-green-700" };
    return { label: "Cần chú ý", className: "bg-amber-100 text-amber-700" };
}

function getDomain(values: number[], padding = 1) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [Math.floor(min - padding), Math.ceil(max + padding)];
}

type MetricChartProps = {
    title: string;
    color: string;
    unit: string;
    actualKey: "temperatureActual" | "humidityActual" | "soilMoistureActual";
    forecastSegmentKey:
    | "temperatureForecastSegment"
    | "humidityForecastSegment"
    | "soilMoistureForecastSegment";
    forecastPointKey:
    | "temperatureForecastPoint"
    | "humidityForecastPoint"
    | "soilMoistureForecastPoint";
    rawKey: "temperature" | "humidity" | "soilMoisture";
    data: ForecastRow[];
};

function MetricChart({
    title,
    color,
    unit,
    actualKey,
    forecastSegmentKey,
    forecastPointKey,
    rawKey,
    data,
}: MetricChartProps) {
    const values = data.map((d) => d[rawKey]).filter((v): v is number => typeof v === "number");
    const [minY, maxY] = getDomain(values, rawKey === "temperature" ? 1 : 2);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="mb-3">
                <p className="text-gray-800" style={{ fontSize: "13px", fontWeight: 600 }}>
                    {title}
                </p>
                <p className="text-gray-400" style={{ fontSize: "11px" }}>
                    Đường liền: thực tế · Nét đứt: xu hướng dự báo · Chấm cuối: sau 1 giờ
                </p>
            </div>

            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />

                    <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                    />

                    <YAxis
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        domain={[minY, maxY]}
                        width={36}
                    />

                    <Tooltip
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0]?.payload as ForecastRow | undefined;
                            if (!row) return null;

                            return (
                                <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[160px]">
                                    <p className="text-gray-800 mb-1" style={{ fontSize: "11px", fontWeight: 700 }}>
                                        {row.isForecast ? "Dự báo" : "Dữ liệu thực tế"}
                                    </p>
                                    <p className="text-gray-500 mb-2" style={{ fontSize: "10px" }}>
                                        {row.isForecast ? `${row.time} (${forecast.forecastLabel})` : row.time}
                                    </p>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-gray-600" style={{ fontSize: "11px" }}>
                                            {title}
                                        </span>
                                        <span style={{ fontSize: "12px", fontWeight: 700, color }}>
                                            {row[rawKey]}
                                            {unit}
                                        </span>
                                    </div>
                                </div>
                            );
                        }}
                    />

                    <ReferenceLine x="Hiện tại" stroke="#e5e7eb" strokeDasharray="4 4" />

                    <Line
                        type="monotone"
                        dataKey={actualKey}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={{ fill: color, r: 3.5 }}
                        activeDot={{ r: 5, fill: color, stroke: "white", strokeWidth: 2 }}
                        connectNulls={false}
                    />

                    <Line
                        type="monotone"
                        dataKey={forecastSegmentKey}
                        stroke={color}
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                        legendType="none"
                    />

                    <Line
                        type="monotone"
                        dataKey={forecastPointKey}
                        stroke={color}
                        strokeWidth={0}
                        dot={{ fill: color, r: 6, stroke: "white", strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: color, stroke: "white", strokeWidth: 2 }}
                        connectNulls={false}
                        legendType="none"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function ForecastTrendSection() {
    return (
        <section>
            <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-purple-600 rounded-full"></div>
                <h3 className="text-gray-700" style={{ fontSize: "14px", fontWeight: 600 }}>
                    Xu hướng và dự báo
                </h3>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <MetricChart
                    title="Nhiệt độ"
                    color="#f97316"
                    unit="°C"
                    actualKey="temperatureActual"
                    forecastSegmentKey="temperatureForecastSegment"
                    forecastPointKey="temperatureForecastPoint"
                    rawKey="temperature"
                    data={chartData}
                />

                <MetricChart
                    title="Độ ẩm không khí"
                    color="#3b82f6"
                    unit="%"
                    actualKey="humidityActual"
                    forecastSegmentKey="humidityForecastSegment"
                    forecastPointKey="humidityForecastPoint"
                    rawKey="humidity"
                    data={chartData}
                />

                <MetricChart
                    title="Độ ẩm đất"
                    color="#22c55e"
                    unit="%"
                    actualKey="soilMoistureActual"
                    forecastSegmentKey="soilMoistureForecastSegment"
                    forecastPointKey="soilMoistureForecastPoint"
                    rawKey="soilMoisture"
                    data={chartData}
                />
            </div>
        </section>
    );
}

export function ForecastPage() {
    const tempChange = forecast.temperature - current.temperature;
    const humidityChange = forecast.humidity - current.humidity;
    const soilChange = forecast.soilMoisture - current.soilMoisture;

    const risks: { level: "warning" | "caution" | "ok"; message: string }[] = [];
    const recommendations: string[] = [];

    if (forecast.temperature > 32) {
        risks.push({
            level: "warning",
            message: "Nhiệt độ dự báo vượt ngưỡng an toàn (>32°C)",
        });
        recommendations.push("Bật quạt làm mát hoặc che chắn ánh sáng");
    }

    if (forecast.humidity < 60) {
        risks.push({
            level: "caution",
            message: "Độ ẩm không khí có xu hướng giảm thấp",
        });
        recommendations.push("Kiểm tra hệ thống phun sương");
    }

    if (forecast.soilMoisture < 65) {
        risks.push({
            level: "warning",
            message: "Độ ẩm đất giảm, cây có thể thiếu nước",
        });
        recommendations.push("Cần tưới nước trong 30-60 phút tới");
    }

    if (risks.length === 0) {
        risks.push({ level: "ok", message: "Môi trường ổn định, không có cảnh báo" });
    }

    let overallStatus: "stable" | "attention" | "danger" = "stable";
    if (risks.some((r) => r.level === "warning")) overallStatus = "danger";
    else if (risks.some((r) => r.level === "caution")) overallStatus = "attention";

    const tempStatus = getCurrentStatusLabel("temperature", current.temperature);
    const humidityStatus = getCurrentStatusLabel("humidity", current.humidity);
    const soilStatus = getCurrentStatusLabel("soilMoisture", current.soilMoisture);

    return (
        <div className="space-y-5">
            {/* Chỉ số hiện tại */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 bg-green-600 rounded-full"></div>
                    <h3 className="text-gray-700" style={{ fontSize: "14px", fontWeight: 600 }}>
                        Trạng thái hiện tại
                    </h3>
                    <span
                        className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded-full"
                        style={{ fontSize: "10px", fontWeight: 600 }}
                    >
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        Live
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5 border border-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        <div
                            className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10"
                            style={{ background: "radial-gradient(circle, currentColor 0%, transparent 70%)" }}
                        />
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="text-gray-500" style={{ fontSize: "12px", fontWeight: 500 }}>
                                    Nhiệt độ
                                </p>
                                <div className="flex items-end gap-1 mt-1">
                                    <span
                                        className="text-gray-800"
                                        style={{ fontSize: "28px", fontWeight: 700, lineHeight: 1 }}
                                    >
                                        {current.temperature.toFixed(1)}
                                    </span>
                                    <span className="text-gray-500 pb-0.5" style={{ fontSize: "14px" }}>
                                        °C
                                    </span>
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Thermometer className="w-5 h-5 text-orange-500" />
                            </div>
                        </div>
                        <span
                            className={`px-2 py-0.5 rounded-full inline-block ${tempStatus.className}`}
                            style={{ fontSize: "11px", fontWeight: 600 }}
                        >
                            {tempStatus.label}
                        </span>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        <div
                            className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10"
                            style={{ background: "radial-gradient(circle, currentColor 0%, transparent 70%)" }}
                        />
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="text-gray-500" style={{ fontSize: "12px", fontWeight: 500 }}>
                                    Độ ẩm không khí
                                </p>
                                <div className="flex items-end gap-1 mt-1">
                                    <span
                                        className="text-gray-800"
                                        style={{ fontSize: "28px", fontWeight: 700, lineHeight: 1 }}
                                    >
                                        {current.humidity.toFixed(1)}
                                    </span>
                                    <span className="text-gray-500 pb-0.5" style={{ fontSize: "14px" }}>
                                        %
                                    </span>
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Droplets className="w-5 h-5 text-blue-500" />
                            </div>
                        </div>
                        <span
                            className={`px-2 py-0.5 rounded-full inline-block ${humidityStatus.className}`}
                            style={{ fontSize: "11px", fontWeight: 600 }}
                        >
                            {humidityStatus.label}
                        </span>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        <div
                            className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10"
                            style={{ background: "radial-gradient(circle, currentColor 0%, transparent 70%)" }}
                        />
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="text-gray-500" style={{ fontSize: "12px", fontWeight: 500 }}>
                                    Độ ẩm đất
                                </p>
                                <div className="flex items-end gap-1 mt-1">
                                    <span
                                        className="text-gray-800"
                                        style={{ fontSize: "28px", fontWeight: 700, lineHeight: 1 }}
                                    >
                                        {current.soilMoisture.toFixed(1)}
                                    </span>
                                    <span className="text-gray-500 pb-0.5" style={{ fontSize: "14px" }}>
                                        %
                                    </span>
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Sprout className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                        <span
                            className={`px-2 py-0.5 rounded-full inline-block ${soilStatus.className}`}
                            style={{ fontSize: "11px", fontWeight: 600 }}
                        >
                            {soilStatus.label}
                        </span>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="text-gray-500" style={{ fontSize: "12px", fontWeight: 500 }}>
                                    Thiết bị
                                </p>
                                <p className="text-gray-800 mt-1" style={{ fontSize: "14px", fontWeight: 600 }}>
                                    Trạng thái hoạt động
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Fan
                                        className={`w-4 h-4 ${deviceStatus.fan.active ? "text-green-600" : "text-gray-400"
                                            }`}
                                    />
                                    <span className="text-gray-700" style={{ fontSize: "12px" }}>
                                        {deviceStatus.fan.label}
                                    </span>
                                </div>
                                <span
                                    className={`px-2 py-0.5 rounded-full ${deviceStatus.fan.active
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-200 text-gray-500"
                                        }`}
                                    style={{ fontSize: "10px", fontWeight: 600 }}
                                >
                                    {deviceStatus.fan.active ? "Bật" : "Tắt"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Droplet
                                        className={`w-4 h-4 ${deviceStatus.pump.active ? "text-blue-600" : "text-gray-400"
                                            }`}
                                    />
                                    <span className="text-gray-700" style={{ fontSize: "12px" }}>
                                        {deviceStatus.pump.label}
                                    </span>
                                </div>
                                <span
                                    className={`px-2 py-0.5 rounded-full ${deviceStatus.pump.active
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-gray-200 text-gray-500"
                                        }`}
                                    style={{ fontSize: "10px", fontWeight: 600 }}
                                >
                                    {deviceStatus.pump.active ? "Bật" : "Tắt"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Dự báo sau 1 giờ */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                    <h3 className="text-gray-700" style={{ fontSize: "14px", fontWeight: 600 }}>
                        Dự báo
                    </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
                                <Thermometer className="w-4 h-4 text-orange-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-500" style={{ fontSize: "11px", fontWeight: 500 }}>
                                    Nhiệt độ dự báo
                                </p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-gray-800" style={{ fontSize: "22px", fontWeight: 700 }}>
                                        {forecast.temperature.toFixed(1)}°C
                                    </span>
                                    <span
                                        className={`flex items-center gap-0.5 ${tempChange > 0
                                                ? "text-red-500"
                                                : tempChange < 0
                                                    ? "text-blue-500"
                                                    : "text-gray-500"
                                            }`}
                                        style={{ fontSize: "12px", fontWeight: 600 }}
                                    >
                                        {tempChange > 0 ? (
                                            <TrendingUp className="w-3 h-3" />
                                        ) : (
                                            <TrendingDown className="w-3 h-3" />
                                        )}
                                        {Math.abs(tempChange).toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                            <span className="text-gray-400" style={{ fontSize: "11px" }}>
                                Thay đổi
                            </span>
                            <span
                                className={`${tempChange > 1.5 ? "text-red-600" : "text-gray-600"}`}
                                style={{ fontSize: "11px", fontWeight: 600 }}
                            >
                                {tempChange > 0 ? "+" : ""}
                                {tempChange.toFixed(1)}°C
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Droplets className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-500" style={{ fontSize: "11px", fontWeight: 500 }}>
                                    Độ ẩm KK dự báo
                                </p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-gray-800" style={{ fontSize: "22px", fontWeight: 700 }}>
                                        {forecast.humidity.toFixed(1)}%
                                    </span>
                                    <span
                                        className={`flex items-center gap-0.5 ${humidityChange > 0
                                                ? "text-green-500"
                                                : humidityChange < 0
                                                    ? "text-orange-500"
                                                    : "text-gray-500"
                                            }`}
                                        style={{ fontSize: "12px", fontWeight: 600 }}
                                    >
                                        {humidityChange > 0 ? (
                                            <TrendingUp className="w-3 h-3" />
                                        ) : (
                                            <TrendingDown className="w-3 h-3" />
                                        )}
                                        {Math.abs(humidityChange).toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                            <span className="text-gray-400" style={{ fontSize: "11px" }}>
                                Thay đổi
                            </span>
                            <span
                                className={`${humidityChange < -5 ? "text-orange-600" : "text-gray-600"}`}
                                style={{ fontSize: "11px", fontWeight: 600 }}
                            >
                                {humidityChange > 0 ? "+" : ""}
                                {humidityChange.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                                <Sprout className="w-4 h-4 text-green-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-500" style={{ fontSize: "11px", fontWeight: 500 }}>
                                    Độ ẩm đất dự báo
                                </p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-gray-800" style={{ fontSize: "22px", fontWeight: 700 }}>
                                        {forecast.soilMoisture.toFixed(1)}%
                                    </span>
                                    <span
                                        className={`flex items-center gap-0.5 ${soilChange > 0
                                                ? "text-green-500"
                                                : soilChange < 0
                                                    ? "text-orange-500"
                                                    : "text-gray-500"
                                            }`}
                                        style={{ fontSize: "12px", fontWeight: 600 }}
                                    >
                                        {soilChange > 0 ? (
                                            <TrendingUp className="w-3 h-3" />
                                        ) : (
                                            <TrendingDown className="w-3 h-3" />
                                        )}
                                        {Math.abs(soilChange).toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                            <span className="text-gray-400" style={{ fontSize: "11px" }}>
                                Thay đổi
                            </span>
                            <span
                                className={`${soilChange < -4 ? "text-orange-600" : "text-gray-600"}`}
                                style={{ fontSize: "11px", fontWeight: 600 }}
                            >
                                {soilChange > 0 ? "+" : ""}
                                {soilChange.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Biểu đồ */}
            <ForecastTrendSection />

            {/* Cảnh báo và khuyến nghị */}
        </div>
    );
}