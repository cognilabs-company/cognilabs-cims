import {
  createContext,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { authService } from '../../../shared/api/services/auth.service'
import { rbacService, type RbacModuleName, type UserAccess } from '../../../shared/api/services/rbac.service'
import type { CurrentUser, TokenResponse } from '../../../shared/api/types'
import {
  canAccessModule,
  canAccessPath,
  getDefaultDashboardPath,
  hasPermission as canAccess,
  isKnownProtectedPath,
  isSellerUser,
} from '../../../shared/lib/permissions'
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from '../../../shared/lib/session'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type LogoutScope = 'current' | 'all'

type AuthContextValue = {
  user: CurrentUser | null
  /** /rbac/me — role, effective permissions and navigation; null when the backend has no RBAC. */
  access: UserAccess | null
  /** RBAC check: can the user do `action` (default "view") in `module`? */
  can: (module: RbacModuleName, action?: string) => boolean
  refreshAccess: () => Promise<UserAccess | null>
  status: AuthStatus
  isAuthenticated: boolean
  isReady: boolean
  isRefreshingUser: boolean
  acceptTokens: (tokens: TokenResponse) => Promise<CurrentUser | null>
  refreshUser: () => Promise<CurrentUser | null>
  logout: (scope?: LogoutScope) => Promise<void>
  hasPermission: (permissionKey?: string) => boolean
  getDefaultPath: () => string
  resolveDashboardPath: () => Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const legacyRedirectMap: Record<string, string> = {
  '/ceo': '/ceo/dashboard',
  '/overview': '/crm',
  '/finance': '/crm',
}

function stripTrailingSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname
}

function normalizeRedirectPath(redirectUrl: string | null | undefined) {
  if (!redirectUrl?.trim()) {
    return null
  }

  try {
    const normalized = redirectUrl.startsWith('http')
      ? new URL(redirectUrl)
      : new URL(redirectUrl, 'http://cims.local')

    const pathname = stripTrailingSlash(normalized.pathname)
    const mappedPathname = legacyRedirectMap[pathname] ?? pathname

    if (
      mappedPathname !== '/' &&
      !mappedPathname.startsWith('/auth/') &&
      !isKnownProtectedPath(mappedPathname)
    ) {
      return null
    }

    return `${mappedPathname}${normalized.search}${normalized.hash}`
  } catch {
    if (!redirectUrl.startsWith('/')) {
      return null
    }

    const pathname = stripTrailingSlash(redirectUrl)
    const mappedPathname = legacyRedirectMap[pathname] ?? pathname

    if (
      mappedPathname !== '/' &&
      !mappedPathname.startsWith('/auth/') &&
      !isKnownProtectedPath(mappedPathname)
    ) {
      return null
    }

    return mappedPathname
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => {
    return getAccessToken() || getRefreshToken() ? 'loading' : 'anonymous'
  })
  const [isRefreshingUser, setIsRefreshingUser] = useState(false)

  const refreshUser = useCallback(async () => {
    setIsRefreshingUser(true)

    try {
      // Permissions load together with the user, so guards never decide on half the data.
      const [currentUser, currentAccess] = await Promise.all([
        authService.me(),
        rbacService.me().catch(() => null),
      ])
      setUser(currentUser)
      setAccess(currentAccess)
      setStatus('authenticated')

      return currentUser
    } catch {
      clearSession()
      setUser(null)
      setAccess(null)
      setStatus('anonymous')
      return null
    } finally {
      setIsRefreshingUser(false)
    }
  }, [])

  useEffect(() => {
    async function initializeAuth() {
      const accessToken = getAccessToken()
      const refreshToken = getRefreshToken()

      if (!accessToken && !refreshToken) {
        setUser(null)
        setStatus('anonymous')
        return
      }

      await refreshUser()
    }

    void initializeAuth()
  }, [refreshUser])

  const acceptTokens = useCallback(async (tokens: TokenResponse) => {
    setSessionTokens(tokens)
    setStatus('loading')

    return refreshUser()
  }, [refreshUser])

  const logout = useCallback(async (scope: LogoutScope = 'current') => {
    try {
      if (scope === 'all') {
        await authService.logoutAll()
      } else {
        const refreshToken = getRefreshToken()

        if (refreshToken) {
          await authService.logout(refreshToken)
        }
      }
    } catch {
      // Session cleanup still needs to happen locally even if server logout fails.
    } finally {
      clearSession()
      setUser(null)
      setAccess(null)
      startTransition(() => setStatus('anonymous'))
    }
  }, [])

  const hasPermission = useCallback((permissionKey?: string) => {
    return canAccess(user, permissionKey)
  }, [user])

  const refreshAccess = useCallback(async () => {
    const next = await rbacService.me().catch(() => null)
    setAccess(next)
    return next
  }, [])

  const can = useCallback((module: RbacModuleName, action = 'view') => canAccessModule(user, access, module, action), [access, user])

  const getDefaultPath = useCallback(() => {
    return getDefaultDashboardPath(user, access)
  }, [access, user])

  const resolveDashboardPath = useCallback(async () => {
    const fallbackPath = getDefaultDashboardPath(user, access)

    if (fallbackPath === '/updates' || fallbackPath === '/member/dashboard' || (isSellerUser(user) && fallbackPath === '/crm')) {
      return fallbackPath
    }

    try {
      const response = await authService.dashboardRedirect()
      const normalizedPath = normalizeRedirectPath(response.redirect_url)

      if (!normalizedPath || normalizedPath === '/' || normalizedPath === '/dashboard-redirect') {
        return fallbackPath
      }

      return canAccessPath(user, normalizedPath, access) ? normalizedPath : fallbackPath
    } catch {
      return fallbackPath
    }
  }, [access, user])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    access,
    can,
    refreshAccess,
    status,
    isAuthenticated: status === 'authenticated',
    isReady: status !== 'loading',
    isRefreshingUser,
    acceptTokens,
    refreshUser,
    logout,
    hasPermission,
    getDefaultPath,
    resolveDashboardPath,
  }), [
    access,
    can,
    refreshAccess,
    acceptTokens,
    getDefaultPath,
    hasPermission,
    isRefreshingUser,
    logout,
    refreshUser,
    resolveDashboardPath,
    status,
    user,
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
