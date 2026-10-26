# CognilabsAI Integration Guide

## 1. Umumiy Tuzilma

`CognilabsAI` moduli `CIMSFastApi` ichiga alohida qo'shilgan.

Asosiy qoida:

- `Instagram` chatlarida `AI + operator` ishlaydi.
- `Telegram` chatlarida faqat `operator` ishlaydi.
- `CognilabsAI` alohida DB table larda ishlaydi.
- `CIMS` existing auth va permission tizimi ishlatiladi.
- AI lead olganda lead `CIMS CRM` ichidagi `customer` jadvaliga tushadi.

## 2. Permissionlar

Frontend userda kamida quyidagi permissionlardan biri bo'lishi kerak:

- `cognilabsai_chat`
- `cognilabsai_integrations`

Tavsif:

- `cognilabsai_chat`: chatlar, message lar, telegram start, pause, resume, websocket ishlatish
- `cognilabsai_integrations`: OpenAI, Instagram, Telegram, websocket key, prompt sozlamalari

## 3. Auth

Backend auth `CIMS` existing login bilan ishlaydi.

Login:

`POST /auth/login`

Form data:

```text
username=<email>
password=<password>
```

Frontend har bir protected requestga quyidagini yuboradi:

```text
Authorization: Bearer <access_token>
```

## 4. Chat Turlari

Conversation response endi quyidagi fieldlarni ham qaytaradi:

- `chat_mode`
- `supports_ai`

Qiymatlar:

- `telegram_operator`
- `instagram_ai`

Ma'nosi:

- `chat_mode = telegram_operator` bo'lsa frontend AI control tugmalarini ko'rsatmaydi
- `supports_ai = false` bo'lsa AI retry, AI badge, AI state ko'rsatilmaydi
- `chat_mode = instagram_ai` bo'lsa AI bilan bog'liq UI ko'rsatiladi

## 5. Conversation Response

`GET /cognilabsai/chat/conversations`

Har bir item taxminan shunday qaytadi:

```json
{
  "id": 1464,
  "channel": "telegram",
  "chat_mode": "telegram_operator",
  "supports_ai": false,
  "client_external_id": "2142099363",
  "client_username": "dev949",
  "client_full_name": "A",
  "client_avatar_url": "/images/profil_images/cognilabsai_telegram_2142099363.jpg",
  "instagram_business_id": null,
  "ai_enabled": false,
  "pause_reason": "operator",
  "paused_until": null,
  "last_message_at": "2026-04-28T14:36:24.695902",
  "last_message_preview": "hello",
  "last_operator_user_id": 1,
  "last_operator_name": "Developer CEO",
  "is_imported": false,
  "created_at": "2026-04-28T14:28:02.603354",
  "updated_at": "2026-04-28T14:36:24.696473"
}
```

Frontend uchun ishlatish:

- `channel` bo'yicha tab/filter qiling
- `chat_mode` bo'yicha UI behaviorni ajrating
- `client_avatar_url` bo'lsa avatar ko'rsating
- `last_operator_name` bo'lsa operator takeover badge ko'rsating
- `pause_reason` bo'yicha status chip ko'rsating

## 6. Message Response

`GET /cognilabsai/chat/conversations/{conversation_id}/messages`

Har bir message item:

```json
{
  "id": 12005,
  "conversation_id": 1464,
  "channel": "telegram",
  "sender_type": "client",
  "operator_user_id": null,
  "operator_name_snapshot": null,
  "client_external_id": "2142099363",
  "instagram_message_id": null,
  "telegram_message_id": null,
  "text": "rfwbuo",
  "created_at": "2026-04-28T14:36:24.695902"
}
```

`sender_type` qiymatlari:

- `client`
- `operator`
- `ai`
- `system`

Frontend:

- `operator` message bo'lsa `operator_name_snapshot` ni ko'rsating
- `ai` faqat Instagram chatlarda ishlating

## 7. WebSocket

Endpoint:

`/cognilabsai/ws/chat?api_key=<ws_key>&conversation_id=<id>`

Yoki barcha chatlar uchun:

