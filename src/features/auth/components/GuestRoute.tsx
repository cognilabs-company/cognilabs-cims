import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

type GuestRouteProps = {
  children?: ReactNode
}

export function GuestRoute({ children }: GuestRouteProps) {
  const { isAuthenticated, status } = useAuth()

  if (status === 'loading') {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard-redirect" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
