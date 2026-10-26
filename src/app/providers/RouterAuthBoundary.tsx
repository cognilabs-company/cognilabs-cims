import { Outlet } from 'react-router-dom'
import { AuthProvider } from '../../features/auth/context/AuthContext'

export function RouterAuthBoundary() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
