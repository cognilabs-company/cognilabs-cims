import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { getApiErrorMessage, getApiErrorStatus } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { miniApi, type DaySummary, type GeoFix, type LocationsPayload, type Presence } from '../lib/api'
import { dayEndAfter, dayTitle, formatTimer, shiftDay, tashkentClock } from '../lib/attendanceDay'
import { PhotoPrepError, preparePhoto } from '../lib/photo'
import { distanceMeters, formatMeters, getFix, openLocationSettings, type GeoError } from '../lib/geo'
import { haptic, type TgWebApp } from '../lib/telegram'
import {
  IcArrive, IcArrowRight, IcCalendar, IcCamera, IcCheck, IcChevronLeft, IcChevronRight, IcClock, IcLeave, IcMoon,
  IcPin, IcPinGhost, IcRefresh, IcSliders, IcTarget, IcWarning,
} from '../ui/icons'
import { Arcs, Burst, Dots, DrawnTick, Odometer, Radar, Skeleton } from '../ui/motion'
import { CameraSheet } from './CameraSheet'

type Props = {
  active: boolean
  /** The Mini App is on screen (positions are sent only then). */
  appVisible: boolean
  initData: string
  webApp: TgWebApp
  /** The bottom tab bar is shown (the dock reads its height from --m-tabbar). */
  withTabBar?: boolean
}

const POSITION_EVERY_MS = 25_000
const FRESH_FIX_MS = 30_000
const DAY_MS = 24 * 3_600_000

/** 422 details may be a string or an object with the measured distance — show both. */
function backendDetail(cause: unknown, fallback: string) {
  const details = (cause as { details?: unknown } | null)?.details
  const detail = details && typeof details === 'object' ? (details as { detail?: unknown }).detail : null
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const data = detail as Record<string, unknown>
    const text = String(data.message ?? data.detail ?? data.error ?? '').trim()
    const distance = Number(data.distance_meters ?? data.distance ?? NaN)
    return [text || fallback, Number.isFinite(distance) ? `(${formatMeters(distance)})` : ''].filter(Boolean).join(' ')
  }
  return fallback
}

const clockOf = tashkentClock
const delay = (index: number) => ({ '--i': index }) as CSSProperties

type Step = 'locating' | 'photo' | 'sending'
type Result = { id: number; tone: 'success' | 'error'; text: string; photo?: string }

/**
 * Attendance: a live status card with the work timer, the day's timeline, GPS, assigned places with distance,
 * and Keldim / Ketdim — photo first through the in-app camera ("without photo" is always there).
 */
