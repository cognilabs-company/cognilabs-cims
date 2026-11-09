import type { CSSProperties } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAppShell } from '../hooks/useAppShell'
import { AppShellProvider } from '../providers/AppShellProvider'
import { AppHeader } from '../../widgets/navigation/AppHeader'
import { AppSidebar } from '../../widgets/navigation/AppSidebar'
import { CimsAiLauncher } from '../../widgets/ai/CimsAiLauncher'
import { TelephonyProvider } from '../../features/telephony/TelephonyProvider'

function RootLayoutFrame() {
  const { isSidebarCollapsed } = useAppShell()
  const location = useLocation()
  const shellStyle = {
    '--app-shell-sidebar-width': isSidebarCollapsed ? '0px' : 'var(--sidebar-w)',
  } as CSSProperties

  return (
    <div className="app-shell-grid" style={shellStyle}>
      <AppSidebar />
      <div className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[var(--app-canvas)]">
        <AppHeader />
        <main className="app-shell-main relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-7 pt-[26px] pb-10">
          {/* keyed by path so every page plays its entrance */}
          <div key={location.pathname} className="page-enter mx-auto min-h-0 w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
        <CimsAiLauncher />
      </div>
    </div>
  )
}

export function RootLayout() {
  return (
    <AppShellProvider>
      <TelephonyProvider>
        <RootLayoutFrame />
      </TelephonyProvider>
    </AppShellProvider>
  )
}
