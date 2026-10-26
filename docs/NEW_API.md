# New API Documentation

Bu fayl frontend uchun oxirgi qo'shilgan API'larni tushuntiradi.

Base URL misol:

```text
https://your-domain.com
```

Auth:
- Ichki API'lar uchun odatda `Authorization: Bearer <token>`
- Tashqi CRM create API uchun `X-Key: <secret-key>`

## 1. Sales Manager Lead APIs

### 1.1 GET `/crm/sales-managers/{sales_manager_id}/customers`

Sales managerga biriktirilgan leadlar ro'yxati.

Query parametrlari:
- `page` - default `1`
- `limit` - default `20`, max `200`
- `search` - ism yoki telefon bo'yicha qidiruv
- `status` - `status` yoki `status_name` bo'yicha filter
- `priority_level` - `low | medium | high | critical`
- `include_archived` - `true/false`, default `false`

Response misol:

```json
{
  "sales_manager": {
    "id": 7,
    "email": "seller@example.com",
    "name": "Ali",
    "surname": "Valiyev"
  },
  "total_count": 2,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": 45,
      "full_name": "John Doe",
      "phone_number": "+998901234567",
      "platform": "Telegram",
      "username": "@johndoe",
      "status": "need_to_call",
      "status_name": "need_to_call",
      "priority_level": "high",
      "priority_score": 73,
      "importance_score": 75,
      "industry": "healthcare",
      "is_archived": false,
      "created_at": "2026-05-20T16:10:00",
      "assigned_at": "2026-05-20T16:15:00"
    }
  ]
}
```

### 1.2 GET `/crm/sales-managers/{sales_manager_id}/stats`

Sales managerga biriktirilgan leadlarning status statistikasi.

Query parametrlari:
- `include_archived` - `true/false`, default `false`

Response misol:

```json
{
  "sales_manager": {
    "id": 7,
    "email": "seller@example.com",
    "name": "Ali",
    "surname": "Valiyev"
  },
  "summary": {
    "total_assigned": 27,
    "active_leads": 21,
    "archived_leads": 6,
    "counted_leads": 21
  },
  "status_stats": [
    {
      "status": "need_to_call",
      "count": 12
    },
    {
      "status": "project_started",
      "count": 5
    },
    {
      "status": "rejected",
      "count": 3
    }
  ]
}
```

### 1.3 GET `/crm/my-customers`

Login bo'lgan sales managerning o'z leadlari.

Query parametrlari:
- `page`
- `limit`
- `search`
- `status`
- `priority_level`
- `include_archived`

Response formati `GET /crm/sales-managers/{sales_manager_id}/customers` bilan bir xil.

### 1.4 GET `/crm/my-customers/stats`

Login bo'lgan sales managerning o'z statistikasi.

Query parametrlari:
- `include_archived`

Response formati `GET /crm/sales-managers/{sales_manager_id}/stats` bilan bir xil.

## 2. Project Attachment APIs

Bu API'lar `tz`, `kp`, `contracts` fayllari uchun ishlatiladi.

Attachment type qiymatlari:
- `tz`
- `kp`
- `contracts`

Ruxsat etilgan formatlar:
- image: `jpg`, `jpeg`, `png`, `webp`, `gif`
- document: `pdf`, `doc`, `docx`
- excel: `xls`, `xlsx`

### 2.1 POST `/projects/{project_id}/attachments`

Projectga attachment yuklash.

Content-Type:

```text
multipart/form-data
```

Form fieldlar:
- `attachment_type` - `tz | kp | contracts`
- `description` - optional
- `file` - required

Frontend `fetch` misol:

