/** Fired by the header's user pill; the sidebar owns the profile dialog and opens it. */
export const OPEN_PROFILE_EVENT = 'cims:open-profile'

export function openProfileDialog() {
  window.dispatchEvent(new Event(OPEN_PROFILE_EVENT))
}
