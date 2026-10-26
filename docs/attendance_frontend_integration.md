# CIMS Attendance Frontend Integration

Backendda FaceID attendance API yozilgan va serverda ishlayapti.

Server DB holati:
- `attendance_raw_event`: 183 ta event bor.
- Oxirgi raw event: `2026-08-19 09:23 UTC`.
- `attendance_daily_record`: 102 ta daily record bor.
- Oxirgi daily record sanasi: `2026-08-18`.

## Base URL

```text
https://api.project.cims.cognilabs.org
```

## Auth

Attendance API alohida key bilan ishlaydi. Har requestda header yuboriladi:

```http
X-Attendance-Key: <ATTENDANCE_API_KEY>
```

Frontend bu keyni hardcode qilmasin. Config/env orqali olinishi kerak.

## 1. Userlarni Olish

FaceID device userlarini CIMS employee bilan map qilish uchun:

```http
GET /attendance/users?page=1&page_size=500&is_active=true
```

Query params:

```text
search
is_active
page
page_size
```

Response `items[]` ichida asosiy fieldlar:

```text
id
name
surname
full_name
email
department
position
role
role_name
is_active
```

Frontend vazifa:
- Employee select uchun shu API ishlatiladi.
- FaceID qurilmadagi odam CIMS `employee_id`ga bog'lanadi.

## 2. Daily Attendance List

Attendance table/calendar uchun asosiy API:

```http
GET /attendance/daily-records?page=1&page_size=100&year=2026&month=8
```

Filterlar:

```text
employee_id
date_from
date_to
year
month
day
status
source_system
is_manual
page
page_size
```

Valid statuslar:

```text
present
late
absent
incomplete
```

Frontend ko'rsatadigan asosiy fieldlar:

```text
employee_id
employee_full_name
attendance_date
check_in_at
check_out_at
check_in_time
check_out_time
worked_minutes
worked_hours_decimal
status
source_system
is_manual
note
```

UI izoh:
- `check_in_at` va `check_out_at` timezone-aware datetime.
- UI'da Asia/Tashkent vaqtida ko'rsatish kerak.
- `worked_minutes`dan "8 soat 20 daqiqa" format qilish mumkin.
- `status` badge ko'rinishida chiqsin.

## 3. Manual Edit

Admin attendance recordni tuzatishi uchun:

```http
PATCH /attendance/daily-records/{employee_id}/{attendance_date}
```

Example:

```http
PATCH /attendance/daily-records/18/2026-08-19
```

Body example:

```json
{
  "status": "incomplete",
  "note": "Check-out event missing",
  "source_updated_at": "2026-08-19T14:30:00+05:00"
}
```

Soft delete body:

```json
{
  "is_deleted": true,
  "delete_reason": "Wrong employee mapping",
  "source_updated_at": "2026-08-19T14:35:00+05:00"
}
```

Frontend vazifa:
- Edit modal ochiladi.
- Status, check-in/check-out, note edit qilinadi.
- Delete bo'lsa reason so'raladi.
- Save'dan keyin list refetch qilinadi.

## 4. Device Uchun APIlar

Bu endpointlar frontend uchun emas, FaceID integration/qurilma uchun:

```http
POST /attendance/raw-events/bulk-upsert
POST /attendance/daily-records/bulk-upsert
PUT /attendance/daily-records/{employee_id}/{attendance_date}
```

Raw event action qiymatlari:

```text
came
gone
```

Device/integration uchun talab:
- Har bir raw event uchun `source_event_id` stable va unique bo'lsin.
- Retry qilganda o'sha `source_event_id` qayta yuborilsin.
- Daily record uchun `source_session_id` stable bo'lsin.
- Tavsiya: `faceid-{employee_id}-{YYYY-MM-DD}`.
- Barcha datetime `+05:00` bilan yuborilsin.

## 5. Frontend Page Talablar

Kerak bo'lgan UI:
- Attendance page.
- Month/day filter.
- Employee filter.
- Status filter.
- Source filter: `faceid`, kerak bo'lsa manual.
- Table yoki calendar ko'rinish.
- Columns: employee, date, came, gone, worked time, status, source, note.
- Manual edit modal.
- Empty state: `Davomat ma'lumoti topilmadi`.
- Pagination majburiy.

## 6. Error Handling

Frontend quyidagilarni ko'rsatsin:
- 401/403: attendance key noto'g'ri yoki permission yo'q.
- 422: body yoki filter noto'g'ri.
- 500: server error, qayta urinib ko'rish kerak.

## 7. Full Contract

Backend repo ichida full device contract bor:

```text
ATTENDANCE_DEVICE_INTEGRATION.md
```