export function AttendanceTab({ active, appVisible, initData, webApp }: Props) {
  const { t, locale } = useLocale()
  const [data, setData] = useState<LocationsPayload | null>(null)
  const [presence, setPresence] = useState<Presence | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fix, setFix] = useState<(GeoFix & { at: number }) | null>(null)
  const [geoError, setGeoError] = useState<GeoError | null>(null)
  const [locating, setLocating] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const busy = step !== null
  const [result, setResult] = useState<Result | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [now, setNow] = useState(() => new Date().getTime())
  const [today, setToday] = useState<DaySummary | null>(null)
  /** The day shown in the summary card; null = the current attendance day. */
  const [viewDay, setViewDay] = useState<string | null>(null)
  const [pastDay, setPastDay] = useState<DaySummary | null>(null)
  const [dayDir, setDayDir] = useState<-1 | 1>(-1)
  const startedRef = useRef(false)
  const actingRef = useRef(false)
  const resultIdRef = useRef(0)
  const closedReloadRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const [payload, state, summary] = await Promise.all([
        miniApi.locations(initData),
        miniApi.state(initData).catch(() => null),
        miniApi.summary(initData).catch(() => null),
      ])
      setData(payload)
      setPresence(state ?? payload.presence)
      if (summary) setToday(summary)
      setLoadError(null)
    } catch (cause) {
      setLoadError(getApiErrorMessage(cause))
    }
  }, [initData])

  // A past day in the summary card.
  useEffect(() => {
    if (!viewDay) return
    let alive = true
    miniApi.summary(initData, viewDay)
      .then((summary) => { if (alive) setPastDay(summary) })
      .catch(() => { if (alive) setPastDay({ attendance_date: viewDay, record: null }) })
    return () => { alive = false }
  }, [initData, viewDay])

  // The last action's photo preview lives in memory only; a success note hides itself.
  useEffect(() => {
    const url = result?.photo
    const timer = result?.tone === 'success' ? window.setTimeout(() => setResult(null), 6500) : null
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      if (url) URL.revokeObjectURL(url)
    }
  }, [result])

  const locate = useCallback(async (report: boolean) => {
    setLocating(true)
    try {
      const next = await getFix(webApp)
      const stamped = { ...next, at: new Date().getTime() }
      setFix(stamped)
      setGeoError(null)
      if (report) void miniApi.position(initData, next).catch(() => {})
      return stamped
    } catch (cause) {
      setGeoError((typeof cause === 'string' ? cause : 'unavailable') as GeoError)
      return null
    } finally {
      setLocating(false)
    }
  }, [initData, webApp])

  // First open of the section: data + first position.
  useEffect(() => {
    if (!active || startedRef.current) return
    startedRef.current = true
    const timer = window.setTimeout(() => { void load(); void locate(true) }, 0)
    return () => window.clearTimeout(timer)
  }, [active, load, locate])

  // While the Mini App is visible: a fresh position every 25 s (never in the background).
  useEffect(() => {
    if (!appVisible || !startedRef.current || geoError === 'denied') return
    const timer = window.setInterval(() => { void locate(true) }, POSITION_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [appVisible, geoError, locate])

  // Back to the app → refresh state and position.
  useEffect(() => {
    if (!appVisible || !startedRef.current) return
    const timer = window.setTimeout(() => { void load(); void locate(true) }, 0)
    return () => window.clearTimeout(timer)
  }, [appVisible, load, locate])

  const checkedIn = presence?.state === 'checked_in'

  // The work timer ticks every second while checked in and on screen (every 30 s otherwise).
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().getTime()), checkedIn && active && appVisible ? 1000 : 30_000)
    return () => window.clearInterval(timer)
  }, [checkedIn, active, appVisible])

  // An open session is closed by the backend at the next 03:00: stop the timer there and reload once.
  const checkedInAt = checkedIn && presence?.checked_in_at ? new Date(presence.checked_in_at).getTime() : null
  const closesAt = checkedInAt !== null && !Number.isNaN(checkedInAt) ? dayEndAfter(checkedInAt) : null
  const pastClose = closesAt !== null && now >= closesAt
  useEffect(() => {
    if (!pastClose || closesAt === null || closedReloadRef.current === closesAt) return
    closedReloadRef.current = closesAt
    const timer = window.setTimeout(() => { void load() }, 1500)
    return () => window.clearTimeout(timer)
  }, [pastClose, closesAt, load])

  const maxAccuracy = data?.maxAccuracy ?? 100
  const locations = useMemo(() => {
    const items = data?.items ?? []
    return items
      .map((item) => ({ ...item, distance: fix ? distanceMeters(fix, item) : null }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
  }, [data, fix])

  // Checked in → the check-in location; otherwise the one the user picked, else the nearest.
  const selected = (checkedIn && presence?.location_id ? locations.find((item) => item.id === presence.location_id) : null)
    ?? locations.find((item) => item.id === pickedId)
    ?? locations[0]
    ?? null
  const accuracyOk = fix ? fix.accuracy_meters <= maxAccuracy : false
  const inside = Boolean(selected && selected.distance !== null && selected.distance <= selected.radius_meters)
  const canAct = Boolean(fix && accuracyOk && selected && inside && !busy && presence)

  let reason = ''
  let reasonIcon: ReactNode = null
  if (!presence) { reason = t('miniapp.att.loading_state', 'Loading your state…'); reasonIcon = <Arcs size={16} /> }
  else if (!locations.length) { reason = t('miniapp.att.no_locations', 'No location is assigned to you yet. Ask the CEO.'); reasonIcon = <IcPinGhost size={18} /> }
  else if (geoError === 'denied') { reason = t('miniapp.att.geo_denied', 'Location access is off.'); reasonIcon = <IcWarning size={18} /> }
  else if (!fix) { reason = t('miniapp.att.waiting_gps', 'Waiting for GPS…'); reasonIcon = <Radar className="h-[18px] w-[18px] text-[var(--primary)]" /> }
  else if (!accuracyOk) { reason = t('miniapp.att.low_accuracy', 'GPS accuracy is ±{{value}} m — needs ±{{max}} m or better. Step outside or wait a moment.', { value: Math.round(fix.accuracy_meters), max: maxAccuracy }); reasonIcon = <IcTarget size={18} /> }
  else if (selected && !inside && selected.distance !== null) { reason = t('miniapp.att.too_far', 'You are {{distance}} from “{{name}}” (allowed {{radius}} m).', { distance: formatMeters(selected.distance), name: selected.name, radius: selected.radius_meters }); reasonIcon = <IcPin size={18} /> }

  function showResult(next: Omit<Result, 'id'>) {
    resultIdRef.current += 1
    setResult({ ...next, id: resultIdRef.current })
  }

  /** Keldim / Ketdim; with `photoFile` the photo is uploaded first and attached to the event. */
  async function act(photoFile?: File) {
    if (!selected || !presence || actingRef.current) return
    actingRef.current = true
    setCameraOpen(false)
    const leaving = checkedIn
    setStep('locating')
    setResult(null)
    let preview: string | undefined
    try {
      const current = fix && new Date().getTime() - fix.at < FRESH_FIX_MS ? fix : await locate(false)
      if (!current) throw new Error(t('miniapp.att.no_gps', 'Could not get your location.'))
      let photoId: string | null = null
      if (photoFile) {
        setStep('photo')
        const photo = await preparePhoto(photoFile)
        preview = URL.createObjectURL(photo)
        setUploading(preview)
        photoId = (await miniApi.uploadPhoto(initData, photo)).photo_id
      }
      setStep('sending')
      const body = { latitude: current.latitude, longitude: current.longitude, accuracy_meters: current.accuracy_meters }
      if (leaving) await miniApi.checkOut(initData, selected.id, body, photoId)
      else await miniApi.checkIn(initData, selected.id, body, photoId)
      haptic('success')
      showResult({ tone: 'success', text: leaving ? t('miniapp.att.done_out', 'Checked out. See you!') : t('miniapp.att.done_in', 'Checked in. Have a good day!'), photo: preview })
      preview = undefined
      setViewDay(null)
      await load()
    } catch (cause) {
      haptic('error')
      const code = getApiErrorStatus(cause)
      if (code === 409) {
        // Actions alternate: the same action twice in a row is refused.
        showResult({ tone: 'error', text: leaving ? t('miniapp.att.already_out', 'You have already checked out — refreshed.') : t('miniapp.att.already_in', 'You have already checked in — refreshed.') })
        await load()
      } else if (cause instanceof PhotoPrepError || code === 413) {
        showResult({ tone: 'error', text: cause instanceof PhotoPrepError && cause.code === 'unsupported' ? t('miniapp.att.photo_unsupported', 'This photo format is not supported. Take it again or continue without a photo.') : t('miniapp.att.photo_too_large', 'The photo is larger than 10 MB. Take it again or continue without a photo.') })
      } else if (cause instanceof TypeError) {
        // fetch() itself failed: no connection (or the request was cut).
        showResult({ tone: 'error', text: t('miniapp.att.offline', 'No internet connection. Try again.') })
      } else {
        showResult({ tone: 'error', text: cause instanceof Error && !('status' in cause) ? cause.message : backendDetail(cause, getApiErrorMessage(cause)) })
      }
    } finally {
      setUploading(null)
      if (preview) URL.revokeObjectURL(preview)
      setStep(null)
      actingRef.current = false
    }
  }

  function openCamera() {
    if (!canAct) return
    haptic('tap')
    setResult(null)
    setCameraOpen(true)
  }

  // Worked today = completed intervals + the open one (until now, or the 03:00 close).
  const completedMinutes = presence?.worked_minutes ?? today?.record?.worked_minutes ?? 0
  const openSeconds = checkedInAt !== null && !Number.isNaN(checkedInAt) ? Math.max(0, (Math.min(now, closesAt ?? now) - checkedInAt) / 1000) : 0
  const workedSeconds = completedMinutes * 60 + (checkedIn ? openSeconds : 0)
  const autoClosed = !checkedIn && Boolean(presence?.auto_closed)
  const fixAge = fix ? Math.max(0, Math.round((now - fix.at) / 1000)) : null
  const hoursText = (minutes: number) => t('miniapp.att.hours_minutes', '{{h}} h {{m}} min', { h: Math.floor(minutes / 60), m: minutes % 60 })
  const stepText = step === 'photo' ? t('miniapp.att.step_photo', 'Uploading the photo…') : step === 'locating' ? t('miniapp.att.step_locating', 'Checking your location…') : t('miniapp.att.step_sending', 'Saving…')

  const currentDay = today?.attendance_date ?? null
  /** The day the card is on (navigation and the title follow it even while its data loads). */
  const displayedDate = viewDay ?? currentDay
  const dayLoading = Boolean(viewDay && (!pastDay || pastDay.attendance_date !== viewDay))
  const shownDay = viewDay ? (dayLoading ? null : pastDay) : today
  const dayLabel = !displayedDate
    ? ''
    : displayedDate === currentDay
      ? t('miniapp.att.today', 'Today')
      : currentDay && displayedDate === shiftDay(currentDay, -1)
        ? t('miniapp.att.yesterday', 'Yesterday')
        : dayTitle(displayedDate, locale)

  // GPS quality: 4 bars, relative to the accuracy the backend accepts.
  // Without any assigned place the buttons can never work: the dock is hidden and the empty state is in view.
  const noPlaces = data !== null && locations.length === 0
  const dockNote = !noPlaces && (result !== null || (!canAct && !busy && Boolean(reason)))
  const signal = !fix ? 0 : fix.accuracy_meters <= maxAccuracy * 0.35 ? 4 : fix.accuracy_meters <= maxAccuracy * 0.65 ? 3 : accuracyOk ? 2 : 1
  const gpsTone = geoError ? 'danger' : fix && accuracyOk ? 'success' : 'warning'

  return (
    <div className={cn('flex min-h-full flex-col px-4 pt-1', noPlaces ? 'pb-6' : dockNote ? 'pb-[250px]' : 'pb-[180px]')}>
      {/* ── Status hero ── */}
      <section className="m-hero m-rise p-5" data-on={checkedIn ? 'true' : 'false'} style={delay(0)}>
        <span className="m-grain" />
        <div className="flex items-center justify-between gap-3">
          <span className={cn('inline-flex h-8 min-w-0 items-center gap-2 rounded-full px-3 text-[12.5px] font-bold', checkedIn ? 'bg-[var(--m-lime)] text-[var(--m-lime-ink)]' : 'bg-white/10 text-[var(--m-on-hero)]')}>
            {presence ? (checkedIn ? <span className="m-live shrink-0 text-[var(--m-lime-ink)]" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-white/45" />) : null}
            <span className="truncate">
              {presence ? (checkedIn ? t('miniapp.att.at_work', 'You are at work') : t('miniapp.att.not_at_work', 'You are not at work')) : t('miniapp.att.loading_state', 'Loading your state…')}
            </span>
          </span>
          {currentDay ? <span className="shrink-0 text-[12px] font-semibold text-[var(--m-on-hero-muted)]">{dayTitle(currentDay, locale)}</span> : null}
        </div>

        <p className="mt-6 text-[12.5px] font-semibold text-[var(--m-on-hero-muted)]">
          {checkedIn ? t('miniapp.att.worked_live', 'Worked today') : t('miniapp.att.worked_today', 'Worked today')}
        </p>
        {presence ? (
          <Odometer value={formatTimer(workedSeconds)} className={cn('m-display mt-1 text-[44px] font-semibold', checkedIn ? 'text-[var(--m-lime)]' : 'text-[var(--m-on-hero)]')} />
        ) : (
          <Skeleton className="mt-2 h-11 w-52 rounded-[12px]" />
        )}
        <p className="mt-3 flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[var(--m-on-hero-muted)]">
          {checkedIn ? <IcPin size={15} duo={0} className="shrink-0" /> : autoClosed ? <IcMoon size={15} duo={0} className="shrink-0" /> : <IcClock size={15} duo={0} className="shrink-0" />}
          <span className="truncate">
            {!presence
              ? ' '
              : checkedIn
                ? [presence.location_name, presence.checked_in_at ? t('miniapp.att.since', 'since {{time}}', { time: clockOf(presence.checked_in_at) }) : null].filter(Boolean).join(' · ')
                : autoClosed
                  ? t('miniapp.att.auto_closed', 'Automatically closed at 03:00')
                  : presence.checked_out_at ? t('miniapp.att.left_at', 'Left at {{time}}', { time: clockOf(presence.checked_out_at) }) : t('miniapp.att.tap_when_arrive', 'Press “I’m here” when you arrive')}
          </span>
        </p>
        <p className="mt-1 text-[11px] text-[var(--m-on-hero-muted)]/80">{t('miniapp.att.worked_hint', 'Only time between check-in and check-out counts')}</p>
        {autoClosed ? (
          <p className="m-pop mt-4 flex items-start gap-2 rounded-[16px] bg-[var(--warning)]/15 px-3 py-2.5 text-[12px] leading-snug text-[#ffd27a]">
            <IcMoon size={16} duo={0.3} className="mt-px shrink-0" />
            {t('miniapp.att.auto_closed_hint', 'You did not check out, so the day was closed at 03:00. This is not your real leaving time.')}
          </p>
        ) : null}
      </section>

      {/* ── Day summary (03:00 → 03:00) ── */}
      {today ? (
        <section className="m-card m-rise mt-3 p-4" style={delay(1)}>
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[var(--blue-dim)] text-[var(--primary)]">
              <IcCalendar size={19} duo={0.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-[var(--foreground)]">{dayLabel}</p>
              <p className="truncate text-[11.5px] text-[var(--muted)]">{t('miniapp.att.day_span', 'The day runs 03:00 → 03:00')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--muted-surface)] p-1">
              <button
                type="button"
                onClick={() => {
                  if (!currentDay) return
                  haptic('select')
                  setDayDir(-1)
                  setViewDay((day) => shiftDay(day ?? currentDay, -1))
                }}
                disabled={!displayedDate}
                aria-label={t('miniapp.att.prev_day', 'Previous day')}
                className="m-press grid h-8 w-8 place-items-center rounded-full bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--elev-sm)] disabled:opacity-40"
              >
                <IcChevronLeft size={16} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentDay) return
                  haptic('select')
                  setDayDir(1)
                  setViewDay((day) => {
                    const next = shiftDay(day ?? currentDay, 1)
                    return next >= currentDay ? null : next
                  })
                }}
                disabled={!viewDay}
                aria-label={t('miniapp.att.next_day', 'Next day')}
                className="m-press grid h-8 w-8 place-items-center rounded-full bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--elev-sm)] disabled:opacity-40 disabled:shadow-none"
              >
                <IcChevronRight size={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <div key={displayedDate ?? 'none'} className="m-swap" style={{ '--dx': `${dayDir * 22}px` } as CSSProperties}>
            {dayLoading ? (
              <div className="mt-4 space-y-3"><Skeleton className="h-3 rounded-full" /><Skeleton className="h-[60px] rounded-[16px]" /></div>
            ) : shownDay?.record ? (
              <>
                <DayTimeline
                  day={shownDay.attendance_date}
                  inAt={shownDay.record.check_in_at}
                  outAt={shownDay.record.check_out_at}
                  live={shownDay.attendance_date === currentDay && checkedIn}
                  autoClosed={shownDay.record.auto_closed}
                  now={now}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Stat icon={<IcArrive size={15} duo={0} />} label={t('miniapp.att.first_in', 'Came')} value={clockOf(shownDay.record.check_in_at) || '—'} />
                  <Stat
                    icon={<IcLeave size={15} duo={0} />}
                    label={t('miniapp.att.last_out', 'Left')}
                    value={shownDay.record.check_out_at ? clockOf(shownDay.record.check_out_at) : (shownDay.attendance_date === currentDay && checkedIn ? t('miniapp.att.still_here', 'at work') : '—')}
                    accent={!shownDay.record.check_out_at && shownDay.attendance_date === currentDay && checkedIn}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-[16px] bg-[var(--blue-dim)] px-3.5 py-2.5 text-[var(--blue-text)]">
                  <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-bold"><IcClock size={16} duo={0.25} className="shrink-0" /><span className="truncate">{t('miniapp.att.worked', 'Worked')}</span></span>
                  <span className="m-display shrink-0 text-[16px] font-semibold">{hoursText(shownDay.attendance_date === currentDay && checkedIn ? Math.floor(workedSeconds / 60) : shownDay.record.worked_minutes)}</span>
                </div>
                {shownDay.record.auto_closed ? (
                  <p className="m-pop mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-dim)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--warning-text)]">
                    <IcMoon size={14} duo={0.3} /> {t('miniapp.att.auto_closed', 'Automatically closed at 03:00')}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-[16px] border border-dashed border-[var(--border-hover)] px-3.5 py-3.5">
                <IcCalendar size={20} duo={0} className="shrink-0 text-[var(--caption)]" />
                <p className="text-[13px] font-medium text-[var(--muted)]">{t('miniapp.att.no_record', 'No attendance on this day')}</p>
              </div>
            )}
          </div>
        </section>
      ) : !presence && !loadError ? (
        <Skeleton className="mt-3 h-[150px] rounded-[26px]" />
      ) : null}

      {/* ── GPS ── */}
      <section className="m-card m-rise mt-3 flex items-center gap-3 p-3.5" style={delay(2)}>
        <span className={cn(
          'relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[16px]',
          gpsTone === 'danger' ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : gpsTone === 'success' ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--warning-dim)] text-[var(--warning-text)]',
        )}>
          {locating ? <Radar className="absolute inset-1" /> : null}
          <IcTarget size={22} duo={0.22} className="relative" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold text-[var(--foreground)]">
            {geoError === 'denied'
              ? t('miniapp.att.geo_denied', 'Location access is off.')
              : geoError
                ? t('miniapp.att.geo_unavailable', 'Location is not available right now')
                : fix
                  ? t('miniapp.att.accuracy', 'GPS accuracy ±{{value}} m', { value: Math.round(fix.accuracy_meters) })
                  : t('miniapp.att.waiting_gps', 'Waiting for GPS…')}
          </p>
          <p className="line-clamp-2 text-[11.5px] leading-snug text-[var(--muted)]">
            {geoError === 'denied'
              ? t('miniapp.att.geo_denied_hint', 'Allow location for Telegram in your phone settings.')
              : fix && fixAge !== null
                ? t('miniapp.att.updated', 'Updated {{seconds}} s ago · sent while the app is open', { seconds: fixAge })
                : t('miniapp.att.only_open', 'Location is used only while the app is open')}
          </p>
        </div>
        <SignalBars level={signal} tone={gpsTone} />
        {geoError === 'denied' ? (
          <button type="button" onClick={() => openLocationSettings(webApp)} className="m-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--foreground)]" aria-label={t('miniapp.att.settings', 'Settings')}>
            <IcSliders size={19} />
          </button>
        ) : (
          <button type="button" onClick={() => { haptic('tap'); void locate(true) }} disabled={locating} className="m-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--foreground)] disabled:opacity-50" aria-label={t('miniapp.att.refresh', 'Refresh location')}>
            <IcRefresh size={18} className={cn(locating && 'm-spin')} />
          </button>
        )}
      </section>

      {/* ── Places ── */}
      <div className="m-rise mt-6 mb-2.5 flex items-center justify-between px-1" style={delay(3)}>
        <p className="m-display text-[11.5px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">{t('miniapp.att.locations', 'Your locations')}</p>
        {data && locations.length > 0 ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--muted-surface)] px-2 text-[11.5px] font-bold text-[var(--muted-strong)]">{locations.length}</span> : null}
      </div>
      {loadError ? (
        <div className="m-pop m-card flex items-start gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[var(--danger-dim)] text-[var(--danger-text)]"><IcWarning size={20} duo={0.25} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] leading-snug text-[var(--foreground)]">{loadError}</p>
            <button type="button" onClick={() => void load()} className="m-press mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--foreground)] px-4 text-[13px] font-bold text-[var(--app-canvas)]">
              <IcRefresh size={15} /> {t('miniapp.retry', 'Try again')}
            </button>
          </div>
        </div>
      ) : !data ? (
        <div className="space-y-2.5">{[0, 1].map((index) => <Skeleton key={index} className="h-[78px] rounded-[24px]" style={{ animationDelay: `${index * 120}ms` }} />)}</div>
      ) : locations.length === 0 ? (
        <div className="m-pop m-card flex flex-col items-center px-6 py-9 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--muted-surface)] text-[var(--muted)]"><IcPinGhost size={30} duo={0.2} /></span>
          <p className="mt-3 max-w-[260px] text-[14px] leading-relaxed text-[var(--muted-strong)]">{t('miniapp.att.no_locations', 'No location is assigned to you yet. Ask the CEO.')}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {locations.map((item, index) => {
            const isSelected = selected?.id === item.id
            const within = item.distance !== null && item.distance <= item.radius_meters
            const locked = checkedIn && presence?.location_id !== null && presence?.location_id !== undefined
            const closeness = item.distance === null ? 0 : within ? 1 : Math.max(0.05, Math.min(0.94, item.radius_meters / item.distance))
            return (
              <li key={item.id} className="m-rise" style={delay(4 + index)}>
                <button
                  type="button"
                  disabled={locked && !isSelected}
                  onClick={() => { haptic('select'); setPickedId(item.id) }}
                  aria-pressed={isSelected}
                  className={cn(
                    'm-card m-press flex w-full items-center gap-3 p-3 text-left transition-shadow duration-300 disabled:opacity-45',
                    isSelected && 'shadow-[0_0_0_2px_var(--primary),var(--m-shadow)]',
                  )}
                >
                  <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-[16px] transition-colors duration-300', within ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--blue-dim)] text-[var(--primary)]')}>
                    <IcPin size={22} duo={0.24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-[var(--foreground)]">{item.name}</span>
                    <span className="block truncate text-[12px] text-[var(--muted)]">{item.address || t('miniapp.att.radius', 'Radius {{value}} m', { value: item.radius_meters })}</span>
                    {item.distance !== null ? (
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
                        <span
                          className="block h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{ width: `${Math.round(closeness * 100)}%`, background: within ? 'var(--success)' : 'linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 60%, var(--m-lime)))' }}
                        />
                      </span>
                    ) : null}
                  </span>
                  <span className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums',
                    item.distance === null ? 'bg-[var(--muted-surface)] text-[var(--muted)]' : within ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]',
                  )}>
                    {within ? <IcCheck size={13} strokeWidth={2.6} /> : null}
                    {item.distance === null ? '—' : within ? t('miniapp.att.inside', 'Inside') : formatMeters(item.distance)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* ── Action dock (above the tab bar, reachable with the thumb) ── */}
      {/* The list fades out under the dock instead of being cut by it. */}
      {noPlaces ? null : <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-20" style={{ height: 'calc(var(--m-tabbar, 12px) + 150px)', background: 'linear-gradient(to bottom, color-mix(in srgb, var(--app-canvas) 0%, transparent), var(--app-canvas) 58%)' }} />
      <div className="fixed inset-x-0 z-30 mx-auto max-w-md px-4" style={{ bottom: 'calc(var(--m-tabbar, 12px) + 10px)' }}>
        {result ? (
          <div
            key={result.id}
            role={result.tone === 'error' ? 'alert' : 'status'}
            onClick={() => setResult(null)}
            className={cn(
              'relative mb-2.5 flex items-center gap-3 rounded-[22px] px-3 py-2.5 text-[13.5px] leading-snug font-semibold shadow-[var(--m-shadow-lift)]',
              result.tone === 'success' ? 'm-pop bg-[var(--m-hero)] text-[var(--m-on-hero)]' : 'm-shake bg-[var(--danger-dim)] text-[var(--danger-text)] ring-1 ring-[var(--danger-border)]',
            )}
          >
            <span className="relative grid h-11 w-11 shrink-0 place-items-center">
              {result.photo ? (
                <img src={result.photo} alt="" className="h-11 w-11 rounded-[14px] object-cover ring-2 ring-[var(--m-lime)]" />
              ) : result.tone === 'success' ? (
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--m-lime)] text-[var(--m-lime-ink)]"><DrawnTick size={22} /></span>
              ) : (
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--danger)]/15"><IcWarning size={22} duo={0.25} /></span>
              )}
              {result.tone === 'success' ? <Burst /> : null}
            </span>
            <span className="min-w-0 flex-1">{result.text}</span>
          </div>
        ) : !canAct && !busy && reason ? (
          <p className="m-pop mb-2.5 flex items-center gap-2.5 rounded-[18px] bg-[var(--m-glass)] px-3.5 py-2.5 text-[12.5px] leading-snug font-semibold text-[var(--muted-strong)] shadow-[var(--m-shadow)] ring-1 ring-[var(--border)] backdrop-blur-xl">
            <span className="grid shrink-0 place-items-center text-[var(--primary)]">{reasonIcon}</span>
            <span className="min-w-0 flex-1">{reason}</span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={openCamera}
          disabled={!canAct}
          className={cn(
            'm-press group relative flex h-16 w-full items-center gap-3 overflow-hidden rounded-full pr-5 pl-2 text-left transition-[background-color,color,box-shadow] duration-300',
            busy
              ? 'bg-[var(--m-hero)] text-[var(--m-on-hero)] shadow-[var(--m-shadow-lift)]'
              : !canAct
                ? 'bg-[var(--muted-surface)] text-[var(--caption)]'
                : checkedIn
                  ? 'bg-[var(--m-coral)] text-[var(--m-coral-ink)] shadow-[0_18px_36px_-16px_var(--m-coral)]'
                  : 'bg-[var(--m-lime)] text-[var(--m-lime-ink)] shadow-[0_18px_36px_-16px_color-mix(in_srgb,var(--m-lime)_90%,#000)]',
          )}
        >
          <span className={cn(
            'relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full',
            busy ? 'bg-white/10 text-[var(--m-lime)]' : !canAct ? 'bg-[var(--surface)]/60' : checkedIn ? 'bg-black/12' : 'bg-black/8',
          )}>
            {step === 'photo' && uploading ? (
              <span className="m-scan absolute inset-0"><img src={uploading} alt="" className="h-full w-full object-cover" /></span>
            ) : step === 'locating' ? (
              <Radar className="absolute inset-1 text-[var(--m-lime)]" />
            ) : step === 'sending' ? (
              <Arcs size={24} />
            ) : (
              <IcCamera size={24} duo={0.25} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            {busy ? (
              <span className="flex items-center gap-2 text-[15px] font-bold">
                <span className="truncate">{stepText}</span>
                <Dots className="shrink-0 text-[var(--m-lime)]" />
              </span>
            ) : (
              <span className="line-clamp-2 text-[16px] leading-[1.15] font-extrabold">
                {checkedIn ? t('miniapp.att.photo_check_out', 'Take photo · Ketdim') : t('miniapp.att.photo_check_in', 'Take photo · Keldim')}
              </span>
            )}
          </span>
          {!busy ? <IcArrowRight size={20} strokeWidth={2.4} className="shrink-0 transition-transform duration-300 group-active:translate-x-1" /> : null}
        </button>

        <button
          type="button"
          onClick={() => { haptic('tap'); void act() }}
          disabled={!canAct}
          className="m-press mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--m-glass)] text-[14px] font-bold text-[var(--foreground)] ring-1 ring-[var(--border)] backdrop-blur-xl disabled:text-[var(--caption)]"
        >
          {checkedIn ? <IcLeave size={17} duo={0} /> : <IcArrive size={17} duo={0} />}
          {t('miniapp.att.no_photo', 'Continue without photo')}
        </button>
      </div>
      </>}

      {cameraOpen ? (
        <CameraSheet
          leaving={checkedIn}
          appVisible={appVisible}
          onClose={() => setCameraOpen(false)}
          onPhoto={(file) => void act(file)}
          onWithoutPhoto={() => void act()}
        />
      ) : null}
    </div>
  )
}

function Stat({ icon, label, value, accent = false }: { icon: ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[16px] bg-[var(--muted-surface)] px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] font-semibold text-[var(--muted)]">{icon}<span className="truncate">{label}</span></p>
      <p className={cn('mt-0.5 truncate text-[15px] font-extrabold tabular-nums', accent ? 'text-[var(--success-text)]' : 'text-[var(--foreground)]')}>{value}</p>
    </div>
  )
}

