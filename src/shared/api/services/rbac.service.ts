import { request } from '../http'

/* ──────────────────────────────────────────────────────────────
   Role-based access control (RBAC) — /rbac/*
   Contract: RBAC_TELEPHONY_FRONTEND.md. Responses of catalog, roles and
   users are not typed in the OpenAPI schema, so every reader below accepts
   the few shapes a FastAPI backend usually returns and normalises them.
   ────────────────────────────────────────────────────────────── */

export const RBAC_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const
export type RbacAction = (typeof RBAC_ACTIONS)[number]

export const RBAC_MODULES = [
  'ceo', 'crm', 'customers', 'calls', 'projects', 'attendance', 'users', 'monthly_updates', 'salary', 'developer_kpi',
  'ai_chat', 'ai_kanban', 'media_contexts', 'ai_integrations', 'instagram_comments', 'site_statistics', 'management_api',
] as const
export type RbacModuleName = (typeof RBAC_MODULES)[number] | (string & {})

/** module → allowed actions */
export type PermissionSet = Record<string, string[]>
export type PermissionSelection = { module: string; actions: string[] }

export type RbacNavItem = {
  name: string
  display_name: string
  route_path: string
  icon: string | null
  actions: string[]
}

export type RbacNavGroup = { group: string; items: RbacNavItem[] }

export type UserAccess = {
  user_id: number
  email: string
  role_id: number | null
  role_name: string | null
  role_display_name: string | null
  role_permissions: PermissionSet
  direct_permissions: PermissionSet
  effective_permissions: PermissionSet
  navigation: RbacNavGroup[]
  /** Extra fields some list endpoints add (name, owner flag…). */
  full_name: string | null
  is_owner: boolean
}

export type RbacCatalogModule = {
  name: string
  display_name: string
  group: string | null
  route_path: string | null
  actions: string[]
}

export type RbacCatalog = { modules: RbacCatalogModule[]; actions: string[] }

export type RbacRole = {
  id: number
  name: string
  display_name: string
  description: string | null
  is_active: boolean
  /** System roles (CEO) can't be edited or deleted. */
  is_system: boolean
  permissions: PermissionSet
  user_count: number | null
}

export type RoleCreatePayload = { name: string; display_name: string; description?: string | null; permissions: PermissionSelection[] }
export type RoleUpdatePayload = { display_name?: string; description?: string | null; is_active?: boolean; permissions?: PermissionSelection[] }
export type UserAccessPayload = { role_id?: number | null; direct_permissions?: PermissionSelection[] }

/* ── normalisers ─────────────────────────────────────────────── */

type Loose = Record<string, unknown>

const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null && !Array.isArray(value)
const asString = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value))
const asStringOrNull = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)
const asStrings = (value: unknown) => (Array.isArray(value) ? value.map(asString).filter(Boolean) : [])

/** First array found in `value` itself or under one of `keys`. */
function listOf(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value
  if (isObject(value)) {
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key] as unknown[]
    }
  }
  return []
}

/** `{crm: ["view"]}`, `[{module: "crm", actions: ["view"]}]` or `[{module_name, action}]` → `{crm: ["view"]}`. */
export function normalizePermissions(raw: unknown): PermissionSet {
  const result: PermissionSet = {}
  const add = (rawModule: string, rawActions: string[]) => {
    const module = rawModule.trim().toLowerCase()
    if (!module) return
    const actions = rawActions.map((action) => action.trim().toLowerCase()).filter(Boolean)
    const current = result[module] ?? []
    result[module] = [...new Set([...current, ...actions])]
  }
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!isObject(entry)) continue
      const module = asString(entry.module ?? entry.module_name ?? entry.name)
      const actions = Array.isArray(entry.actions) ? asStrings(entry.actions) : entry.action ? [asString(entry.action)] : []
      add(module, actions)
    }
  } else if (isObject(raw)) {
    for (const [module, actions] of Object.entries(raw)) {
      if (Array.isArray(actions)) add(module, asStrings(actions))
      else if (actions === true) add(module, [...RBAC_ACTIONS])
    }
  }
  return result
}

export function toSelections(set: PermissionSet): PermissionSelection[] {
  return Object.entries(set)
    .filter(([, actions]) => actions.length > 0)
    .map(([module, actions]) => ({ module, actions: [...actions] }))
}

function normalizeNavigation(raw: unknown): RbacNavGroup[] {
  return listOf(raw, ['navigation', 'groups']).flatMap((entry) => {
    if (!isObject(entry)) return []
    const items = listOf(entry.items, []).flatMap((item) => {
      if (!isObject(item)) return []
      const route = asString(item.route_path ?? item.path ?? item.route)
      if (!route) return []
      return [{
        name: asString(item.name ?? item.module).trim().toLowerCase(),
        display_name: asString(item.display_name ?? item.label ?? item.name),
        route_path: route.startsWith('/') ? route : `/${route}`,
        icon: asStringOrNull(item.icon),
        actions: asStrings(item.actions).map((action) => action.toLowerCase()),
      }]
    })
    return items.length ? [{ group: asString(entry.group ?? entry.name ?? entry.title), items }] : []
  })
}

