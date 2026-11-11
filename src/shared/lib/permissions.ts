import type { CurrentUser } from '../api/types'
import type { RbacModuleName, UserAccess } from '../api/services/rbac.service'
import { navigationItems, type NavigationAudience, type NavigationItem } from '../config/navigation'

/* ── RBAC ────────────────────────────────────────────────────────
   When /rbac/me answered, `effective_permissions` decides; the old
   role/page checks below are only a fallback for backends without RBAC. */

/** Which RBAC module guards a page (longest prefix wins). */
const moduleRoutes: Array<[prefix: string, module: RbacModuleName]> = [
  ['/ceo/dashboard', 'ceo'],
  ['/ceo/attendance', 'attendance'],
  ['/ceo/users', 'users'],
  ['/ceo/team-updates', 'monthly_updates'],
  ['/ceo/website-stats', 'site_statistics'],
  ['/ceo/management', 'management_api'],
  ['/crm/customers', 'customers'],
  ['/crm/archived', 'customers'],
  ['/crm/my-leads', 'customers'],
  ['/crm', 'crm'],
  ['/telephony', 'calls'],
  ['/projects', 'projects'],
  ['/boards', 'projects'],
  ['/faults', 'salary'],
  ['/developer-kpi', 'developer_kpi'],
  ['/cognilabsai/chat', 'ai_chat'],
  ['/cognilabsai/kanban', 'ai_kanban'],
  ['/cognilabsai/media-contexts', 'media_contexts'],
  ['/cognilabsai/integrations', 'ai_integrations'],
  ['/cognilabsai/comment-automation', 'instagram_comments'],
]

function matchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** RBAC module of a path: the backend navigation first (it knows its own routes), then the built-in map. */
export function moduleForPath(pathname: string, access?: UserAccess | null): RbacModuleName | null {
  const path = pathname.split(/[?#]/, 1)[0] || '/'
  let best: { module: string; length: number } | null = null
  for (const group of access?.navigation ?? []) {
    for (const item of group.items) {
      if (item.name && item.route_path !== '/' && matchesPrefix(path, item.route_path) && item.route_path.length > (best?.length ?? 0)) {
        best = { module: item.name, length: item.route_path.length }
      }
    }
  }
  for (const [prefix, module] of moduleRoutes) {
    if (matchesPrefix(path, prefix) && prefix.length > (best?.length ?? 0)) best = { module, length: prefix.length }
  }
  return best?.module ?? null
}

/** Pre-RBAC answer for a module (role + page permission map). */
function legacyModuleAccess(user: CurrentUser | null, module: RbacModuleName) {
  switch (module) {
    case 'crm':
    case 'customers':
      return hasPermission(user, 'crm')
    case 'calls':
      return canUseTelephony(user)
    case 'projects':
    case 'developer_kpi':
      return Boolean(user)
    case 'ai_chat':
    case 'ai_kanban':
    case 'media_contexts':
      return hasPermission(user, 'cognilabsai_chat')
    case 'ai_integrations':
    case 'instagram_comments':
      return hasPermission(user, 'cognilabsai_integrations')
    default:
      return hasPermission(user, 'ceo')
  }
}

/** True once /rbac/me has answered — from then on its permissions are the source of truth. */
export function hasRbacAccess(access: UserAccess | null | undefined): access is UserAccess {
  return Boolean(access)
}

/** Can the user perform `action` in `module`? */
export function canAccessModule(user: CurrentUser | null, access: UserAccess | null | undefined, module: RbacModuleName, action = 'view') {
  if (!user) return false
  if (hasRbacAccess(access)) return access.effective_permissions[module]?.includes(action) ?? false
  return legacyModuleAccess(user, module)
}

/** Page guard: RBAC decides for pages that belong to a module, the old rules for the rest. */
export function canOpenPath(user: CurrentUser | null, access: UserAccess | null | undefined, pathname: string) {
  const module = hasRbacAccess(access) ? moduleForPath(pathname, access) : null
  return module ? canAccessModule(user, access, module, 'view') : null
}

export function canReadManagedProjects(user: CurrentUser | null) {
  if (!user) {
    return false
  }

  return user.role === 'CEO' || user.role === 'Admin'
}

export function hasPermission(user: CurrentUser | null, permissionKey?: string) {
  if (!permissionKey) {
    return true
  }

  if (!user) {
    return false
  }

  if (user.role === 'CEO') {
    return true
  }

  return Boolean(user.permissions[permissionKey])
}

export function hasAudienceAccess(user: CurrentUser | null, audience?: NavigationAudience) {
  if (!audience) {
    return true
  }

  if (!user) {
    return false
  }

  if (audience === 'member') {
    return user.role !== 'CEO' && user.role !== 'Customer'
  }

  if (audience === 'sales_manager') {
    return user.role === 'SalesManager'
  }

  if (audience === 'telephony') {
    return canUseTelephony(user)
  }

  return true
}

export function canAccessNavigationItem(user: CurrentUser | null, item: Pick<NavigationItem, 'permissionKey' | 'audience'>) {
  return hasAudienceAccess(user, item.audience) && hasPermission(user, item.permissionKey)
}

/** Navigation item check that lets RBAC answer for module pages. */
function canUseNavigationItem(user: CurrentUser | null, access: UserAccess | null | undefined, item: NavigationItem) {
  return canOpenPath(user, access, item.to) ?? canAccessNavigationItem(user, item)
}

export function getAccessibleNavigation(user: CurrentUser | null, options?: { sidebarOnly?: boolean }) {
  const sidebarOnly = options?.sidebarOnly ?? false

  return navigationItems.filter((item) => {
    if (sidebarOnly && item.sidebar === false) {
      return false
    }

    return canAccessNavigationItem(user, item)
  })
}

function normalizePathname(pathname: string) {
  if (!pathname) {
    return '/'
  }

  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

export function canAccessPath(user: CurrentUser | null, destination: string, access?: UserAccess | null) {
  const normalizedDestination = normalizePathname(destination.split(/[?#]/, 1)[0] ?? '/')

  if (normalizedDestination.startsWith('/auth/')) {
    return !user
  }

  if (!user) {
    return false
  }

  const rbacAnswer = canOpenPath(user, access, normalizedDestination)
  if (rbacAnswer !== null) {
    return rbacAnswer
  }

  const item = navigationItems.find((entry) => normalizePathname(entry.to) === normalizedDestination)
  return item ? canAccessNavigationItem(user, item) : false
}

export function isSellerUser(user: CurrentUser | null) {
  return String(user?.role ?? '').trim().toLowerCase() === 'seller'
}

export function canUseTelephony(user: CurrentUser | null) {
  return user?.role === 'CEO' || isSellerUser(user)
}

export function getDefaultDashboardPath(user: CurrentUser | null, access?: UserAccess | null) {
  if (!user) {
    return '/auth/login'
  }

  if (isSellerUser(user) && canAccessPath(user, '/crm', access)) {
    return '/crm'
  }

  const candidate = navigationItems.find(
    (item) => item.defaultRedirect && canUseNavigationItem(user, access, item),
  )

  if (candidate) {
    return candidate.to
  }

  // With RBAC the first page of the user's own navigation is a safe landing page.
  const firstNavigationRoute = hasRbacAccess(access) ? access.navigation[0]?.items[0]?.route_path : undefined
  if (firstNavigationRoute) {
    return firstNavigationRoute
  }

  const fallback = navigationItems.find(
    (item) => !item.to.startsWith('/auth/') && canUseNavigationItem(user, access, item),
  )

  return fallback?.to ?? '/cims-team'
}

export function isKnownProtectedPath(pathname: string) {
  return navigationItems.some((item) => item.to === pathname)
}
