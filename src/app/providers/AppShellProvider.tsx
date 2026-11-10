import { useCallback, useMemo, useState, type PropsWithChildren } from 'react'
import { AppShellContext } from './AppShellContext'

export function AppShellProvider({ children }: PropsWithChildren) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem('cims-sidebar-collapsed') === '1' } catch { return false }
  })

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true)
  }, [])

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((current) => !current)
  }, [])

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((current) => {
      try { window.localStorage.setItem('cims-sidebar-collapsed', current ? '0' : '1') } catch { /* private mode */ }
      return !current
    })
  }, [])

  const value = useMemo(
    () => ({
      isSidebarOpen,
      isSidebarCollapsed,
      openSidebar,
      closeSidebar,
      toggleSidebar,
      toggleSidebarCollapsed,
    }),
    [closeSidebar, isSidebarCollapsed, isSidebarOpen, openSidebar, toggleSidebar, toggleSidebarCollapsed],
  )

  return (
    <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
  )
}