export function normalizeUserAccess(raw: unknown): UserAccess {
  const data = isObject(raw) ? raw : {}
  const user = isObject(data.user) ? data.user : {}
  const role = isObject(data.role) ? data.role : {}
  const name = [asString(data.name ?? user.name), asString(data.surname ?? user.surname)].filter(Boolean).join(' ')
  return {
    user_id: Number(data.user_id ?? data.id ?? user.id ?? 0),
    email: asString(data.email ?? user.email),
    role_id: data.role_id != null ? Number(data.role_id) : role.id != null ? Number(role.id) : null,
    role_name: asStringOrNull(data.role_name ?? role.name),
    role_display_name: asStringOrNull(data.role_display_name ?? role.display_name),
    role_permissions: normalizePermissions(data.role_permissions ?? role.permissions),
    direct_permissions: normalizePermissions(data.direct_permissions),
    effective_permissions: normalizePermissions(data.effective_permissions),
    navigation: normalizeNavigation(data.navigation),
    full_name: asStringOrNull(data.full_name ?? user.full_name) ?? (name || null),
    is_owner: Boolean(data.is_owner ?? data.owner ?? user.is_owner),
  }
}

export function normalizeCatalog(raw: unknown): RbacCatalog {
  const data = isObject(raw) ? raw : {}
  let modules: RbacCatalogModule[] = []
  const rawModules = Array.isArray(raw) ? raw : data.modules
  if (Array.isArray(rawModules)) {
    modules = rawModules.flatMap((entry) => {
      if (typeof entry === 'string') return [{ name: entry, display_name: entry, group: null, route_path: null, actions: [] }]
      if (!isObject(entry)) return []
      const name = asString(entry.name ?? entry.module ?? entry.key)
      return name ? [{
        name,
        display_name: asString(entry.display_name ?? entry.label ?? name),
        group: asStringOrNull(entry.group),
        route_path: asStringOrNull(entry.route_path ?? entry.path),
        actions: asStrings(entry.actions),
      }] : []
    })
  } else if (isObject(rawModules)) {
    modules = Object.entries(rawModules).map(([name, value]) => ({
      name,
      display_name: isObject(value) ? asString(value.display_name ?? name) : name,
      group: isObject(value) ? asStringOrNull(value.group) : null,
      route_path: isObject(value) ? asStringOrNull(value.route_path) : null,
      actions: Array.isArray(value) ? asStrings(value) : isObject(value) ? asStrings(value.actions) : [],
    }))
  }
  if (modules.length === 0) modules = RBAC_MODULES.map((name) => ({ name, display_name: name, group: null, route_path: null, actions: [] }))
  const actions = asStrings(data.actions)
  return { modules, actions: actions.length ? actions : [...RBAC_ACTIONS] }
}

export function normalizeRole(raw: unknown): RbacRole {
  const data = isObject(raw) ? raw : {}
  const name = asString(data.name)
  const users = data.user_count ?? data.users_count ?? data.assigned_users_count
  return {
    id: Number(data.id ?? data.role_id ?? 0),
    name,
    display_name: asString(data.display_name ?? name),
    description: asStringOrNull(data.description),
    is_active: data.is_active !== false,
    is_system: Boolean(data.is_system ?? data.is_protected ?? data.is_owner ?? name.toLowerCase() === 'ceo'),
    permissions: normalizePermissions(data.permissions ?? data.role_permissions),
    user_count: typeof users === 'number' ? users : Array.isArray(data.users) ? data.users.length : null,
  }
}

export const rbacService = {
  async me() {
    return normalizeUserAccess(await request<unknown>({ path: '/rbac/me' }))
  },
  async catalog() {
    return normalizeCatalog(await request<unknown>({ path: '/rbac/catalog' }))
  },
  async roles() {
    return listOf(await request<unknown>({ path: '/rbac/roles' }), ['items', 'roles', 'data']).map(normalizeRole)
  },
  async createRole(payload: RoleCreatePayload) {
    return normalizeRole(await request<unknown>({ path: '/rbac/roles', method: 'POST', body: payload }))
  },
  async updateRole(roleId: number, payload: RoleUpdatePayload) {
    return normalizeRole(await request<unknown>({ path: `/rbac/roles/${roleId}`, method: 'PATCH', body: payload }))
  },
  async cloneRole(roleId: number, payload: { name: string; display_name: string }) {
    return normalizeRole(await request<unknown>({ path: `/rbac/roles/${roleId}/clone`, method: 'POST', body: payload }))
  },
  deleteRole(roleId: number) {
    return request<unknown>({ path: `/rbac/roles/${roleId}`, method: 'DELETE' })
  },
  async users() {
    return listOf(await request<unknown>({ path: '/rbac/users' }), ['items', 'users', 'data']).map(normalizeUserAccess)
  },
  async user(userId: number) {
    return normalizeUserAccess(await request<unknown>({ path: `/rbac/users/${userId}` }))
  },
  /** PATCH: omit `direct_permissions` to change only the role; send `[]` to clear overrides. */
  async updateUser(userId: number, payload: UserAccessPayload) {
    return normalizeUserAccess(await request<unknown>({ path: `/rbac/users/${userId}`, method: 'PATCH', body: payload }))
  },
}