/** Four bars like a phone's signal meter. */
function SignalBars({ level, tone }: { level: number; tone: 'success' | 'warning' | 'danger' }) {
  const color = tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--warning)' : 'var(--danger)'
  return (
    <span className="flex h-5 shrink-0 items-end gap-[3px]" aria-hidden="true">
      {[6, 10, 14, 19].map((height, index) => (
        <span key={height} className="w-[4px] rounded-full transition-colors duration-500" style={{ height, background: index < level ? color : 'var(--border-hover)' }} />
      ))}
    </span>
  )
}

/** The attendance day 03:00 → 03:00 as a bar with the first-in → last-out stretch. */
function DayTimeline({ day, inAt, outAt, live, autoClosed, now }: { day: string; inAt: string | null; outAt: string | null; live: boolean; autoClosed: boolean; now: number }) {
  const start = Date.parse(`${day}T03:00:00+05:00`)
  const clamp = (value: number) => Math.max(0, Math.min(1, value))
  const at = (value: number) => clamp((value - start) / DAY_MS)
  const inTime = inAt ? Date.parse(inAt) : NaN
  const outTime = outAt ? Date.parse(outAt) : autoClosed ? start + DAY_MS : live ? now : NaN
  const from = Number.isNaN(start) || Number.isNaN(inTime) ? null : at(inTime)
  const to = from === null || Number.isNaN(outTime) ? null : at(outTime)
  const ticks: Array<[number, string]> = [[3 / 24, '06'], [9 / 24, '12'], [15 / 24, '18'], [21 / 24, '00']]
  return (
    <div className="mt-4" aria-hidden="true">
      <div className="relative h-3 rounded-full bg-[var(--muted-surface)]">
        {ticks.map(([position]) => <span key={position} className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-[var(--border-hover)]" style={{ left: `${position * 100}%` }} />)}
        {from !== null ? (
          <span
            className={cn('absolute inset-y-0 rounded-full transition-[width] duration-700', autoClosed ? 'm-stripes' : live ? 'bg-[var(--success)]' : 'bg-[var(--primary)]')}
            style={{ left: `${from * 100}%`, width: `${Math.max(1.6, ((to ?? from) - from) * 100)}%` }}
          />
        ) : null}
        {live && to !== null ? (
          <span className="absolute top-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--surface)] shadow-[var(--elev-md)]" style={{ left: `${to * 100}%` }}>
            <span className="m-live text-[var(--success)]" />
          </span>
        ) : null}
      </div>
      <div className="relative mt-1.5 h-3 text-[10px] font-bold text-[var(--caption)] tabular-nums">
        <span className="absolute left-0">03</span>
        {ticks.map(([position, label]) => <span key={label} className="absolute -translate-x-1/2" style={{ left: `${position * 100}%` }}>{label}</span>)}
        <span className="absolute right-0">03</span>
      </div>
    </div>
  )
}
