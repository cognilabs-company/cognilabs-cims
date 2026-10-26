import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { translateCurrent } from '../../../shared/i18n/translations'
import { useAuth } from '../hooks/useAuth'
import type { NavigationAudience } from '../../../shared/config/navigation'
import { hasAudienceAccess } from '../../../shared/lib/permissions'

type ProtectedRouteProps = {
  permissionKey?: string
  audience?: NavigationAudience
  children?: ReactNode
}

function LoadingState() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 p-8 text-center backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-500">{translateCurrent('auth.protected.session', 'Session')}</p>
        <h2 className="mt-4 text-2xl font-bold text-white tracking-tight">{translateCurrent('auth.protected.verifying', 'Verifying credentials')}</h2>
        <p className="mt-4 text-sm font-medium leading-relaxed text-zinc-500">
          {translateCurrent('auth.protected.description', 'Validating access tokens, refresh flow, and user permissions.')}
        </p>
      </div>
    </div>
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
