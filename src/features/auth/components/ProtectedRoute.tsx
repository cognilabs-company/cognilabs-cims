import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { translateCurrent } from '../../../shared/i18n/translations'
import { useAuth } from '../hooks/useAuth'
import { AppSplash } from '../../../shared/ui/loader'
import type { NavigationAudience } from '../../../shared/config/navigation'
import { hasAudienceAccess } from '../../../shared/lib/permissions'

type ProtectedRouteProps = {
  permissionKey?: string
  audience?: NavigationAudience
  children?: ReactNode
}

function LoadingState() {
  return (
    <AppSplash
      title={translateCurrent('auth.splash.title', 'Cognilabs CIMS')}
      subtitle={translateCurrent('auth.splash.subtitle', 'Restoring your session…')}
    />
  )
}

export function ProtectedRoute({ permissionKey, audience, children }: ProtectedRouteProps) {
  const location = useLocation()
  const { hasPermission, isAuthenticated, status, user } = useAuth()

  if (status === 'loading') {
    return <LoadingState />
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
          statusMessage: translateCurrent('auth.protected.session_expired', 'Session expired or not found. Please log in again.'),
        }}
      />
    )
  }

  if (permissionKey && !hasPermission(permissionKey)) {
    return <Navigate to="/dashboard-redirect" replace />
  }

  if (audience && !hasAudienceAccess(user, audience)) {
    return <Navigate to="/dashboard-redirect" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
