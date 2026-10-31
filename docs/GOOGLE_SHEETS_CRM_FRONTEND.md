# Google Sheets Leads + Seller CRM

## Backend behavior

- Historical and realtime Google Sheets rows import into the existing primary CRM (`/crm`).
- Imported lead platform is `Facebook ads`.
- Sheet status mapping: `Yangi` -> `need_to_call`; `Rad etildi` -> `rejected`.
- Existing lead matching uses normalized phone. A match updates sheet-provided fields, but preserves its CRM status, platform, and seller assignment.
- Realtime sheet sync runs every 5 minutes. Row ledger prevents duplicates.
- When active `seller` users exist, new leads from every source are assigned round-robin. Without sellers, leads remain unassigned.
- A seller only receives their assigned primary CRM leads from backend. Backend is the access-control boundary; frontend must not fetch all leads and filter locally.

## Frontend requirements

1. In CEO user create/edit form, expose `seller` role from the roles API. Setting a user to this role grants primary CRM access. CEO assigns role; do not auto-create seller accounts.
2. Seller login uses the existing `/crm` page and normal CRM components. `GET /crm/dashboard` is paginated (`page`, `page_size`, max 50); response already contains only that seller's leads.
3. Keep existing search, status, archive, lead detail, notes, and stats UI. All requests must use the logged-in user's bearer token.
4. Handle `404` for a lead detail/update as unavailable/not found. Seller must not see another seller's customer via guessed IDs.
5. CEO and users explicitly granted primary CRM permission retain current broad CRM access.
6. Outbound CRM stays separate at `/crm2`; seller's primary CRM permission does not grant outbound access. CEO may grant `crm_outbound` separately through the permissions UI.
7. Imported `Facebook ads` is a normal platform filter value. Render `need_to_call` and `rejected` using existing status labels.

## Relevant APIs

- `GET /management/roles`: available roles, including `seller`.
- `POST /users/users` and `PATCH /users/users/{user_id}`: CEO creates/updates user role.
- `GET /users/users/{user_id}/permissions`: permission state for CEO UI.
- `PATCH /users/users/{user_id}/permissions`: CEO updates page permissions; `crm_outbound` is separate from `crm`.
- `GET /crm/dashboard?page=1&page_size=50`: primary CRM list; seller result is backend-scoped.
- `GET /crm/detail/{customer_id}`: customer details, ownership enforced server-side.

## Important

Do not show or invent a manual sheet-import button. Sync runs server-side. Existing import result: 73 rows linked, 72 new CRM leads, 1 matched existing lead; repeated polling creates no duplicates. No active sellers existed at deployment, so leads remain unassigned until CEO creates/assigns sellers.
