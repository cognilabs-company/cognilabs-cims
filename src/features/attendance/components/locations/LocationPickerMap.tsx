import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '../../../../shared/lib/cn'
import { createBaseMap, keepMapSized, locationCircleOptions, MAP_SURFACE_CLASS, MAP_SURFACE_STYLE, pointPinIcon } from '../../lib/leafletMap'
import { DEFAULT_CENTER, MIN_RADIUS, roundCoordinate } from '../../lib/locations'

type LocationPickerMapProps = {
  latitude: number | null
  longitude: number | null
  radius: number | null
  onPick: (latitude: number, longitude: number) => void
  className?: string
  ariaLabel?: string
}

/** Small map for the location form: click (or drag the pin) to set the point; the circle shows the radius. */
export function LocationPickerMap({ latitude, longitude, radius, onPick, className, ariaLabel }: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const pinRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const onPickRef = useRef(onPick)
  // The first view only: later point changes pan the map instead of re-creating it.
  const [initialView] = useState(() => (latitude !== null && longitude !== null
    ? { center: [latitude, longitude] as [number, number], zoom: 17 }
    : { center: DEFAULT_CENTER, zoom: 12 }))

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const map = createBaseMap(element, initialView.center, initialView.zoom)
    mapRef.current = map
    map.on('click', (event: L.LeafletMouseEvent) => {
      onPickRef.current(roundCoordinate(event.latlng.lat), roundCoordinate(event.latlng.lng))
    })
    const stopSizing = keepMapSized(map, element)
    return () => {
      stopSizing()
      map.remove()
      mapRef.current = null
      pinRef.current = null
      circleRef.current = null
    }
  }, [initialView])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const valid = latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    if (!valid) {
      pinRef.current?.remove()
      circleRef.current?.remove()
      pinRef.current = null
      circleRef.current = null
      return
    }
    const point = L.latLng(latitude, longitude)
    const circleRadius = radius !== null && radius >= MIN_RADIUS ? radius : MIN_RADIUS

    if (circleRef.current) {
      circleRef.current.setLatLng(point).setRadius(circleRadius)
    } else {
      circleRef.current = L.circle(point, { ...locationCircleOptions(), radius: circleRadius, interactive: false }).addTo(map)
    }

    if (pinRef.current) {
      pinRef.current.setLatLng(point)
    } else {
      const pin = L.marker(point, { icon: pointPinIcon(), draggable: true, keyboard: false })
      pin.on('dragend', () => {
        const next = pin.getLatLng()
        onPickRef.current(roundCoordinate(next.lat), roundCoordinate(next.lng))
      })
      pinRef.current = pin.addTo(map)
    }

    // Bring the point into view, close enough for the radius circle to be visible.
    if (!map.getBounds().contains(point) || map.getZoom() < 15) map.setView(point, Math.max(map.getZoom(), 17))
  }, [latitude, longitude, radius])

  return (
    <div
      ref={containerRef}
      role="application"
      // Leaflet rewrites this subtree constantly; keep the DOM translator out of it.
      data-i18n-skip="true"
      aria-label={ariaLabel}
      style={MAP_SURFACE_STYLE}
      className={cn(MAP_SURFACE_CLASS, 'h-[220px] w-full cursor-crosshair! rounded-[16px] ring-1 ring-[var(--border)] sm:h-[260px]', className)}
    />
  )
}
