import type { GeoFix } from './api'
import type { TgWebApp } from './telegram'

export type GeoError = 'denied' | 'unavailable' | 'timeout'

/** Great-circle distance in metres. */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatMeters(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

function browserFix(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject('unavailable' satisfies GeoError); return }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: Math.round((position.coords.accuracy ?? 9999) * 10) / 10,
      }),
      (error) => reject((error.code === error.PERMISSION_DENIED ? 'denied' : error.code === error.TIMEOUT ? 'timeout' : 'unavailable') satisfies GeoError),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
    )
  })
}

/**
 * Current position: Telegram LocationManager when the client supports it (Bot API 8.0+),
 * otherwise the browser Geolocation API. Rejects with a GeoError.
 */
export function getFix(webApp: TgWebApp | null): Promise<GeoFix> {
  const manager = webApp?.LocationManager
  if (!manager || !webApp?.isVersionAtLeast?.('8.0')) return browserFix()
  return new Promise((resolve, reject) => {
    const read = () => {
      if (!manager.isLocationAvailable) { browserFix().then(resolve, reject); return }
      manager.getLocation((data) => {
        if (!data) { reject((manager.isAccessRequested && !manager.isAccessGranted ? 'denied' : 'unavailable') satisfies GeoError); return }
        resolve({
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy_meters: Math.round((data.horizontal_accuracy ?? 9999) * 10) / 10,
        })
      })
    }
    if (manager.isInited) read()
    else manager.init(read)
  })
}

/** Opens the place where the user can allow location (Telegram settings when available). */
export function openLocationSettings(webApp: TgWebApp | null) {
  try { webApp?.LocationManager?.openSettings() } catch { /* not supported */ }
}