```javascript
const formData = new FormData();
formData.append("attachment_type", "contracts");
formData.append("description", "Signed contract");
formData.append("file", fileInput.files[0]);

const response = await fetch(`/projects/5/attachments`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`
  },
  body: formData
});
```

Response misol:

```json
{
  "id": 2,
  "project_id": 5,
  "attachment_type": "contracts",
  "file_name": "contract-test.pdf",
  "url_path": "/files/project_attachments/5/abc123-contract-test.pdf",
  "mime_type": "application/pdf",
  "file_size": 20480,
  "description": "Signed contract",
  "created_by": 12,
  "created_at": "2026-05-20T17:20:00",
  "updated_at": "2026-05-20T17:20:00",
  "created_by_user": {
    "id": 12,
    "name": "Ali",
    "surname": "Valiyev",
    "email": "ali@example.com"
  }
}
```

### 2.2 GET `/projects/{project_id}/attachments`

Project attachmentlari ro'yxati.

Query parametrlari:
- `attachment_type` - optional, `tz | kp | contracts`

Response misol:

```json
[
  {
    "id": 2,
    "project_id": 5,
    "attachment_type": "contracts",
    "file_name": "contract-test.pdf",
    "url_path": "/files/project_attachments/5/abc123-contract-test.pdf",
    "mime_type": "application/pdf",
    "file_size": 20480,
    "description": "Signed contract",
    "created_by": 12,
    "created_at": "2026-05-20T17:20:00",
    "updated_at": "2026-05-20T17:20:00",
    "created_by_user": {
      "id": 12,
      "name": "Ali",
      "surname": "Valiyev",
      "email": "ali@example.com"
    }
  }
]
```

### 2.3 GET `/projects/attachments/{attachment_id}`

Bitta attachment detail.

Response formati `POST /projects/{project_id}/attachments` bilan bir xil.

### 2.4 PATCH `/projects/attachments/{attachment_id}`

Attachmentni yangilash.

Content-Type:

```text
multipart/form-data
```

Form fieldlar:
- `attachment_type` - optional
- `description` - optional
- `file` - optional

Muhim:
- Kamida bitta field yuborilishi kerak
- Faqat `description` yoki faqat `attachment_type` yuborish ham mumkin
- `file` yuborilsa eski fayl yangisiga almashadi

Response formati `POST /projects/{project_id}/attachments` bilan bir xil.

### 2.5 DELETE `/projects/attachments/{attachment_id}`

Attachmentni o'chirish.

Response misol:

```json
{
  "message": "Project attachment o'chirildi"
}
```

## 3. External CRM Create API

### 3.1 POST `/crm/api/customers`

Tashqi tizimdan lead yaratish.

Headerlar:

```http
Content-Type: application/json
X-Key: your-secret-key
```

Request body:

```json
{
  "full_name": "John Doe",
  "platform": "Telegram",
  "username": "@johndoe",
  "phone_number": "+998901234567",
  "status": "need_to_call",
  "assistant_name": "Assistant Name",
  "chat_url": "https://t.me/example_chat",
  "notes": "Qo'shimcha ma'lumotlar",
  "recall_time": "2026-05-21T10:00:00+05:00",
  "conversation_language": "uz"
}
```

Response misol:

```json
{
  "message": "Mijoz muvaffaqiyatli yaratildi",
  "id": 43
}
```

### 3.2 Duplicate phone response

Agar shu telefon bilan lead allaqachon mavjud bo'lsa:

Status code:

```text
409 Conflict
```

Response:

```json
{
  "detail": "Bu telefon raqami bilan lead allaqachon mavjud"
}
```

### 3.3 X-Key xatolari

Noto'g'ri yoki yo'q `X-Key`:

```json
{
  "detail": "Unauthorized"
}
```

Yoki server konfiguratsiyasiga qarab `401` qaytadi.

## 4. Frontend Notes

- Sales manager endpointlarida `status` query parametri `status_name` yoki enum `status` bilan ishlaydi.
- Attachment upload endpointlari `multipart/form-data` talab qiladi, JSON emas.
- Attachment list/detail response ichidagi `url_path` frontendda download yoki preview uchun ishlatiladi.
- External CRM API frontend ichki panel uchun emas, tashqi integratsiya uchun.
- `contracts` ham `tz` va `kp` bilan bir xil attachment API orqali yuboriladi.
