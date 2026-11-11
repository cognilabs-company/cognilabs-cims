import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLocale } from '../../../../app/hooks/useLocale'
import type { AttendanceLocation, MapEmployee } from '../../../../shared/api/services/attendanceLocations.service'
import { cn } from '../../../../shared/lib/cn'
import { createBaseMap, employeeIcon, escapeHtml, keepMapSized, locationCircleOptions, MAP_SURFACE_CLASS, MAP_SURFACE_STYLE } from '../../lib/leafletMap'
import { employeeMarkerState, formatMeters, initialsOf, markerStateLegendLabel } from '../../lib/locations'

export type MapFocusRequest = { employeeId: number; nonce: number }

type LiveLocationMapProps = {
  locations: AttendanceLocation[]
  employees: MapEmployee[]
  now: number
  selectedId: number | null
  focus: MapFocusRequest | null
  onSelect: (employeeId: number) => void
  className?: string
}

type MarkerEntry = { marker: L.Marker; key: string }

/** The CEO live map: one circle per active location, one badge per employee with a known position. */
export function LiveLocationMap({ locations, employees, now, selectedId, focus, onSelect, className }: LiveLocationMapProps) {
  const { t } = useLocale()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const locationLayerRef = useRef<L.FeatureGroup | null>(null)
  const markersRef = useRef(new Map<number, MarkerEntry>())
  const fittedRef = useRef(false)
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const map = createBaseMap(element)
    mapRef.current = map
    locationLayerRef.current = L.featureGroup().addTo(map)
    const markers = markersRef.current
    const stopSizing = keepMapSized(map, element)
    return () => {
      stopSizing()
      markers.clear()
      map.remove()
      mapRef.current = null
      locationLayerRef.current = null
      fittedRef.current = false
    }
  }, [])

  // Location circles.
  useEffect(() => {
    const layer = locationLayerRef.current
    if (!layer) return
    layer.clearLayers()
    for (const location of locations) {
      if (location.latitude === null || location.longitude === null) continue
      L.circle([location.latitude, location.longitude], { ...locationCircleOptions(), radius: location.radius_meters })
        .bindTooltip(`<strong>${escapeHtml(location.name)}</strong> · ${escapeHtml(formatMeters(location.radius_meters))}`, { direction: 'top', sticky: true })
        .addTo(layer)
    }
  }, [locations])

  // Employee badges: update in place so a position message only moves one marker.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    const seen = new Set<number>()
    for (const employee of employees) {
      const state = employeeMarkerState(employee, now)
      if (state === 'no_data' || employee.latitude === null || employee.longitude === null) continue
      seen.add(employee.employee_id)
      const point = L.latLng(employee.latitude, employee.longitude)
      const selected = employee.employee_id === selectedId
      const label = markerStateLegendLabel(state, t)
      const key = `${state}|${selected}|${employee.name}|${label}`
      const tooltip = `<strong>${escapeHtml(employee.name)}</strong><br><span style="color:var(--muted)">${escapeHtml(label)}</span>`
      const entry = markers.get(employee.employee_id)
      if (entry) {
        entry.marker.setLatLng(point)
        if (entry.key !== key) {
          entry.marker.setIcon(employeeIcon(initialsOf(employee.name), state, selected))
          entry.marker.setTooltipContent(tooltip)
          entry.marker.setZIndexOffset(selected ? 1000 : 0)
          entry.key = key
        }
        continue
      }
      const employeeId = employee.employee_id
      const marker = L.marker(point, { icon: employeeIcon(initialsOf(employee.name), state, selected), zIndexOffset: selected ? 1000 : 0, riseOnHover: true })
        .bindTooltip(tooltip, { direction: 'top' })
        .on('click', () => onSelectRef.current(employeeId))
        .addTo(map)
      markers.set(employeeId, { marker, key })
    }
    for (const [employeeId, entry] of markers) {
      if (seen.has(employeeId)) continue
      entry.marker.remove()
      markers.delete(employeeId)
    }
  }, [employees, now, selectedId, t])

  // First data: frame the locations (or, without any, the employees).
  useEffect(() => {
    const map = mapRef.current
    const layer = locationLayerRef.current
    if (!map || !layer || fittedRef.current) return
    let bounds = layer.getLayers().length > 0 ? layer.getBounds() : null
    if (!bounds || !bounds.isValid()) {
      const points = employees
        .filter((employee) => employee.latitude !== null && employee.longitude !== null)
        .map((employee) => L.latLng(employee.latitude as number, employee.longitude as number))
      bounds = points.length > 0 ? L.latLngBounds(points) : null
    }
    if (!bounds || !bounds.isValid()) return
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 })
    fittedRef.current = true
  }, [locations, employees])

  // Focus requested from the list.
  useEffect(() => {
    if (!focus) return
    const map = mapRef.current
    const entry = markersRef.current.get(focus.employeeId)
    if (!map || !entry) return
    map.flyTo(entry.marker.getLatLng(), Math.max(map.getZoom(), 17), { duration: 0.6 })
    entry.marker.openTooltip()
  }, [focus])

  return (
    <div
      ref={containerRef}
      role="application"
      // Leaflet rewrites this subtree constantly; keep the DOM translator out of it.
      data-i18n-skip="true"
      aria-label={t('attendance.loc.map_label', 'Live map of employees and locations')}
      style={MAP_SURFACE_STYLE}
      className={cn(MAP_SURFACE_CLASS, 'h-full w-full', className)}
    />
  )
}
