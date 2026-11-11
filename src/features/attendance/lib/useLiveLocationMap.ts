import { useCallback, useEffect, useState } from 'react'
import {
  applyLiveMessage,
  attendanceLocationsService,
  type LocationMapSnapshot,
} from '../../../shared/api/services/attendanceLocations.service'

export type LiveConnection = 'connecting' | 'live' | 'reconnecting'

const RETRY_DELAYS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000]
const CLOCK_TICK_MS = 15_000
const PING_MS = 25_000

const emptySnapshot: LocationMapSnapshot = { locations: [], employees: [] }

function isFullSnapshot(message: unknown) {
  return typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'attendance_location_map'
}

/**
 * GET /attendance/location-map once, then keep it current through the realtime socket.
 * Messages are merged by employee_id; every reconnect re-fetches the full map.
 */
export function useLiveLocationMap() {
  const [snapshot, setSnapshot] = useState<LocationMapSnapshot>(emptySnapshot)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<unknown>(null)
  const [connection, setConnection] = useState<LiveConnection>('connecting')
  /** Wall clock for "last seen" and live/stale ageing; 0 until the first data arrives. */
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    try {
      const next = await attendanceLocationsService.getLocationMap()
      setSnapshot(next)
      setNow(Date.now())
      setStatus('ready')
      setError(null)
    } catch (nextError) {
      setError(nextError)
      setStatus((current) => (current === 'ready' ? current : 'error'))
    }
  }, [])

  useEffect(() => {
    let active = true
    let socket: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let pingTimer: ReturnType<typeof setInterval> | null = null
    let attempt = 0
    let opened = false

    const connect = () => {
      if (!active) return
      socket = new WebSocket(attendanceLocationsService.liveMapUrl())
      socket.onopen = () => {
        if (!active) return
        setConnection('live')
        // A reconnect (or a late first connect) may have missed updates: take a fresh full map.
        if (opened || attempt > 0) void load()
        opened = true
        attempt = 0
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send('ping')
        }, PING_MS)
      }
      socket.onmessage = (event) => {
        if (!active || typeof event.data !== 'string') return
        let message: unknown
        try {
          message = JSON.parse(event.data)
        } catch {
          return // keepalive / plain-text frames
        }
        const receivedAt = Date.now()
        setSnapshot((current) => applyLiveMessage(current, message, receivedAt) ?? current)
        setNow(receivedAt)
        if (isFullSnapshot(message)) {
          // A full snapshot also recovers from a failed initial GET.
          setStatus('ready')
          setError(null)
        }
      }
      socket.onclose = () => {
        if (pingTimer) clearInterval(pingTimer)
        pingTimer = null
        if (!active) return
        setConnection('reconnecting')
        retryTimer = setTimeout(connect, RETRY_DELAYS[Math.min(attempt++, RETRY_DELAYS.length - 1)])
      }
    }

    void load()
    connect()
    const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)

    return () => {
      active = false
      clearInterval(clock)
      if (retryTimer) clearTimeout(retryTimer)
      if (pingTimer) clearInterval(pingTimer)
      if (socket) {
        socket.onopen = null
        socket.onmessage = null
        socket.onclose = null
        socket.close()
      }
    }
  }, [load])

  return { ...snapshot, status, error, connection, now, reload: load }
}
