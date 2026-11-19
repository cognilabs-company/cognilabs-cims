import { request } from '../http'

/* Access vault — company passwords and accesses kept in CIMS (/access-vault).
   The list never carries the secret itself: it is fetched with POST /{id}/reveal, which the backend
   writes to the audit log. Who may reveal an item is decided by its grants (PUT /{id}/grants). */

export type VaultGrantee = { id: number; name: string }

export type VaultItem = {
  id: number
  title: string
  category: string
  login: string | null
  url: string | null
  notes: string | null
  isActive: boolean
  grantees: VaultGrantee[]
  /** False when the answer has no grants at all — the list (GET /access-vault) never sends them, only the
      CEO detail (GET /access-vault/{id}) does — so an empty `grantees` means "unknown", not "nobody".
      PUT /{id}/grants replaces the whole list. */
  granteesKnown: boolean
  createdByName: string | null
  createdAt: string | null
  updatedAt: string | null
  lastRevealedAt: string | null
  /** False when the backend says the current user may see the entry but not open the secret. */
  canReveal: boolean
  canManage: boolean
}

export type VaultAuditEntry = {
  id: string
  itemId: number | null
  itemTitle: string | null
  action: string
  userName: string | null
  purpose: string | null
  at: string | null
}

export type VaultItemPayload = {
  title: string
  category: string
  login: string | null
  secret?: string
  url: string | null
  notes: string | null
  granted_user_ids?: number[]
  is_active?: boolean
}

type Loose = Record<string, unknown>

const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value : typeof value === 'number' ? String(value) : null)
const num = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function listOf(value: unknown, keys = ['items', 'results', 'data', 'entries', 'logs']): unknown[] {
  if (Array.isArray(value)) return value
  if (isObject(value)) for (const key of keys) if (Array.isArray(value[key])) return value[key] as unknown[]
  return []
}

function personName(value: unknown): string | null {
  if (!isObject(value)) return str(value)
  const full = str(value.full_name) ?? str(value.name && value.surname ? `${value.name} ${value.surname}` : null) ?? str(value.name) ?? str(value.user_name) ?? str(value.email)
  return full
}

function normalizeGrantees(item: Loose): VaultGrantee[] {
  const out = new Map<number, VaultGrantee>()
  for (const entry of listOf(item.grants ?? item.granted_users ?? item.users ?? [], ['items'])) {
    if (!isObject(entry)) continue
    const id = num(entry.user_id ?? entry.id)
    if (id === null) continue
    out.set(id, { id, name: personName(entry.user ?? entry) ?? `#${id}` })
  }
  for (const raw of Array.isArray(item.granted_user_ids) ? item.granted_user_ids : []) {
    const id = num(raw)
    if (id !== null && !out.has(id)) out.set(id, { id, name: `#${id}` })
  }
  return [...out.values()]
}

export function normalizeVaultItem(raw: unknown): VaultItem | null {
  if (!isObject(raw)) return null
  const item = isObject(raw.item) ? raw.item : raw
  const id = num(item.id)
  if (id === null) return null
  return {
    id,
    title: str(item.title) ?? str(item.name) ?? `#${id}`,
    category: str(item.category) ?? 'other',
    login: str(item.login) ?? str(item.username),
    url: str(item.url),
    notes: str(item.notes),
    isActive: item.is_active !== false,
    grantees: normalizeGrantees(item),
    granteesKnown: ['grants', 'granted_users', 'users', 'granted_user_ids'].some((key) => Array.isArray(item[key])),
    createdByName: personName(item.created_by_user ?? item.owner) ?? str(item.created_by_name) ?? str(item.created_by_full_name),
    createdAt: str(item.created_at),
    updatedAt: str(item.updated_at),
    lastRevealedAt: str(item.last_revealed_at) ?? str(item.last_accessed_at),
    canReveal: item.can_reveal !== false,
    canManage: item.can_manage !== false && item.can_edit !== false,
  }
}

function normalizeAudit(raw: unknown, index: number): VaultAuditEntry | null {
  if (!isObject(raw)) return null
  return {
    id: str(raw.id) ?? `audit-${index}`,
    itemId: num(raw.item_id),
    itemTitle: str(raw.item_title) ?? (isObject(raw.item) ? str(raw.item.title) : null),
    action: str(raw.action) ?? str(raw.event) ?? 'view',
    userName: personName(raw.user) ?? str(raw.user_name) ?? str(raw.user_full_name) ?? str(raw.actor_name),
    purpose: str(raw.purpose) ?? str(raw.reason),
    at: str(raw.created_at) ?? str(raw.at) ?? str(raw.timestamp),
  }
}

/** The secret from a reveal answer ({secret}, {value}, {password}, or {item:{secret}}). */
function revealedSecret(raw: unknown): { secret: string; login: string | null } {
  if (typeof raw === 'string') return { secret: raw, login: null }
  if (!isObject(raw)) return { secret: '', login: null }
  const inner = isObject(raw.item) ? raw.item : raw
  return {
    secret: str(inner.secret) ?? str(inner.value) ?? str(inner.password) ?? str(raw.secret) ?? '',
    login: str(inner.login) ?? null,
  }
}

export const accessVaultService = {
  async list(params: { search?: string; category?: string; includeInactive?: boolean } = {}) {
    // The API pages by 50; read the pages one after another (a vault is small, a few pages at most).
    const pageSize = 50
    const all: VaultItem[] = []
    for (let page = 1; page <= 20; page += 1) {
      const raw = await request<unknown>({
        path: '/access-vault',
        query: { search: params.search || undefined, category: params.category || undefined, include_inactive: params.includeInactive || undefined, page, page_size: pageSize },
      })
      const batch = listOf(raw).map(normalizeVaultItem).filter((item): item is VaultItem => item !== null)
      all.push(...batch.filter((item) => !all.some((known) => known.id === item.id)))
      const total = isObject(raw) ? num(raw.total) ?? num(raw.total_count) : null
      if (batch.length < pageSize || (total !== null && all.length >= total)) break
    }
    return all
  },

  /** CEO detail: the only answer that carries `granted_user_ids`. */
  async get(id: number) {
    const item = normalizeVaultItem(await request<unknown>({ path: `/access-vault/${id}` }))
    if (!item) throw new Error('Empty access-vault item')
    return item
  },

  async create(payload: VaultItemPayload) {
    return normalizeVaultItem(await request<unknown>({ path: '/access-vault', method: 'POST', body: { metadata: {}, granted_user_ids: [], ...payload } }))
  },

  async update(id: number, payload: Partial<VaultItemPayload>) {
    const { granted_user_ids: _ignored, ...body } = payload
    void _ignored
    return normalizeVaultItem(await request<unknown>({ path: `/access-vault/${id}`, method: 'PATCH', body }))
  },

  remove(id: number) {
    return request<unknown>({ path: `/access-vault/${id}`, method: 'DELETE' })
  },

  setGrants(id: number, userIds: number[]) {
    return request<unknown>({ path: `/access-vault/${id}/grants`, method: 'PUT', body: { user_ids: userIds } })
  },

  async reveal(id: number, purpose?: string) {
    return revealedSecret(await request<unknown>({ path: `/access-vault/${id}/reveal`, method: 'POST', body: { purpose: purpose || null } }))
  },

  async audit(itemId?: number, limit = 100) {
    const raw = await request<unknown>({ path: '/access-vault/audit', query: { item_id: itemId, limit } })
    return listOf(raw).map(normalizeAudit).filter((entry): entry is VaultAuditEntry => entry !== null)
  },
}
