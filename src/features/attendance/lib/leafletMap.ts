import L from 'leaflet'
import { DEFAULT_CENTER, markerStateBadgeClass, type MarkerState } from './locations'

/* Plain Leaflet helpers shared by the picker and the live map. The default marker images break under Vite,
   so every marker here is an L.divIcon styled with the app's CSS variables. */

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

/**
 * Theme the Leaflet chrome without touching index.css. Leaflet's stylesheet is unlayered, so the overrides
 * that compete with it carry `!`. The OSM tiles are muted a little (calm next to the status colours) and,
 * in dark mode, inverted into a dark-gray map.
 */
export const MAP_SURFACE_CLASS = [
  'relative isolate z-0 overflow-hidden',
  '[&_.leaflet-bar]:border-[var(--border-hover)]! [&_.leaflet-bar]:shadow-[var(--elev-sm)]!',
  '[&_.leaflet-bar_a]:border-[var(--border)]! [&_.leaflet-bar_a]:bg-[var(--surface)]! [&_.leaflet-bar_a]:text-[var(--foreground)]!',
  '[&_.leaflet-bar_a:hover]:bg-[var(--input-surface)]! [&_.leaflet-bar_a.leaflet-disabled]:text-[var(--caption)]!',
  '[&_.leaflet-control-attribution]:bg-[var(--surface)]/85! [&_.leaflet-control-attribution]:text-[var(--muted)]! [&_.leaflet-control-attribution_a]:text-[var(--muted-strong)]!',
  '[&_.leaflet-tooltip]:rounded-[10px]! [&_.leaflet-tooltip]:border-[var(--border-hover)]! [&_.leaflet-tooltip]:bg-[var(--surface)]! [&_.leaflet-tooltip]:px-2.5! [&_.leaflet-tooltip]:py-1.5! [&_.leaflet-tooltip]:text-[12px]! [&_.leaflet-tooltip]:text-[var(--foreground)]! [&_.leaflet-tooltip]:shadow-[var(--elev-md)]!',
  '[&_.leaflet-tooltip-top]:before:border-t-[var(--surface)]!',
  '[&_.leaflet-tile-pane]:[filter:saturate(0.6)]',
  'dark:[&_.leaflet-tile-pane]:[filter:invert(1)_hue-rotate(180deg)_brightness(0.9)_contrast(0.85)_saturate(0.5)]',
].join(' ')

export const MAP_SURFACE_STYLE = { background: 'var(--muted-surface)', fontFamily: 'inherit' } as const

export function createBaseMap(element: HTMLElement, center: L.LatLngExpression = DEFAULT_CENTER, zoom = 12) {
  const map = L.map(element, { center, zoom, zoomControl: true, attributionControl: true, worldCopyJump: true })
  L.tileLayer(TILE_URL, { maxZoom: 19, subdomains: 'abc', attribution: TILE_ATTRIBUTION }).addTo(map)
  return map
}

/** Leaflet measures its container once; keep it in sync when a dialog animates in or the layout changes. */
export function keepMapSized(map: L.Map, element: HTMLElement) {
  if (typeof ResizeObserver === 'undefined') return () => {}
  const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
  observer.observe(element)
  return () => observer.disconnect()
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

export function locationCircleOptions(): L.CircleMarkerOptions {
  // Colours come from the class (CSS beats Leaflet's presentation attributes), so they follow the theme.
  return { className: 'fill-[var(--primary)] stroke-[var(--primary)]', weight: 1.5, opacity: 0.7, fillOpacity: 0.08, interactive: true }
}

export function pointPinIcon() {
  return L.divIcon({
    className: '',
    html: '<span class="block h-[18px] w-[18px] rounded-full border-[3px] border-white bg-[var(--primary)] shadow-[var(--elev-md)]"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

export function employeeIcon(initials: string, state: MarkerState, selected: boolean) {
  const size = selected ? 34 : 30
  const ring = selected ? ' ring-4 ring-[var(--primary)]/25' : ''
  return L.divIcon({
    className: '',
    html: `<span data-i18n-skip="true" class="grid h-full w-full place-items-center rounded-full border-[2.5px] bg-[var(--surface)] text-[11px] leading-none font-bold shadow-[var(--elev-md)] select-none ${markerStateBadgeClass[state]}${ring}">${escapeHtml(initials)}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  })
}
