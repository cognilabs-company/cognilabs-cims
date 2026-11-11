export type View = { x: number; y: number; k: number }

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2.5

export function clampZoom(k: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
}
