import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { translateCurrent } from '../../../shared/i18n/translations'
import { AppSplash } from '../../../shared/ui/loader'

type GuestRouteProps = {
  children?: ReactNode
}

export function GuestRoute({ children }: GuestRouteProps) {
  const { isAuthenticated, status } = useAuth()

  if (status === 'loading') {
    return <AppSplash title={translateCurrent('auth.splash.title', 'Cognilabs CIMS')} subtitle={translateCurrent('auth.splash.subtitle', 'Restoring your session…')} />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard-redirect" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