`/cognilabsai/ws/chat?api_key=<ws_key>`

`api_key` integrations ichida saqlanadi.

Event turlari:

- `message.created`
- `conversation.updated`

Misol:

```json
{
  "type": "message.created",
  "conversation_id": 1464,
  "message": {
    "id": 12005,
    "conversation_id": 1464,
    "channel": "telegram",
    "sender_type": "client",
    "text": "rfwbuo",
    "created_at": "2026-04-28T14:36:24.695902"
  }
}
```

Frontend tavsiya:

- Chat list ochilganda global websocket oching
- Conversation detail ochilganda `conversation_id` bilan alohida websocket oching
- `message.created` kelsa current listga append qiling
- `conversation.updated` kelsa conversation meta ni yangilang

## 8. Instagram Flow

Instagram uchun:

- incoming webhook DB ga tushadi
- AI javob yozadi
- operator xohlasa takeover qiladi
- operator yozsa AI pause bo'ladi

Muhim:

- `supports_ai = true`
- `retry-ai` endpoint faqat Instagram uchun ishlatiladi

API lar:

- `GET /cognilabsai/chat/conversations?channel=instagram`
- `POST /cognilabsai/chat/send-message`
- `POST /cognilabsai/chat/pause`
- `POST /cognilabsai/chat/resume`
- `POST /cognilabsai/chat/pause-until`
- `POST /cognilabsai/chat/conversations/{conversation_id}/retry-ai`

## 9. Telegram Flow

Telegram uchun:

- AI ishlamaydi
- incoming message realtime DB ga tushadi
- operator `CIMS` ichidan yozadi
- operator message account nomidan Telegramga ketadi
- oldin yozmagan userga ham `username/id/link` orqali yozish mumkin

Muhim:

- `supports_ai = false`
- Telegramda `retry-ai` chaqirmang
- Telegram chatlar default operator chat

## 10. Telegram Search

Exact search:

`GET /cognilabsai/chat/telegram/search?query=dev949`

Bu bitta eng mos result qaytaradi.

List search:

`GET /cognilabsai/chat/telegram/search-list?query=dev949&limit=10`

Bu list qaytaradi.

Natija item:

```json
{
  "peer": "dev949",
  "external_id": "2142099363",
  "username": "dev949",
  "full_name": "A",
  "avatar_url": null,
  "existing_conversation_id": 1464
}
```

Search ranking:

1. exact username
2. existing conversation bor user
3. public avatar bor user
4. qolganlar

Query formatlari:

- `dev949`
- `@dev949`
- `https://t.me/dev949`
- `2142099363`

Cheklov:

- bu Telegram app searchning 100% copy si emas
- natijalar Telegram account contexti va privacy ga bog'liq

Frontend tavsiya:

- user typing qilganda `search-list`
- item bosilganda `peer` ni saqlang
- agar `existing_conversation_id` bo'lsa shu chatga o'ting
- bo'lmasa `telegram/start` bilan yangi chat oching

## 11. Telegram Start Conversation

Endpoint:

`POST /cognilabsai/chat/telegram/start`

Body:

```json
{
  "peer": "dev949",
  "text": "Assalomu Alaykum"
}
```

Natija:

- agar chat yo'q bo'lsa yangi `telegram` conversation yaratiladi
- operator message DB ga tushadi
- Telegram account nomidan userga yuboriladi
- chat `pause_reason=operator` holatida turadi

Frontend oqim:

1. search-list dan user tanlash
2. `peer` ni olib `telegram/start`
3. response ichidagi `conversation.id` bilan chat screenni ochish

## 12. Send Message

Endpoint:

`POST /cognilabsai/chat/send-message`

Body:

```json
{
  "conversation_id": 1464,
  "text": "Salom"
}
```

Behavior:

- Instagram bo'lsa operator takeover qiladi va message Instagramga yuboriladi
- Telegram bo'lsa operator message Telegram account nomidan yuboriladi
- har ikki holatda message DB ga saqlanadi
- operator identity saqlanadi

## 13. Pause / Resume

Pause:

