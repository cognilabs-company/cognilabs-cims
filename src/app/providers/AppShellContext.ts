import { createContext } from 'react'

export type AppShellContextValue = {
  isSidebarOpen: boolean
  isSidebarCollapsed: boolean
  openSidebar: () => void
  closeSidebar: () => void
  toggleSidebar: () => void
  toggleSidebarCollapsed: () => void
  /** The spot in the top bar where a page can put its own buttons (see HeaderActions). */
  headerSlot: HTMLElement | null
  setHeaderSlot: (element: HTMLElement | null) => void
}

export const AppShellContext = createContext<AppShellContextValue | null>(null)
