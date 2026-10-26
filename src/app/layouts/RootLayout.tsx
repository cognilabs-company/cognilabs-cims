import type { CSSProperties } from 'react'
import { Outlet } from 'react-router-dom'
import { useAppShell } from '../hooks/useAppShell'
import { useTheme } from '../hooks/useTheme'
import { AppShellProvider } from '../providers/AppShellProvider'
import { AppHeader } from '../../widgets/navigation/AppHeader'
import { AppSidebar } from '../../widgets/navigation/AppSidebar'
import { CimsAiLauncher } from '../../widgets/ai/CimsAiLauncher'

function RootLayoutFrame() {
  const { theme } = useTheme()
  const { isSidebarCollapsed } = useAppShell()
  const shellStyle = {
    '--app-shell-sidebar-width': isSidebarCollapsed ? '0px' : '16rem',
  } as CSSProperties

  const isDark = theme === 'dark'

  return (
    <div className="app-shell-grid" style={shellStyle}>
      <AppSidebar />
      <div
        className="relative flex h-screen min-h-0 flex-col overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(180deg, rgba(5,7,12,0.96), rgba(7,8,12,1))'
            : 'linear-gradient(180deg, #F7FAFD 0%, #F1F5F9 52%, #EDF2F7 100%)',
        }}
      >
        <AppHeader />
        <main className="app-shell-main relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-4 sm:px-4 lg:px-6">
          <div className="mx-auto w-full max-w-[1600px] min-h-0">
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
      <RootLayoutFrame />
    </AppShellProvider>
  )
}