`POST /cognilabsai/chat/pause`

Resume:

`POST /cognilabsai/chat/resume`

Timed pause:

`POST /cognilabsai/chat/pause-until`

Body:

```json
{
  "conversation_id": 123
}
```

Yoki timed pause:

```json
{
  "conversation_id": 123,
  "paused_until": "2026-04-29T18:00:00"
}
```

Frontend:

- faqat `supports_ai = true` chatlarda AI status tugmalarini ko'rsating
- Telegram chatlarda pause/resume UI ko'rsatish shart emas

## 14. CRM Lead Integratsiyasi

Instagram AI kerakli ma'lumotlarni to'plasa:

- `cognilabsai_conversation` ichida lead state saqlanadi
- `customer` jadvaliga lead yaratiladi
- `customer_note` yoziladi
- `crm_customer_id` conversationga bog'lanadi
- `chat_url` ga `/cognilabsai/chat?conversation_id=<id>` yoziladi

Frontend CRM ichida:

- `chat_url` bo'lsa alohida button bering
- `Open Chat` bosilganda CognilabsAI chat sahifasiga olib boring

## 15. Integrations

Endpointlar:

- `GET /cognilabsai/integrations`
- `PUT /cognilabsai/integrations`

Saqlanadigan qiymatlar:

- `openai_api_key`
- `openai_model`
- `openai_base_url`
- `system_prompt`
- `instagram_access_token`
- `instagram_business_id`
- `instagram_verify_token`
- `telegram_api_id`
- `telegram_api_hash`
- `telegram_session`
- `websocket_api_key`

Frontend:

- bu sahifani faqat `cognilabsai_integrations` permissionli user ko'rsin
- secret fieldlarni password input qilib ko'rsating

## 16. Webhook

Instagram verify:

`GET /cognilabsai/webhooks/instagram`

Instagram receive:

`POST /cognilabsai/webhooks/instagram`

Frontend bunga tegmaydi.

## 17. Tavsiya Qilingan Frontend Tuzilma

### Chat Sidebar

- filter tabs:
  - `All`
  - `Instagram`
  - `Telegram`
- har itemda:
  - avatar
  - full name yoki username
  - channel badge
  - `AI` badge faqat Instagramda
  - `Operator` badge Telegramda
  - last message
  - last message time

### Chat Header

- avatar
- title
- `channel`
- `chat_mode`
- `pause_reason`
- `last_operator_name`

### Composer

- Telegramda oddiy operator composer
- Instagramda operator composer + AI control buttonlar

### Telegram New Chat Modal

1. search input
2. `search-list` call
3. result list
4. avatar + username + full_name
5. existing conversation bo'lsa `Open`
6. bo'lmasa `Start chat`

## 18. Tavsiya Qilingan Frontend Qoidalar

- `supports_ai = false` bo'lsa AI bilan bog'liq barcha tugmalarni yashiring
- `chat_mode = telegram_operator` bo'lsa Telegram icon va operator badge ko'rsating
- `chat_mode = instagram_ai` bo'lsa Instagram icon va AI badge ko'rsating
- `client_avatar_url` bo'lmasa initials fallback ishlating
- websocket event kelganda conversation listni optimistic yangilang

## 19. Muhim Biznes Qoidalar

- Telegram hech qachon AI ga ulanmaydi
- Instagram AI ishlaydi
- operator yozgan har bir message da operator identity saqlanadi
- operator takeover bo'lsa Instagram AI pause bo'ladi
- Telegramda userga birinchi bo'lib yozish mumkin, lekin Telegram privacy restriction bo'lsa ba'zi userlarda cheklov bo'lishi mumkin

## 20. Tavsiya Qilingan Frontend Ishga Tushirish Oqimi

1. Login qiling
2. `GET /cognilabsai/integrations` bilan websocket key oling
3. `GET /cognilabsai/chat/conversations` bilan listni chizing
4. websocketni ulang
5. conversation bosilganda `GET /messages`
6. Telegram new chat uchun `search-list`
7. kerak bo'lsa `telegram/start`
8. oddiy yozish uchun `send-message`


