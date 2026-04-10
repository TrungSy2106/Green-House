# Smart Greenhouse Backend (MySQL, single greenhouse)

Bản này đã được rút lại đúng scope dự án:
- 1 nhà kính duy nhất
- 4 cảm biến cố định: `temperature`, `humidity`, `light`, `soil_moisture`
- toàn bộ lịch sử cảm biến lưu trong **1 bảng `sensor_data`**
- 3 thiết bị điều khiển chính: quạt, bơm, đèn
- frontend dashboard cũ vẫn gọi được API

## 1. Tạo database MySQL
```sql
source sql/mysql_init.sql;
```

## 2. Cấu hình môi trường
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

## 3. Khởi tạo project
```powershell
python manage.py makemigrations api
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_demo
python manage.py runserver
```

## 4. API chính cho frontend
- `POST /api/auth/login/`
- `GET /api/dashboard/overview/`
- `GET /api/sensor-readings/latest/`
- `GET /api/sensor-readings/chart/?metric=temperature&hours=24`
- `GET /api/devices/`
- `POST /api/devices/{id}/toggle/`
- `POST /api/devices/{id}/command/`
- `GET /api/alerts/`
- `POST /api/alerts/{id}/mark_read/`
- `POST /api/alerts/mark_all_read/`
- `GET /api/rules/`
- `PATCH /api/rules/{id}/`

## 5. API cho ESP32
Header bắt buộc:
```http
X-Device-Token: esp32-local-token
```

### Gửi dữ liệu cảm biến
```http
POST /api/ingest/readings/
Content-Type: application/json
```

Body mẫu:
```json
{
  "temperature": 29.5,
  "humidity": 71.2,
  "light": 18250,
  "soil_moisture": 43.0,
  "device_states": {
    "fan_on": false,
    "pump_on": false,
    "light_on": true
  },
  "firmware_version": "1.0.0"
}
```

### Heartbeat
```http
POST /api/ingest/heartbeat/
```

### Lấy lệnh đang chờ
```http
GET /api/ingest/commands/pending/
```

### ACK lệnh
```http
POST /api/ingest/commands/{id}/ack/
```

Body mẫu:
```json
{
  "status": "ack",
  "actual_state": true
}
```
