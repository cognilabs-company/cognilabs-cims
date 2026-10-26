import { createContext } from 'react'

export type AppShellContextValue = {
  isSidebarOpen: boolean
  isSidebarCollapsed: boolean
  openSidebar: () => void
  closeSidebar: () => void
  toggleSidebar: () => void
  toggleSidebarCollapsed: () => void
}

export const AppShellContext = createContext<AppShellContextValue | null>(null)
