import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  BackspaceIcon,
  ClockCounterClockwiseIcon,
  MicrophoneSlashIcon,
  PhoneCallIcon,
  PhoneIcon,
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  PhoneXIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { normalizePhone, telephonyService, type TelephonyCall, type TelephonyCallDetail, type TelephonyLead } from '../../../shared/api/services/telephony.service'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { useTelephony } from '../../telephony/TelephonyContext'
import { formatPhone } from '../../telephony/components/telephonyFormat'
import { haptic } from '../lib/telegram'

type Props = {
  /** The tab is on screen (the microphone is asked for the first time it opens). */
  active: boolean
  onDial: (phone: string, lead?: TelephonyLead | null) => void
  /** RBAC calls:create — without it the keypad is shown but calling is off. */
  canCall: boolean
}

const keys: Array<[string, string]> = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
]

function timeOf(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function dayOf(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return ''
  if (date.toDateString() === yesterday.toDateString()) return 'yesterday'
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function clock(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

const missedStatuses = new Set(['missed', 'no_answer', 'rejected', 'busy', 'failed'])

/** Phone section of the Mini App: keypad with lead search, recent calls, call notes. */
export function PhoneTab({ active, onDial, canCall: allowedToCall }: Props) {
  const { t } = useLocale()
  const phone = useTelephony()
  const [view, setView] = useState<'keypad' | 'recent'>('keypad')
  const [digits, setDigits] = useState('')
  const [picked, setPicked] = useState<TelephonyLead | null>(null)
  const [suggestions, setSuggestions] = useState<TelephonyLead[]>([])
  const [mic, setMic] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const askedRef = useRef(false)
  const [recent, setRecent] = useState<TelephonyCall[] | null>(null)
  const [recentError, setRecentError] = useState<string | null>(null)
  const [detail, setDetail] = useState<TelephonyCallDetail | null>(null)
  const [detailCall, setDetailCall] = useState<TelephonyCall | null>(null)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  function askMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) { setMic('denied'); return }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => { stream.getTracks().forEach((track) => track.stop()); setMic('granted') })
      .catch(() => setMic('denied'))
  }

  // Microphone: asked once, when the phone section is opened for the first time.
  useEffect(() => {
    if (!active || askedRef.current) return
    askedRef.current = true
    const timer = window.setTimeout(askMicrophone, 0)
    return () => window.clearTimeout(timer)
  }, [active])

  // Recent calls (reloaded after every finished call).
  useEffect(() => {
    if (!active) return
    let alive = true
    telephonyService.calls({ page: 1, page_size: 30 })
      .then((response) => { if (alive) { setRecent(response.items ?? []); setRecentError(null) } })
      .catch((cause) => { if (alive) setRecentError(getApiErrorMessage(cause)) })
    return () => { alive = false }
  }, [active, phone.historyVersion])

  // Lead search by the last digits (3–6 typed digits).
  const query = normalizePhone(digits)
  useEffect(() => {
    if (query.length < 3 || query.length > 6) return
    let alive = true
    const timer = window.setTimeout(() => {
      telephonyService.search(query)
        .then((result) => { if (alive) setSuggestions((Array.isArray(result) ? result : result.items ?? []).slice(0, 4)) })
        .catch(() => { if (alive) setSuggestions([]) })
    }, 250)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [query])
  const shownSuggestions = query.length >= 3 && query.length <= 6 ? suggestions : []

  function press(key: string) {
    haptic('tap')
    setPicked(null)
    setDigits((current) => (current + key).slice(0, 20))
  }

  function backspace() {
    haptic('tap')
    setPicked(null)
    setDigits((current) => current.slice(0, -1))
  }

  function call(number = digits, lead: TelephonyLead | null = picked) {
    const normalized = normalizePhone(number)
    if (normalized.length < 7) return
    haptic('tap')
    onDial(normalized, lead)
  }

  async function openDetail(item: TelephonyCall) {
    setDetailCall(item)
    setDetail(null)
    setNote('')
    try { setDetail(await telephonyService.call(item.id)) } catch { /* the sheet still shows the list row */ }
  }

  async function saveNote() {
    if (!detailCall || !note.trim()) return
    setSavingNote(true)
    try {
      await telephonyService.addNote(detailCall.id, note.trim())
      setNote('')
      haptic('success')
      setDetail(await telephonyService.call(detailCall.id))
    } catch {
      haptic('error')
    } finally {
      setSavingNote(false)
    }
  }

  const ready = phone.connection === 'Ready'
  const lineText = ready
    ? t('miniapp.phone.ready', 'Line is ready')
    : phone.connection === 'Disabled'
      ? t('miniapp.phone.disabled', 'Telephony is turned off for you')
      : /fail|unavailable/i.test(phone.connection)
        ? t('miniapp.phone.unavailable', 'Phone service is unavailable')
        : t('miniapp.phone.connecting', 'Connecting…')
  const canCall = allowedToCall && phone.canDial && normalizePhone(digits).length >= 7

  const grouped = useMemo(() => {
    const out: Array<{ label: string; items: TelephonyCall[] }> = []
    for (const item of recent ?? []) {
      const key = dayOf(item.started_at)
      const label = key === '' ? t('miniapp.today', 'Today') : key === 'yesterday' ? t('miniapp.yesterday', 'Yesterday') : key
      const last = out.at(-1)
      if (last && last.label === label) last.items.push(item)
      else out.push({ label, items: [item] })
    }
    return out
  }, [recent, t])

  return (
    <div className="flex min-h-full flex-col">
      {/* Line state + keypad / recent switch */}
      <div className="flex items-center justify-between gap-3 px-4 pt-1">
        <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-medium text-[var(--muted-strong)]">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', ready ? 'bg-[var(--success)] mini-pulse' : /fail|unavailable|disabled/i.test(phone.connection) ? 'bg-[var(--danger)]' : 'bg-[var(--warning)]')} />
          <span className="truncate">{lineText}</span>
        </span>
        <div role="tablist" className="inline-flex shrink-0 rounded-[12px] bg-[var(--muted-surface)] p-1">
          {([
            ['keypad', SquaresFourIcon, t('miniapp.phone.keypad', 'Keypad')],
            ['recent', ClockCounterClockwiseIcon, t('miniapp.phone.recent', 'Recent')],
          ] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => { haptic('select'); setView(value) }}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition-colors', view === value ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_3px_rgba(14,21,37,0.12)]' : 'text-[var(--muted-strong)]')}
            >
              <Icon size={15} weight={view === value ? 'duotone' : 'regular'} />{label}
            </button>
          ))}
        </div>
      </div>

      {mic === 'denied' ? (
        <button type="button" onClick={askMicrophone} className="mini-in mx-4 mt-3 flex items-center gap-3 rounded-[16px] bg-[var(--warning-dim)] px-3.5 py-3 text-left text-[var(--warning-text)]">
          <MicrophoneSlashIcon size={22} weight="duotone" className="shrink-0" />
          <span className="min-w-0 flex-1 text-[13px] leading-snug">
            <span className="block font-semibold">{t('miniapp.phone.mic_title', 'Microphone is blocked')}</span>
            {t('miniapp.phone.mic_text', 'Allow the microphone for Telegram to make and answer calls. Tap to try again.')}
          </span>
        </button>
      ) : null}
      {!allowedToCall ? (
        <p className="mini-in mx-4 mt-3 rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-2.5 text-[13px] text-[var(--muted-strong)]">{t('miniapp.phone.no_call_right', 'You can answer calls and see the history, but placing calls is not allowed for your role.')}</p>
      ) : null}
      {phone.error ? <p className="mini-in mx-4 mt-3 rounded-[14px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[13px] text-[var(--danger-text)]">{phone.error}</p> : null}

      {view === 'keypad' ? (
        <div key="keypad" className="mini-in flex flex-1 flex-col px-5 pt-4">
          {/* Number */}
          <div className="flex min-h-[56px] flex-col items-center justify-end">
            {picked ? <p className="mini-in mb-1 max-w-full truncate text-[14px] font-semibold text-[var(--primary)]">{picked.full_name}</p> : null}
            <p className={cn('max-w-full truncate font-semibold tracking-[0.02em] text-[var(--foreground)] tabular-nums transition-[font-size] duration-200', digits.length > 13 ? 'text-[26px]' : 'text-[34px]')} data-i18n-skip="true">
              {digits ? formatPhone(digits) : <span className="text-[var(--caption)]">{t('miniapp.phone.enter', 'Enter a number')}</span>}
            </p>
          </div>

          {/* Matches for the last digits */}
          <div className="mt-1 min-h-[40px]">
            {shownSuggestions.length ? (
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {shownSuggestions.map((lead) => (
                  <button
                    key={`${lead.crm_source}-${lead.customer_id}`}
                    type="button"
                    onClick={() => { haptic('select'); setPicked(lead); setDigits(normalizePhone(lead.phone_number)) }}
                    className="mini-in shrink-0 rounded-[12px] bg-[var(--blue-dim)] px-3 py-1.5 text-left"
                  >
                    <span className="block max-w-[160px] truncate text-[13px] font-semibold text-[var(--primary)]">{lead.full_name}</span>
                    <span className="block text-[11.5px] text-[var(--muted)] tabular-nums">{formatPhone(lead.phone_number)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Keys */}
          <div className="mini-keypad mx-auto mt-1 grid w-full max-w-[320px] grid-cols-3 gap-x-5">
            {keys.map(([key, letters]) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                onContextMenu={(event) => { if (key === '0') { event.preventDefault(); press('+') } }}
                className="mini-key mx-auto grid h-[var(--key)] w-[var(--key)] place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--foreground)]"
              >
                <span className="flex flex-col items-center leading-none">
                  <span className="text-[calc(var(--key)*0.4)] font-medium">{key}</span>
                  {letters ? <span className="mt-0.5 text-[9.5px] font-semibold tracking-[0.12em] text-[var(--muted)]">{letters}</span> : null}
                </span>
              </button>
            ))}
          </div>

          {/* Call + backspace */}
          <div className="mini-keypad mx-auto mt-3 mb-3 grid w-full max-w-[320px] grid-cols-3 items-center gap-x-5">
            <span />
            <button
              type="button"
              onClick={() => call()}
              disabled={!canCall}
              aria-label={t('miniapp.phone.call', 'Call')}
              className="mini-key mx-auto grid h-[calc(var(--key)+4px)] w-[calc(var(--key)+4px)] place-items-center rounded-full bg-[var(--success)] text-white shadow-[0_12px_26px_-12px_var(--success)] disabled:opacity-40 disabled:shadow-none"
            >
              <PhoneIcon size={30} weight="fill" />
            </button>
            {digits ? (
              <button
                type="button"
                onClick={backspace}
                onContextMenu={(event) => { event.preventDefault(); setDigits(''); setPicked(null) }}
                aria-label={t('miniapp.phone.backspace', 'Delete')}
                className="mini-key mx-auto grid h-12 w-12 place-items-center rounded-full text-[var(--muted-strong)]"
              >
                <BackspaceIcon size={26} weight="duotone" />
              </button>
            ) : <span />}
          </div>
        </div>
      ) : (
        <div key="recent" className="mini-in flex-1 px-4 pt-3 pb-4">
          {recentError ? <p className="rounded-[14px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[13px] text-[var(--danger-text)]">{recentError}</p> : null}
          {recent === null && !recentError ? (
            <div className="space-y-2">{Array.from({ length: 6 }, (_, index) => <span key={index} className="skeleton block h-[60px] rounded-[16px]" />)}</div>
          ) : recent && recent.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-[var(--muted)]">{t('miniapp.phone.no_calls', 'No calls yet')}</p>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-1 pb-1.5 text-[12px] font-semibold tracking-wide text-[var(--muted)] uppercase">{group.label}</p>
                <ul className="overflow-hidden rounded-[18px] bg-[var(--surface)] ring-1 ring-[var(--border)]">
                  {group.items.map((item) => {
                    const missed = missedStatuses.has(item.status)
                    const Icon = missed ? PhoneXIcon : item.direction === 'incoming' ? PhoneIncomingIcon : PhoneOutgoingIcon
                    return (
                      <li key={item.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                        <div className="flex items-center gap-3 px-3.5 py-2.5">
                          <button type="button" onClick={() => void openDetail(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', missed ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : 'bg-[var(--blue-dim)] text-[var(--primary)]')}>
                              <Icon size={19} weight="duotone" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn('block truncate text-[14.5px] font-semibold', missed ? 'text-[var(--danger-text)]' : 'text-[var(--foreground)]')}>{item.customer_name || formatPhone(item.phone_number)}</span>
                              <span className="block truncate text-[12px] text-[var(--muted)] tabular-nums">
                                {item.customer_name ? `${formatPhone(item.phone_number)} · ` : ''}{timeOf(item.started_at)}{item.talk_seconds ? ` · ${clock(item.talk_seconds)}` : ''}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => call(item.phone_number, null)}
                            disabled={!phone.canDial || !allowedToCall}
                            aria-label={t('miniapp.phone.call_back', 'Call back')}
                            className="mini-key grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--success-dim)] text-[var(--success-text)] disabled:opacity-40"
                          >
                            <PhoneCallIcon size={18} weight="duotone" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {/* Call detail sheet: lead, notes, add a note */}
      {detailCall ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button type="button" aria-label={t('common.close', 'Close')} onClick={() => setDetailCall(null)} className="mini-fade absolute inset-0 bg-black/40" />
          <div className="mini-sheet relative max-h-[85dvh] overflow-y-auto rounded-t-[26px] bg-[var(--surface)] px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-[var(--border-hover)]" />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setDetailCall(null)} aria-label={t('common.close', 'Close')} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--muted-strong)]"><ArrowLeftIcon size={17} /></button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-bold text-[var(--foreground)]">{detail?.lead?.full_name || detailCall.customer_name || formatPhone(detailCall.phone_number)}</p>
                <p className="truncate text-[12.5px] text-[var(--muted)] tabular-nums">{formatPhone(detailCall.phone_number)} · {timeOf(detailCall.started_at)}{detailCall.talk_seconds ? ` · ${clock(detailCall.talk_seconds)}` : ''}</p>
              </div>
              <button type="button" onClick={() => { setDetailCall(null); call(detailCall.phone_number, detail?.lead ?? null) }} disabled={!phone.canDial || !allowedToCall} className="mini-key grid h-11 w-11 place-items-center rounded-full bg-[var(--success)] text-white disabled:opacity-40" aria-label={t('miniapp.phone.call_back', 'Call back')}>
                <PhoneIcon size={20} weight="fill" />
              </button>
            </div>
            {detail?.lead ? (
              <div className="mt-3 rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-2.5 text-[13px] text-[var(--muted-strong)]">
                {[detail.lead.status, detail.lead.platform, detail.lead.seller_name].filter(Boolean).join(' · ') || t('miniapp.phone.lead', 'CRM lead')}
              </div>
            ) : null}
            <p className="mt-4 mb-2 text-[13px] font-semibold text-[var(--muted-strong)]">{t('miniapp.phone.notes', 'Notes')}</p>
            <ul className="space-y-2">
              {(detail?.notes ?? []).map((item) => (
                <li key={item.id} className="rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-2.5 text-[13.5px] whitespace-pre-wrap text-[var(--foreground)]">
                  {item.note}
                  <span className="mt-1 block text-[11.5px] text-[var(--muted)]">{[item.created_by_name, timeOf(item.created_at)].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
              {detail && (detail.notes ?? []).length === 0 ? <li className="text-[13px] text-[var(--muted)]">{t('miniapp.phone.no_notes', 'No notes yet')}</li> : null}
            </ul>
            <div className="mt-3 flex items-end gap-2">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder={t('miniapp.phone.note_placeholder', 'Add a note…')}
                className="min-h-[46px] flex-1 resize-none rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
              />
              <button type="button" onClick={() => void saveNote()} disabled={!note.trim() || savingNote} className="h-[46px] rounded-[14px] bg-[var(--primary)] px-4 text-[14px] font-semibold text-white disabled:opacity-40">
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
