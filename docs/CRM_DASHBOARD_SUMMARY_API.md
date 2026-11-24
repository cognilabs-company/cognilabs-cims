# CRM "Savdo paneli" — backend talablari (task #667)

Frontend tayyor: `/crm` sahifasi endi "Savdo paneli". Hozircha raqamlar brauzerda hisoblanadi
(`src/features/crm/lib/salesPanel.ts`). Ular `/crm/dashboard`, `/crm/statuses/dynamic`,
`/crm/sales-managers`, `/crm/sales-managers/{id}/customers` va `/crm/customers/{id}/status-history`
javoblaridan olinadi. Bu vaqtinchalik yechim. Quyidagi endpoint chiqqach, frontend faqat shu bitta so'rovga o'tadi.

## 1. `GET /crm/dashboard/summary?period=7|30|90`

Qoidalar (frontend bilan bir xil bo'lishi shart):

- **Davr**: lidning `created_at` qiymati, Toshkent vaqti bo'yicha. Oxirgi N kun, bugun ham kiradi.
  Arxivlanganlar hisobga olinmaydi.
- **Voronka**: davrdagi lidlar hozirgi statusi bo'yicha, `/crm/statuses/dynamic` dagi `order` tartibida.
  10 ta statusning hammasi chiqadi, 0 bo'lsa ham.
- **Ochiq lid**: statusi `rejected` ham, `project_finished` ham bo'lmagan lid.
- **Uchrashuv+**: `meeting_scheduled`, `creating_kp_tz`, `payment_pending`, `project_started`, `project_finished`.
- **Yutilgan**: `project_started` + `project_finished`. Konversiya = yutilgan / davrdagi lidlar × 100.
- **Menejerlar**: faqat sales-manager biriktirishidan (`users`) olinadi. `assistant_name` ishlatilmaydi.
- **Manba**: Facebook Ads / Facebook ads / Meta Ads → `facebook_ads`; Instagram / instagram → `instagram`;
  Cognilabs AI chat → `ai_chat`.
- **Diqqat talab qiladi** (davrdan qat'i nazar, barcha ochiq lidlar):
  - `need_to_call`: 30 daqiqadan oshgan;
  - `meeting_scheduled`: oxirgi izoh 24 soatdan eski;
  - `creating_kp_tz`: 5 kundan oshgan;
  - `payment_pending`: 7 kundan oshgan.

  Muddat lid hozirgi statusga **kirgan vaqtdan** hisoblanadi.

Javob shakli (TS turi: `SalesPanelSummary`, `salesPanel.ts`):

```json
{
  "period": 30,
  "generated_at": "2026-11-20T05:00:00Z",
  "alert": {
    "no_leads_24h": false,
    "last_lead_at": "2026-11-19T17:54:00Z",
    "gaps": [{ "source": "facebook_ads", "from": "2026-10-29", "to": "2026-11-10", "days": 13 }]
  },
  "kpi": {
    "new_leads": 150, "new_leads_prev": 130,
    "first_response_median_minutes": 864, "responded_count": 41, "responded_within_5m": 1,
    "response_limit_minutes": 5,
    "open_leads": 45, "meeting_plus": 11, "won": 0, "won_amount": null, "conversion_percent": 0
  },
  "daily": [{ "date": "2026-10-22", "total": 9, "by_source": { "facebook_ads": 8, "ai_chat": 1 } }],
  "main_source": "facebook_ads",
  "funnel": [{ "status": "need_to_call", "count": 2, "percent": 1.3 }],
  "attention": [{ "id": 553, "name": "Nodir aka", "status": "payment_pending", "manager": "Muhammad Ali",
                  "source": "facebook_ads", "reason": "payment_7d", "since": "2026-11-11T09:00:00Z", "age_minutes": 12960 }],
  "today_plan": [{ "id": 601, "name": "Shuhrat", "status": "delayed", "manager": null, "source": "facebook_ads",
                   "recall_time": "2026-11-20T10:00:00Z", "time": "15:00" }],
  "managers": [{ "id": 11, "name": "Muhammad Ali", "assigned": 18, "first_response_median_minutes": 834,
                 "meeting_plus": 8, "in_meeting": 5, "kp_tz": 2, "payment_pending": 1, "won": 0, "stale_meetings": 2 },
               { "id": null, "name": "", "assigned": 45 }],
  "sources": [{ "source": "facebook_ads", "leads": 141, "meeting_plus": 10, "rejected": 98 }],
  "services": [{ "service": "ai", "leads": 61, "meeting_plus": 6 }],
  "rejection_reasons": { "total_rejected": 105, "with_reason": 70,
                          "items": [{ "key": "no_answer", "count": 42 }] },
  "hours": [5, 1, 0, "... 24 ta son"],
  "data_quality": { "duplicate_phones": 1, "duplicate_examples": [{ "phone": "+998901234567", "ids": [549, 553] }],
                    "apostrophe_phones": 8, "id_like_names": 15, "unassigned": 5, "platform_variants": 6,
                    "platform_values": ["Facebook Ads", "Facebook ads", "Meta Ads"], "rejected_without_reason": 148 }
}
```

`services` qiymatlari: `ai | crm_erp | mobile_web | other`. Ular formadagi "Xizmat" maydonidan olinadi
(hozir frontend `notes` va `aisummary` matnidan taxmin qilyapti).
`rejection_reasons.items[].key` qiymatlari: `no_answer | not_fit | by_mistake | solved_competitor | small_turnover | too_expensive | other`.

## 2. Ma'lumot tuzatishlari

1. **Mas'ul**: faqat `POST /crm/assign-sales-manager` (`user_id`). Erkin matnli maydon bo'lmasin.
2. **Rad sababi**: `status=rejected` bo'lsa, `rejection_reason` majburiy (400 qaytsin).
   Tanlov ro'yxati: Javob bermadi / Xizmat mos emas / Adashib qoldirgan / Hal bo'lgan yoki raqobatchi /
   Oboroti kichik / Narx qimmat / Boshqa (izoh bilan). Frontend dialogi shu ro'yxatga o'tkazildi. (#658)
3. **Bitim summasi**: lidga `deal_amount` (son, so'm) maydoni qo'shilsin. Panel uni o'qishga tayyor.
4. **Telefon**: saqlashda `+998XXXXXXXXX` ko'rinishiga keltirilsin (`'`, bo'sh joy va tire olib tashlansin).
   Raqam bazada bo'lsa, dublikat ogohlantirishi qaytsin. Mavjud yozuvlarni bir martalik migratsiya bilan tozalash kerak.
5. **Platforma**: yozishda normallashtirilsin ("Facebook Ads", "Instagram"). Eski yozuvlar uchun ham migratsiya kerak.
6. **Sheets importi**: `created_at` = formadagi "Sana: …", import vaqti emas
   (2-noyabrda 72 ta lid bir vaqtda tushgan).
