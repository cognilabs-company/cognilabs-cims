/**
 * Pickers (select menus, calendars, time / month pickers) render into document.body
 * inside an element marked `data-floating-layer`. Popovers that close on an outside
 * click use this to ignore clicks that land in such a picker.
 */
export function isInFloatingLayer(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[data-floating-layer]'))
}
