import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { normalizePhone, telephonyService, type TelephonyCall, type TelephonyCallDetail, type TelephonyLead } from '../../../shared/api/services/telephony.service'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { useTelephony } from '../../telephony/TelephonyContext'
import { ForwardingTargets } from '../../telephony/components/ForwardingTargets'
import { formatPhone } from '../../telephony/components/telephonyFormat'
import { haptic, useTelegramBack } from '../lib/telegram'
import {
  IcArrowLeft, IcArrowDown, IcArrowUp, IcBackspace, IcClose, IcHash, IcHistory, IcKeypad, IcMicOff, IcNote, IcPencil, IcPhone,
  IcPhoneIn, IcPhoneMissed, IcPhoneOut, IcPlus, IcSliders, IcSpinner, IcTrash, IcWarning,
} from '../ui/icons'
import { Arcs, Skeleton } from '../ui/motion'

type Props = {
  /** The tab is on screen (the microphone is asked for the first time it opens). */
  active: boolean
  onDial: (phone: string, lead?: TelephonyLead | null) => void
  /** RBAC calls:create — without it the keypad is shown but calling is off. */
  canCall: boolean
  /** calls.edit — the employee may change their call forwarding. */
  canEdit?: boolean
  userId?: number
}

const keys: Array<[string, string]> = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
]

