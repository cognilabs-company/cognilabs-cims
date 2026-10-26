export const PROJECTS_NAVIGATION_UPDATED_EVENT = 'projects:navigation-updated'

export function notifyProjectsNavigationChanged() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(PROJECTS_NAVIGATION_UPDATED_EVENT))
}
