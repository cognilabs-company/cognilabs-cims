import { useCallback, useMemo, useState, type PropsWithChildren } from 'react'
import { AppShellContext } from './AppShellContext'

export function AppShellProvider({ children }: PropsWithChildren) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

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
    setIsSidebarCollapsed((current) => !current)
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