/* The forwarding list (shared component) drawn with the Mini App icons. */
const forwardingIcons = {
  up: IcArrowUp, down: IcArrowDown, edit: IcPencil, remove: IcTrash, add: IcPlus, close: IcClose, phone: IcPhone, extension: IcHash, spinner: IcSpinner,
}

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
export function PhoneTab({ active, onDial, canCall: allowedToCall, canEdit = false, userId }: Props) {
  const [forwardingOpen, setForwardingOpen] = useState(false)
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
    haptic('select')
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
  const failed = /fail|unavailable|disabled/i.test(phone.connection)
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

  const views = [
    ['keypad', IcKeypad, t('miniapp.phone.keypad', 'Keypad')],
    ['recent', IcHistory, t('miniapp.phone.recent', 'Recent')],
  ] as const

  return (
    <div className="flex min-h-full flex-col">
      {/* Line state + keypad / recent switch */}
      <div className="m-rise flex items-center justify-between gap-2 px-4 pt-1">
        <span className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full bg-[var(--surface)] px-3.5 text-[12.5px] font-bold text-[var(--muted-strong)] shadow-[var(--m-shadow)]">
          {ready ? <span className="m-live shrink-0 text-[var(--success)]" /> : failed ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]" /> : <Arcs size={14} className="shrink-0 text-[var(--warning)]" />}
          <span className="truncate">{lineText}</span>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && userId ? (
            <button
              type="button"
              onClick={() => { haptic('select'); setForwardingOpen(true) }}
              aria-label={t('miniapp.phone.forwarding', 'Call forwarding')}
              title={t('miniapp.phone.forwarding', 'Call forwarding')}
              className="m-press grid h-10 w-10 place-items-center rounded-full bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--m-shadow)]"
            >
              <IcSliders size={19} />
            </button>
          ) : null}
          <div role="tablist" className="relative grid grid-cols-2 rounded-full bg-[var(--surface)] p-1 shadow-[var(--m-shadow)]">
            <span aria-hidden="true" className="m-seg-pill absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[var(--m-pill-bg)]" style={{ transform: `translateX(${view === 'keypad' ? 0 : 100}%)` }} />
            {views.map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                aria-label={label}
                onClick={() => { haptic('select'); setView(value) }}
                className={cn('relative z-10 grid h-8 w-11 place-items-center rounded-full transition-colors duration-300', view === value ? 'text-[var(--m-pill-fg)]' : 'text-[var(--muted-strong)]')}
              >
                <Icon size={18} duo={view === value ? 0.4 : 0.15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {mic === 'denied' ? (
        <button type="button" onClick={askMicrophone} className="m-pop m-press mx-4 mt-3 flex items-center gap-3 rounded-[22px] bg-[var(--warning-dim)] px-3.5 py-3 text-left text-[var(--warning-text)] ring-1 ring-[var(--warning-border)]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[var(--warning)]/15"><IcMicOff size={21} duo={0.25} /></span>
          <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
            <span className="block text-[13.5px] font-extrabold">{t('miniapp.phone.mic_title', 'Microphone is blocked')}</span>
            {t('miniapp.phone.mic_text', 'Allow the microphone for Telegram to make and answer calls. Tap to try again.')}
          </span>
        </button>
      ) : null}
      {!allowedToCall ? (
        <p className="m-pop mx-4 mt-3 rounded-[18px] bg-[var(--surface)] px-3.5 py-2.5 text-[12.5px] leading-snug text-[var(--muted-strong)] shadow-[var(--m-shadow)]">{t('miniapp.phone.no_call_right', 'You can answer calls and see the history, but placing calls is not allowed for your role.')}</p>
      ) : null}
      {phone.error ? (
        <p className="m-pop mx-4 mt-3 flex items-start gap-2 rounded-[18px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[12.5px] leading-snug text-[var(--danger-text)]">
          <IcWarning size={17} duo={0.25} className="mt-px shrink-0" />{phone.error}
        </p>
      ) : null}

      {view === 'keypad' ? (
        <div key="keypad" className="m-swap flex flex-1 flex-col px-5 pt-3" style={{ '--dx': '-20px' } as CSSProperties}>
          {/* Number */}
          <div className="flex min-h-[64px] flex-col items-center justify-end">
            {picked ? <p className="m-pop mb-1 max-w-full truncate rounded-full bg-[var(--blue-dim)] px-3 py-0.5 text-[13px] font-bold text-[var(--blue-text)]">{picked.full_name}</p> : null}
            <p className={cn('m-display max-w-full truncate font-medium text-[var(--foreground)] transition-[font-size] duration-300', digits.length > 13 ? 'text-[24px]' : 'text-[31px]')} data-i18n-skip="true">
              {digits ? formatPhone(digits) : <span className="font-sans text-[22px] font-semibold tracking-normal text-[var(--caption)]">{t('miniapp.phone.enter', 'Enter a number')}</span>}
            </p>
          </div>

          {/* Matches for the last digits */}
          <div className="mt-1 min-h-[44px]">
            {shownSuggestions.length ? (
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {shownSuggestions.map((lead, index) => (
                  <button
                    key={`${lead.crm_source}-${lead.customer_id}`}
                    type="button"
                    onClick={() => { haptic('select'); setPicked(lead); setDigits(normalizePhone(lead.phone_number)) }}
                    className="m-pop m-press shrink-0 rounded-[16px] bg-[var(--surface)] px-3 py-1.5 text-left shadow-[var(--m-shadow)]"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <span className="block max-w-[160px] truncate text-[13px] font-bold text-[var(--primary)]">{lead.full_name}</span>
                    <span className="block text-[11.5px] text-[var(--muted)] tabular-nums">{formatPhone(lead.phone_number)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Keys */}
          <div className="m-keypad mx-auto mt-1 grid w-full max-w-[318px] grid-cols-3 gap-x-4">
            {keys.map(([key, letters], index) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                onContextMenu={(event) => { if (key === '0') { event.preventDefault(); press('+') } }}
                className="m-press m-rise mx-auto grid h-[var(--key)] w-[calc(var(--key)*1.22)] place-items-center rounded-[calc(var(--key)*0.42)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--m-shadow)] active:bg-[var(--blue-dim)]"
                style={{ '--i': Math.floor(index / 3) } as CSSProperties}
              >
                <span className="flex flex-col items-center leading-none">
                  <span className="m-display text-[calc(var(--key)*0.36)] font-medium">{key}</span>
                  {letters ? <span className="mt-1 text-[9px] font-bold tracking-[0.16em] text-[var(--caption)]">{letters}</span> : null}
                </span>
              </button>
            ))}
          </div>

          {/* Call + backspace */}
          <div className="m-keypad mx-auto mt-4 mb-3 grid w-full max-w-[318px] grid-cols-3 items-center gap-x-4">
            <span />
            <button
              type="button"
              onClick={() => call()}
              disabled={!canCall}
              aria-label={t('miniapp.phone.call', 'Call')}
              className={cn(
                'm-press mx-auto grid h-[calc(var(--key)+8px)] w-[calc(var(--key)*1.22+8px)] place-items-center rounded-[calc(var(--key)*0.46)] transition-[background-color,box-shadow,color] duration-300',
                canCall ? 'bg-[var(--m-lime)] text-[var(--m-lime-ink)] shadow-[0_16px_30px_-14px_color-mix(in_srgb,var(--m-lime)_90%,#000)]' : 'bg-[var(--muted-surface)] text-[var(--caption)]',
              )}
            >
              <IcPhone size={30} duo={0.3} strokeWidth={2.1} />
            </button>
            {digits ? (
              <button
                type="button"
                onClick={backspace}
                onContextMenu={(event) => { event.preventDefault(); setDigits(''); setPicked(null) }}
                aria-label={t('miniapp.phone.backspace', 'Delete')}
                className="m-press m-pop mx-auto grid h-12 w-12 place-items-center rounded-full text-[var(--muted-strong)]"
              >
                <IcBackspace size={26} duo={0.18} />
              </button>
            ) : <span />}
          </div>
        </div>
      ) : (
        <div key="recent" className="m-swap flex-1 px-4 pt-4 pb-4" style={{ '--dx': '20px' } as CSSProperties}>
          {recentError ? <p className="mb-3 flex items-start gap-2 rounded-[18px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[12.5px] text-[var(--danger-text)]"><IcWarning size={17} duo={0.25} className="mt-px shrink-0" />{recentError}</p> : null}
          {recent === null && !recentError ? (
            <div className="space-y-2.5">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[64px] rounded-[22px]" style={{ animationDelay: `${index * 90}ms` }} />)}</div>
          ) : recent && recent.length === 0 ? (
            <div className="m-pop flex flex-col items-center py-14 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--surface)] text-[var(--muted)] shadow-[var(--m-shadow)]"><IcHistory size={28} /></span>
              <p className="mt-3 text-[14px] font-semibold text-[var(--muted)]">{t('miniapp.phone.no_calls', 'No calls yet')}</p>
            </div>
          ) : (
            grouped.map((group, groupIndex) => (
              <div key={group.label} className="m-rise mb-4" style={{ '--i': groupIndex } as CSSProperties}>
                <p className="m-display px-1 pb-2 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">{group.label}</p>
                <ul className="m-card overflow-hidden">
                  {group.items.map((item) => {
                    const missed = missedStatuses.has(item.status)
                    const Icon = missed ? IcPhoneMissed : item.direction === 'incoming' ? IcPhoneIn : IcPhoneOut
                    return (
                      <li key={item.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                        <div className="flex items-center gap-3 px-3.5 py-2.5">
                          <button type="button" onClick={() => void openDetail(item)} className="m-press flex min-w-0 flex-1 items-center gap-3 text-left">
                            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[15px]', missed ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : item.direction === 'incoming' ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'bg-[var(--success-dim)] text-[var(--success-text)]')}>
                              <Icon size={20} duo={0.22} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn('block truncate text-[14.5px] font-bold', missed ? 'text-[var(--danger-text)]' : 'text-[var(--foreground)]')}>{item.customer_name || formatPhone(item.phone_number)}</span>
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
                            className="m-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--m-lime)] text-[var(--m-lime-ink)] disabled:bg-[var(--muted-surface)] disabled:text-[var(--caption)]"
                          >
                            <IcPhone size={18} duo={0.3} />
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

      {/* Call forwarding (calls.edit): where calls go when the Mini App is offline or does not answer */}
      {forwardingOpen && userId ? (
        <Sheet
          onClose={() => setForwardingOpen(false)}
          title={t('miniapp.phone.forwarding', 'Call forwarding')}
          subtitle={t('miniapp.phone.forwarding_hint', 'Where calls go when this app is offline or does not answer.')}
          closeLabel={t('common.close', 'Close')}
        >
          <ForwardingTargets userId={userId} icons={forwardingIcons} />
        </Sheet>
      ) : null}

      {/* Call detail sheet: lead, notes, add a note */}
      {detailCall ? (
        <Sheet
          onClose={() => setDetailCall(null)}
          title={detail?.lead?.full_name || detailCall.customer_name || formatPhone(detailCall.phone_number)}
          subtitle={`${formatPhone(detailCall.phone_number)} · ${timeOf(detailCall.started_at)}${detailCall.talk_seconds ? ` · ${clock(detailCall.talk_seconds)}` : ''}`}
          closeLabel={t('common.close', 'Close')}
          action={(
            <button type="button" onClick={() => { setDetailCall(null); call(detailCall.phone_number, detail?.lead ?? null) }} disabled={!phone.canDial || !allowedToCall} className="m-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--m-lime)] text-[var(--m-lime-ink)] disabled:bg-[var(--muted-surface)] disabled:text-[var(--caption)]" aria-label={t('miniapp.phone.call_back', 'Call back')}>
              <IcPhone size={20} duo={0.3} />
            </button>
          )}
        >
          {detail?.lead ? (
            <div className="rounded-[18px] bg-[var(--blue-dim)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--blue-text)]">
              {[detail.lead.status, detail.lead.platform, detail.lead.seller_name].filter(Boolean).join(' · ') || t('miniapp.phone.lead', 'CRM lead')}
            </div>
          ) : null}
          <p className="m-display mt-4 mb-2 text-[11px] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">{t('miniapp.phone.notes', 'Notes')}</p>
          {!detail ? <Skeleton className="h-14 rounded-[18px]" /> : null}
          <ul className="space-y-2">
            {(detail?.notes ?? []).map((item, index) => (
              <li key={item.id} className="m-rise rounded-[18px] bg-[var(--muted-surface)] px-3.5 py-2.5 text-[13.5px] whitespace-pre-wrap text-[var(--foreground)]" style={{ '--i': index } as CSSProperties}>
                {item.note}
                <span className="mt-1 block text-[11.5px] text-[var(--muted)]">{[item.created_by_name, timeOf(item.created_at)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
            {detail && (detail.notes ?? []).length === 0 ? <li className="flex items-center gap-2 text-[13px] text-[var(--muted)]"><IcNote size={17} duo={0.15} />{t('miniapp.phone.no_notes', 'No notes yet')}</li> : null}
          </ul>
          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder={t('miniapp.phone.note_placeholder', 'Add a note…')}
              className="min-h-[50px] flex-1 resize-none rounded-[18px] border border-[var(--border)] bg-[var(--muted-surface)] px-3.5 py-2.5 text-[14px] text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:outline-none"
            />
            <button type="button" onClick={() => void saveNote()} disabled={!note.trim() || savingNote} className="m-press grid h-[50px] min-w-[50px] place-items-center rounded-[18px] bg-[var(--foreground)] px-4 text-[14px] font-bold text-[var(--app-canvas)] disabled:opacity-35">
              {savingNote ? <Arcs size={18} /> : t('common.save', 'Save')}
            </button>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}

/** Bottom sheet with a grabber; Telegram's Back button closes it too. */
function Sheet({ title, subtitle, closeLabel, action, onClose, children }: { title: string; subtitle?: string; closeLabel: string; action?: ReactNode; onClose: () => void; children: ReactNode }) {
  useTelegramBack(true, onClose)
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={closeLabel} onClick={onClose} className="m-fade absolute inset-0 bg-[var(--backdrop)] backdrop-blur-[2px]" />
      <div className="m-sheet relative max-h-[88dvh] overflow-y-auto rounded-t-[32px] bg-[var(--surface)] px-4 pt-3 pb-[max(18px,env(safe-area-inset-bottom))] shadow-[var(--m-shadow-lift)]">
        <span className="mx-auto mb-3 block h-1.5 w-11 rounded-full bg-[var(--border-hover)]" />
        <div className="mb-4 flex items-center gap-3">
          <button type="button" onClick={onClose} aria-label={closeLabel} className="m-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--foreground)]"><IcArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-extrabold text-[var(--foreground)]">{title}</p>
            {subtitle ? <p className="truncate text-[12.5px] text-[var(--muted)] tabular-nums">{subtitle}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  )
}
