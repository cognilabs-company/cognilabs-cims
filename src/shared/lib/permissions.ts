import type { CurrentUser } from '../api/types'
import { navigationItems, type NavigationAudience, type NavigationItem } from '../config/navigation'

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

  return true
}

export function canAccessNavigationItem(user: CurrentUser | null, item: Pick<NavigationItem, 'permissionKey' | 'audience'>) {
  return hasAudienceAccess(user, item.audience) && hasPermission(user, item.permissionKey)
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

export function canAccessPath(user: CurrentUser | null, destination: string) {
  const normalizedDestination = normalizePathname(destination.split(/[?#]/, 1)[0] ?? '/')

  if (normalizedDestination.startsWith('/auth/')) {
    return !user
  }

  if (!user) {
    return false
  }

  const item = navigationItems.find((entry) => normalizePathname(entry.to) === normalizedDestination)
  return item ? canAccessNavigationItem(user, item) : false
}

export function getDefaultDashboardPath(user: CurrentUser | null) {
  if (!user) {
    return '/auth/login'
  }

  const candidate = navigationItems.find(
    (item) => item.defaultRedirect && canAccessNavigationItem(user, item),
  )

  if (candidate) {
    return candidate.to
  }

  const fallback = navigationItems.find(
    (item) => !item.to.startsWith('/auth/') && canAccessNavigationItem(user, item),
  )

  return fallback?.to ?? '/cims-team'
}

export function isKnownProtectedPath(pathname: string) {
  return navigationItems.some((item) => item.to === pathname)
}
