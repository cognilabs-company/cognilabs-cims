# Instagram Comment Automation: Frontend Contract

## Maqsad

CIMS > Cognilabs AI > Instagram izohlar sahifasida ulangan Instagram account post/reel’larini ko‘rsatish. Sozlamani bitta media’da alohida yoki tanlangan bir nechta media uchun umumiy qo‘llash mumkin.

## Ruxsat va URL

Barcha endpointlar CIMS login tokenini talab qiladi va `cognilabsai_integrations` permission bilan himoyalangan.

API prefix: `/cognilabsai/integrations/instagram/comment-automation`

## Media ro‘yxati va sync

`GET /media?refresh=true&limit=25`

Keyingi sahifa: `GET /media?refresh=true&limit=25&after={next_cursor}`

Cache’dan olish: `GET /media?refresh=false&limit=25`

Javob:

```json
{
  "items": [
    {
      "media_id": "17900000000000000",
      "instagram_account_id": "17841458518837994",
      "media_type": "VIDEO",
      "media_product_type": "REELS",
      "caption": "Post matni",
      "permalink": "https://www.instagram.com/reel/.../",
      "media_url": "https://...",
      "thumbnail_url": "https://...",
      "published_at": "2026-10-26T08:00:00",
      "comments_count": 12,
      "automation_enabled": false,
      "public_reply_enabled": true,
      "public_reply_mode": "ai",
      "public_reply_template": null,
      "dm_enabled": true,
      "dm_mode": "ai",
      "dm_template": null,
      "ai_instructions": null,
      "automation_stats": {
        "comments_received": 12,
        "public_replies_sent": 10,
        "private_replies_sent": 11,
        "needs_attention": 1
      }
    }
  ],
  "next_cursor": "...",
  "has_more": true,
  "synced_at": "2026-10-26T09:00:00"
}
```

Rasm preview uchun `thumbnail_url`, aks holda `media_url` ishlating. Media URL’lar Meta tomonidan yangilanishi mumkin; UI’da **Yangilash** tugmasi bo‘lsin. Yangi media’lar avtomatik javobni o‘zi yoqmaydi.

## Media sozlamasi

`PATCH /media/{media_id}`

Misol:

```json
{
  "automation_enabled": true,
  "public_reply_enabled": true,
  "public_reply_mode": "ai",
  "public_reply_template": null,
  "dm_enabled": true,
  "dm_mode": "template",
  "dm_template": "Assalomu alaykum, {username}! {post_caption} bo‘yicha batafsil ma’lumot kerakmi?",
  "ai_instructions": "Postdagi xizmat haqida qisqa aytib, javob yozishga taklif qil."
}
```

Maydonlar:

- `automation_enabled`: shu post/reel uchun avtomatlashtirishning asosiy yoqish/o‘chirish tugmasi. Default `false`.
- `public_reply_enabled`: izoh ostiga hammaga ko‘rinadigan javob.
- `public_reply_mode`: `ai` yoki `template`.
- `public_reply_template`: `template` rejimida ishlatiladi.
- `dm_enabled`: comment muallifiga private DM.
- `dm_mode`: `ai` yoki `template`.
- `dm_template`: `template` rejimida ishlatiladi.
- `ai_instructions`: AI rejimlaridagi ikkala javobga post bo‘yicha qo‘shimcha ko‘rsatma.

Template placeholder’lari: `{username}`, `{comment}`, `{post_caption}`. Har ikkala kanal o‘chiq bo‘lsa, automation’ni yoqishga API ruxsat bermaydi. Template rejimi yoqilgan bo‘lsa, template bo‘sh qolmasin.

UI’da har bir kartada main automation toggle, **Public javob** toggle/mode/editor, **DM** toggle/mode/editor, AI ko‘rsatmasi va **Saqlash** bo‘lsin. AI rejimida preview generativ javobning kafolati emas; template rejimida aynan kiritilgan matn yuboriladi. `automation_enabled=false` bo‘lganda hech qaysi javob yuborilmaydi.

## Bir nechta post/reel uchun umumiy sozlama

Kartalarda checkbox bo‘lsin. Tanlanganlar uchun bulk toolbar chiqarilsin: **Tanlanganlarni yoqish/o‘chirish**, **Umumiy javob sozlamasi**. Alohida karta sozlamasi ham ishlashda davom etadi.

Endpoint: `PATCH /media/bulk`

Misol: tanlangan post/reel’larda automation yoqish, public comment va DM’ni template rejimida bir xil matnga sozlash:

