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
    <div className="grid min-h-[50vh] place-items-center p-[18px]">
      <div className="w-full max-w-md rounded-[24px] bg-[var(--surface)] p-[22px] text-center">
        <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--blue-dim)]">
          <svg className="h-5 w-5 animate-spin text-[var(--primary)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--caption)]">{translateCurrent('auth.protected.session', 'Session')}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">{translateCurrent('auth.protected.verifying', 'Verifying credentials')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
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
