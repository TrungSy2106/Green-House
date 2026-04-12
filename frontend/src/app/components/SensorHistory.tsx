import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import { apiClient } from "../api/client";
import type { SensorReading } from "../api/endpoints";

interface SensorHistoryResponse {
  items: SensorReading[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMetric(value: number | null, unit: string) {
  if (value === null || value === undefined) return "--";
  return `${Number(value).toFixed(1)} ${unit}`;
}

function toIsoOrEmpty(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

async function fetchSensorHistory(params: {
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });

  if (params.dateFrom) {
    search.set("date_from", params.dateFrom);
  }

  if (params.dateTo) {
    search.set("date_to", params.dateTo);
  }

  return apiClient.get<SensorHistoryResponse>(`/sensor-readings/history/?${search.toString()}`);
}

export function SensorHistory() {
  const [rows, setRows] = useState<SensorReading[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const invalidRange =
    !!dateFrom && !!dateTo && new Date(dateFrom).getTime() > new Date(dateTo).getTime();

  const loadData = async (
    nextPage = page,
    nextDateFrom = dateFrom,
    nextDateTo = dateTo
  ) => {
    try {
      setError("");
      setLoading(true);

      const res = await fetchSensorHistory({
        page: nextPage,
        pageSize,
        dateFrom: toIsoOrEmpty(nextDateFrom) || undefined,
        dateTo: toIsoOrEmpty(nextDateTo) || undefined,
      });

      const data = res.data;
      setRows(data.items ?? []);
      setPage(data.page ?? 1);
      setTotalPages(Math.max(data.total_pages ?? 1, 1));
    } catch {
      setError("Không tải được lịch sử cảm biến.");
      setRows([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invalidRange) return;
    void loadData(page, dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dateFrom, dateTo]);

  const handlePrev = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <div className="space-y-5">
      <div className="elevated-card rounded-3xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label
              className="block text-slate-500 mb-2"
              style={{ fontSize: "11px", fontWeight: 700 }}
            >
              Từ ngày giờ
            </label>
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none"
              style={{ fontSize: "13px", fontWeight: 600 }}
            />
          </div>

          <div>
            <label
              className="block text-slate-500 mb-2"
              style={{ fontSize: "11px", fontWeight: 700 }}
            >
              Đến ngày giờ
            </label>
            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none"
              style={{ fontSize: "13px", fontWeight: 600 }}
            />
          </div>
        </div>

        {invalidRange && (
          <div
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-600"
            style={{ fontSize: "12px", fontWeight: 600 }}
          >
            Thời gian bắt đầu không được lớn hơn thời gian kết thúc.
          </div>
        )}
      </div>

      <div className="elevated-card rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h4 className="text-slate-900" style={{ fontSize: "15px", fontWeight: 700 }}>
            Bảng dữ liệu đo
          </h4>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400" style={{ fontSize: "13px" }}>
            Đang tải lịch sử cảm biến...
          </div>
        ) : error ? (
          <div
            className="p-10 text-center text-red-500"
            style={{ fontSize: "13px", fontWeight: 600 }}
          >
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-200">
              <Database className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-700" style={{ fontSize: "15px", fontWeight: 700 }}>
              Chưa có lịch sử đo
            </p>
            <p className="text-slate-500 mt-1" style={{ fontSize: "13px" }}>
              Khi ESP gửi dữ liệu cảm biến, bản ghi sẽ xuất hiện ở đây
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    className="text-right px-5 py-3 text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 700 }}
                  >
                    Nhiệt độ
                  </th>
                  <th
                    className="text-right px-5 py-3 text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 700 }}
                  >
                    Độ ẩm
                  </th>
                  <th
                    className="text-right px-5 py-3 text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 700 }}
                  >
                    Ánh sáng
                  </th>
                  <th
                    className="text-right px-5 py-3 text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 700 }}
                  >
                    Độ ẩm đất
                  </th>
                  <th
                    className="text-left px-5 py-3 text-slate-500"
                    style={{ fontSize: "12px", fontWeight: 700 }}
                  >
                    Thời gian đo
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors"
                  >
                    <td
                      className="px-5 py-4 text-right text-slate-800"
                      style={{ fontSize: "13px", fontWeight: 600 }}
                    >
                      {formatMetric(row.temperature, "°C")}
                    </td>
                    <td
                      className="px-5 py-4 text-right text-slate-800"
                      style={{ fontSize: "13px", fontWeight: 600 }}
                    >
                      {formatMetric(row.humidity, "%")}
                    </td>
                    <td
                      className="px-5 py-4 text-right text-slate-800"
                      style={{ fontSize: "13px", fontWeight: 600 }}
                    >
                      {formatMetric(row.light, "%")}
                    </td>
                    <td
                      className="px-5 py-4 text-right text-slate-800"
                      style={{ fontSize: "13px", fontWeight: 600 }}
                    >
                      {formatMetric(row.soil_moisture, "%")}
                    </td>
                    <td
                      className="px-5 py-4 text-slate-700 whitespace-nowrap"
                      style={{ fontSize: "13px", fontWeight: 600 }}
                    >
                      {formatDateTime(row.recorded_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={page <= 1 || invalidRange}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-2"
            style={{ fontSize: "13px", fontWeight: 600 }}
          >
            <ChevronLeft className="w-4 h-4" />
            Trước
          </button>

          <div className="text-slate-600" style={{ fontSize: "13px", fontWeight: 600 }}>
            Trang {page} / {totalPages}
          </div>

          <button
            onClick={handleNext}
            disabled={page >= totalPages || invalidRange}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-2"
            style={{ fontSize: "13px", fontWeight: 600 }}
          >
            Sau
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}