```json
{
  "media_ids": ["17900000000000000", "17900000000000001"],
  "automation_enabled": true,
  "public_reply_enabled": true,
  "public_reply_mode": "template",
  "public_reply_template": "Rahmat, {username}! Sizga DM orqali batafsil yozdik.",
  "dm_enabled": true,
  "dm_mode": "template",
  "dm_template": "Assalomu alaykum, {username}! {post_caption} haqida ma’lumot kerakmi?",
  "ai_instructions": "Javobni qisqa va xushmuomala yoz."
}
```

`media_ids` — oldin media ro‘yxatida sinxronlangan media ID’lari; 1–5000 ta yuborish mumkin. Sozlama faqat shu ID’larga qo‘llanadi. Javob matni, rejimlar, kanallar va automation toggle tanlanganlarning barchasiga bir xil qo‘llanadi. Boshqa yuborilmagan maydonlar har bir media’da avvalgi qiymatida qoladi. API hammasini tekshiradi: tanlanganlardan biri topilmasa yoki yoqilgan template bo‘sh bo‘lsa, hech biri o‘zgarmaydi. Muvaffaqiyatli javob:

```json
{
  "updated_count": 2,
  "items": [{ "media_id": "17900000000000000", "automation_enabled": true }]
}
```

Javobdagi `items` to‘liq media obyektlari bo‘ladi; qisqa ko‘rinish yuqorida faqat misol. `PATCH /media/{media_id}` bitta media’ni alohida tahrirlash uchun saqlanadi.

**Barchasini tanlash** uchun media pagination sahifalarini `next_cursor` tugaguncha yuklang, so‘ng barcha tanlangan ID’larni bitta bulk request’da yuboring. 5000 dan ko‘p media bo‘lsa, frontend bo‘laklab yuborishi mumkin; har bir bo‘lak alohida atomik saqlanadi, xatoda qaysi bo‘lak muvaffaqiyatsiz bo‘lganini ko‘rsating. “Faqat joriy sahifani tanlash” va “barcha post/reel’ni tanlash” amallarini UI’da farqlang.

Bulk yoqish ham `automation_enabled=true` bo‘lgan har bir media uchun kamida bitta javob kanali yoqilganini va aktiv template matni bo‘sh emasligini talab qiladi. Validatsiya xatosida backend `422` qaytaradi; UI xabarni ko‘rsatib, o‘zgarish saqlanmaganini bildirsin.

## Comment yuborish tarixi

`GET /events?media_id={media_id}&status={status}&limit=50&offset=0`

Event holatlari:

- `received` / `processing`: navbatda yoki ishlanyapti.
- `sent`: yoqilgan public va/yoki DM amallari muvaffaqiyatli.
- `partial`: kanallardan biri yuborildi, ikkinchisi xato berdi.
- `failed`: yuborish rad etildi yoki generation muvaffaqiyatsiz.
- `unknown`: network uzilishi sabab Meta qabul qilgan-qilmagani noma’lum; avtomatik qayta yuborilmaydi.
- `skipped`: post automation o‘chiq yoki javob kanali tanlanmagan.

Har event’da `comment_id`, `sender_id`, `sender_username`, `comment_text`, `public_reply_status`, `public_reply_text`, `public_reply_message_id`, `public_reply_error`, `dm_status`, `dm_text`, `dm_message_id`, `dm_error`, `created_at`, `sent_at` maydonlarini ko‘rsating. `failed` va `unknown` holatlarini ko‘zga tashlanadigan qiling; `unknown` uchun avtomatik retry tugmasi qo‘ymang.

## Muhim Meta qoidalari

Private reply comment ID orqali yuboriladi, avval chat bo‘lishi shart emas. Bitta comment uchun faqat bitta private reply va commentdan keyin 7 kunlik muddat bor; Live comment istisno. Account’ni follow qilmaydigan foydalanuvchida DM **Message Requests** ga tushishi mumkin. User javob bermaguncha keyingi DM yuborilmaydi. [Meta Private Replies](https://developers.facebook.com/docs/instagram-platform/private-replies)

Public comment reply va private DM alohida action hisoblanadi: birining xatosi ikkinchisini to‘xtatmasin. Ulangan Meta app’da comment webhook field va comment/message permissions yoqilganini tekshiring. Instagram Login uchun odatda `instagram_business_manage_comments`, `instagram_business_manage_messages`; Facebook Login’da tegishli `instagram_manage_comments`, `instagram_manage_messages` va Page permission talab qilinadi. [Meta Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
