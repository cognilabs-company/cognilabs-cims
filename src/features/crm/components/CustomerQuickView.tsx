import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AtSign,
  Bot,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  Download,
  Languages,
  Loader2,
  MessagesSquare,
  Pencil,
  Phone,
  PhoneCall,
  SendHorizontal,
  Sparkles,
  Timer,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { CustomerSummary } from '../../../shared/api/types'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { cn } from '../../../shared/lib/cn'
import { formatUsernameHandle, getCustomerDisplayName, getCustomerDisplayPlatform } from '../../../shared/lib/customer-display'
import { formatNumericDate, formatNumericDateTime } from '../../../shared/lib/format'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useToast } from '../../../shared/toast/useToast'
import { useAuth } from '../../auth/hooks/useAuth'
import { useTelephony } from '../../telephony/TelephonyContext'
import { connectionLabel, formatPhone, hueOf, initialOf } from '../../telephony/components/telephonyFormat'
import { useCrmScope } from '../lib/crmScope'
import { formatConversationLanguageLabel, formatCustomerNotes } from '../lib/customerNotes'
import { getCustomerActionErrorMessage } from '../lib/customerErrors'
import { platformVisual } from '../lib/platformIcon'
import { getRecallTimeTone } from '../lib/recallTime'
import { statusIconFor } from '../lib/statusIcon'
import { formatClock, formatDayShort, wallFromInstant, type WallTime } from '../lib/tashkentTime'
import { AudioPlayerCard } from './AudioPlayerCard'
import { CopyButton, StatusPill } from './CustomerFilters'
import { RecallTimePicker } from './RecallTimePicker'

export type QuickStatusChoice = { value: string; label: string; color: string; icon: LucideIcon }

const statusKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

/* ── small building blocks ─────────────────────────────── */

function HeaderIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]"
    >
      {children}
    </button>
  )
}

function QuickAction({ icon: Icon, label, hint, tone, active, disabled, busy, onClick, href }: {
  icon: LucideIcon
  label: string
  hint: ReactNode
  tone: string
  active?: boolean
  disabled?: boolean
  busy?: boolean
  onClick?: () => void
  href?: string
}) {
  const body = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] transition-transform duration-200 group-hover/qa:scale-105" style={{ color: tone, background: `color-mix(in srgb, ${tone} 13%, transparent)` }}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Icon size={17} strokeWidth={2.1} />}
      </span>
      <span className="w-full min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">{label}</span>
        <span className="block truncate text-[11.5px] text-[var(--muted)]">{hint}</span>
      </span>
    </>
  )
  const className = cn(
    'group/qa flex min-w-0 flex-col items-start gap-2 rounded-[14px] border px-2.5 py-2.5 transition-[border-color,background-color,box-shadow,transform] duration-200 sm:flex-row sm:items-center sm:gap-2.5',
    active
      ? 'border-[var(--primary)] bg-[var(--blue-dim)] shadow-[0_0_0_3px_var(--blue-dim)]'
      : 'border-[var(--border)] bg-[var(--surface)] hover:-translate-y-px hover:border-[var(--border-hover)] hover:shadow-[var(--elev-sm)]',
    disabled && 'pointer-events-none opacity-50',
  )
  if (href) return <a href={href} className={className}>{body}</a>
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-expanded={active} className={className}>
      {body}
    </button>
  )
}

function InfoRow({ icon: Icon, label, children, color }: { icon: LucideIcon; label: string; children: ReactNode; color?: string }) {
  return (
    <div className="group/row flex min-w-0 items-center gap-2.5 py-1.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[var(--muted-surface)]" style={color ? { color } : undefined}>
        <Icon size={14} className={color ? undefined : 'text-[var(--muted-strong)]'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-[var(--muted)]">{label}</span>
        <span className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-[var(--foreground)]">{children}</span>
      </span>
    </div>
  )
}

function SectionLabel({ icon: Icon, children, aside }: { icon: LucideIcon; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
        <Icon size={13} /> {children}
      </p>
      {aside}
    </div>
  )
}

/* ── notes ─────────────────────────────────────────────── */

type NoteItem = { id: number | string; note: string; author: string; createdAt: string | null; isAi: boolean }

/** `readOnly` (no RBAC customers:edit) hides adding, editing and deleting notes. */
function CustomerNotes({ customer, readOnly = false }: { customer: CustomerSummary; readOnly?: boolean }) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user } = useAuth()
  const { service: crmService } = useCrmScope()
  const notesQuery = useAsyncData(() => crmService.getAdditionalNotes(customer.id), [customer.id], { enabled: Boolean(customer.id) })
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [editingText, setEditingText] = useState('')

  const aiNotes: NoteItem[] = formatCustomerNotes(customer.notes).map((text, index) => ({ id: `ai-${index}`, note: text, author: 'Cognilabs AI', createdAt: null, isAi: true }))
  const ownName = user ? `${user.name} ${user.surname}` : ''
  const extraNotes: NoteItem[] = (notesQuery.data?.items ?? []).map((note) => ({
    id: note.id,
    note: note.note,
    author: user && note.created_by === user.id ? ownName : note.created_by_full_name,
    createdAt: note.created_at,
    isAi: false,
  }))
  const notes = [...extraNotes.slice().reverse(), ...aiNotes]

  const fail = (error: unknown) => showToast({ title: t('common.error', 'Error'), description: getCustomerActionErrorMessage(error, t), tone: 'error' })

  async function add() {
    const text = draft.trim()
    if (!text) return
    setAdding(true)
    try {
      await crmService.addAdditionalNote(customer.id, text)
      setDraft('')
      void notesQuery.refetch()
    } catch (error) { fail(error) } finally { setAdding(false) }
  }

  async function update(noteId: number) {
    const text = editingText.trim()
    if (!text) return
    try {
      await crmService.updateAdditionalNote(customer.id, noteId, text)
      setEditingId(null)
      void notesQuery.refetch()
    } catch (error) { fail(error) }
  }

  async function remove(noteId: number) {
    const ok = await confirm({
      title: t('common.delete_confirm', 'Are you sure?'),
      description: t('customers.notes.delete_description', 'This note will be permanently removed.'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await crmService.deleteAdditionalNote(customer.id, noteId)
      void notesQuery.refetch()
    } catch (error) { fail(error) }
  }

  return (
    <section>
      <SectionLabel icon={MessagesSquare} aside={notes.length ? <span className="text-[11px] font-semibold text-[var(--caption)] tabular-nums">{notes.length}</span> : null}>
        {t('customers.detail.notes.title', 'Notes')}
      </SectionLabel>

      {readOnly ? null : <div className="flex items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] py-1 pr-1 pl-3 transition-colors focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_3px_var(--blue-dim)]">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) void add() }}
          placeholder={t('customers.notes.add_placeholder', 'Add a new note...')}
          aria-label={t('customers.notes.add_placeholder', 'Add a new note...')}
          className="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-[var(--foreground)] placeholder:text-[var(--caption)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={adding || !draft.trim()}
          aria-label={t('common.add', 'Add')}
          title={t('common.add', 'Add')}
          className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--primary)] text-white transition-[opacity,transform] active:scale-95 disabled:opacity-30"
        >
          {adding ? <Loader2 size={15} className="animate-spin" /> : <SendHorizontal size={15} />}
        </button>
      </div>}

      {notesQuery.isLoading && notes.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-[var(--muted)]"><Loader2 size={14} className="animate-spin" />{t('common.loading', 'Loading...')}</p>
      ) : notes.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-[var(--muted)]">{t('customers.detail.notes.empty_title', 'No notes')}</p>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {notes.map((note) => (
            <li key={String(note.id)} className="group/note rounded-[12px] bg-[var(--muted-surface)] px-3 py-2.5">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full resize-none rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => setEditingId(null)} className="h-7 rounded-[8px] px-2.5 text-[12px] font-semibold text-[var(--muted-strong)] hover:bg-[var(--surface)]">{t('common.cancel', 'Cancel')}</button>
                    <button type="button" onClick={() => void update(Number(note.id))} className="h-7 rounded-[8px] bg-[var(--primary)] px-2.5 text-[12px] font-semibold text-white">{t('common.save', 'Save')}</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[13px] leading-[1.55] whitespace-pre-wrap text-[var(--foreground)]">{note.note}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1 truncate text-[11.5px] text-[var(--muted)]">
                      {note.isAi ? <Sparkles size={11} className="shrink-0 text-[var(--violet-text)]" /> : null}
                      <span className="truncate">{note.author}{note.createdAt ? ` · ${formatNumericDateTime(note.createdAt)}` : ''}</span>
                    </p>
                    {!note.isAi && !readOnly ? (
                      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/note:opacity-100 focus-within:opacity-100">
                        <button type="button" onClick={() => { setEditingId(note.id); setEditingText(note.note) }} title={t('common.edit', 'Edit')} aria-label={t('common.edit', 'Edit')} className="grid h-6 w-6 place-items-center rounded-[7px] text-[var(--muted-strong)] hover:bg-[var(--surface)] hover:text-[var(--primary)]"><Pencil size={12} /></button>
                        <button type="button" onClick={() => void remove(Number(note.id))} title={t('common.delete', 'Delete')} aria-label={t('common.delete', 'Delete')} className="grid h-6 w-6 place-items-center rounded-[7px] text-[var(--muted-strong)] hover:bg-[var(--surface)] hover:text-[var(--danger-text)]"><Trash2 size={12} /></button>
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ── the modal body ────────────────────────────────────── */

type CustomerQuickViewProps = {
  customer: CustomerSummary
  audioSource: string | null
  statusChoices?: QuickStatusChoice[]
  onChangeStatus?: (next: string) => Promise<boolean>
  /** Omitted for read-only users: the recall tile only shows the time. */
  onSaveRecall?: (wall: WallTime | null) => Promise<boolean>
  onClose: () => void
  onEdit?: () => void
  onSearchTelegram?: () => void
  onOpenChat?: () => void
}

export function CustomerQuickView({
  customer, audioSource, statusChoices, onChangeStatus, onSaveRecall, onClose, onEdit, onSearchTelegram, onOpenChat,
}: CustomerQuickViewProps) {
  const { t, locale } = useLocale()
  const { can } = useAuth()
  const { kind } = useCrmScope()
  const phone = useTelephony()
  const [panel, setPanel] = useState<'recall' | 'status' | null>(null)
  const [savingRecall, setSavingRecall] = useState(false)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const name = getCustomerDisplayName(customer)
  const phoneNumber = (customer.phone_number ?? customer.phone ?? '').trim()
  const platform = getCustomerDisplayPlatform(customer)
  const platformLook = platform ? platformVisual(platform) : null
  const username = formatUsernameHandle(customer.username)
  const hue = hueOf(name || phoneNumber || String(customer.id))

  const currentKey = statusKey(customer.status ?? '')
  const statusChoice = statusChoices?.find((choice) => statusKey(choice.value) === currentKey)
  const status = {
    label: statusChoice?.label ?? t(`crm.status_label.${currentKey}`, (customer.status ?? '').replace(/_/g, ' ') || '—'),
    color: statusChoice?.color ?? '#8A90A2',
    icon: statusChoice?.icon ?? statusIconFor(customer.status ?? ''),
  }

  // Recall summary on the quick tile
  const recallMs = customer.recall_time ? new Date(customer.recall_time).getTime() : Number.NaN
  const recallWall = Number.isNaN(recallMs) ? null : wallFromInstant(recallMs)
  const recallTone = getRecallTimeTone(customer.recall_time)
  const recallColor = recallTone === 'past' ? 'var(--danger)' : recallTone === 'active' ? 'var(--warning)' : recallTone === 'future' ? 'var(--success)' : 'var(--primary)'

  // Telephony
  // RBAC calls:create → dial through the CIMS line; otherwise fall back to the device's own dialer (tel:).
  const telephonyAllowed = can('calls', 'create')
  const phoneReady = phone.canDial
  const callHint = !phoneNumber
    ? t('customers.quick.no_phone', 'No phone number')
    : !telephonyAllowed || phoneReady
      ? formatPhone(phoneNumber)
      : phone.sessionStatus || phone.call || phone.mobileCall
        ? t('customers.quick.call_busy', 'Another call is active')
        : connectionLabel(phone.connection)

  const conversationId = (() => {
    const match = customer.chat_url?.match(/conversation_id=(\d+)/)
    return match ? Number(match[1]) : null
  })()

  // Escape closes an open panel first (before the modal)
  useEffect(() => {
    if (!panel) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setPanel(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [panel])

  // Bring the opened panel into view inside the modal
  useEffect(() => {
    if (panel) panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [panel])

  function call() {
    if (!phoneNumber) return
    phone.dial(phoneNumber, {
      crm_source: kind === 'outbound' ? 'crm_outbound' : 'crm',
      customer_id: customer.id,
      full_name: name,
      phone_number: phoneNumber,
      status: customer.status ?? null,
      platform: platform ?? null,
      seller_id: null,
      seller_name: null,
    })
  }

  async function saveRecall(wall: WallTime | null) {
    setSavingRecall(true)
    if (!onSaveRecall) return
    const ok = await onSaveRecall(wall)
    setSavingRecall(false)
    if (ok) setPanel(null)
  }

  async function pickStatus(next: string) {
    if (!onChangeStatus || statusKey(next) === currentKey) { setPanel(null); return }
    setSavingStatus(next)
    const ok = await onChangeStatus(next)
    setSavingStatus(null)
    if (ok) setPanel(null)
  }

  const language = customer.conversation_language ? formatConversationLanguageLabel((key, fallback) => t(key, fallback), customer.conversation_language) : null
  const metrics = customer.lead_response_metrics

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <header className="flex items-start gap-3 px-4 pt-4 pb-3 sm:px-5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[17px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
          style={{ background: `linear-gradient(140deg, hsl(${hue} 72% 60%) 0%, hsl(${hue + 40} 68% 44%) 100%)` }}
        >
          {initialOf(name) || '?'}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="truncate text-[16.5px] leading-6 font-semibold tracking-[-0.015em] text-[var(--foreground)]">{name}</h2>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <StatusPill label={status.label} color={status.color} icon={status.icon} />
            {platform && platformLook ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--muted-strong)]">
                <platformLook.icon size={12} style={{ color: platformLook.color }} /> {platform}
              </span>
            ) : null}
          </div>
        </div>
        <div className="-mt-0.5 -mr-1.5 flex shrink-0 items-center gap-0.5">
          {onEdit ? <HeaderIconButton label={t('customers.detail.edit', 'Edit')} onClick={onEdit}><Pencil size={15} /></HeaderIconButton> : null}
          {onSearchTelegram && phoneNumber ? <HeaderIconButton label={t('customers.detail.search_telegram', 'Search Telegram')} onClick={onSearchTelegram}><AtSign size={15} /></HeaderIconButton> : null}
          {onOpenChat && conversationId ? <HeaderIconButton label={t('customers.detail.view_chat', 'Chat')} onClick={onOpenChat}><MessagesSquare size={15} /></HeaderIconButton> : null}
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <HeaderIconButton label={t('common.close', 'Close')} onClick={onClose}><X size={16} /></HeaderIconButton>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-5 sm:px-5">
        {/* quick actions */}
        <section>
          <div className={cn('grid gap-2', statusChoices && onChangeStatus ? 'grid-cols-3' : 'grid-cols-2')}>
            <QuickAction
              icon={CalendarClock}
              label={t('customers.quick.recall', 'Call back')}
              hint={recallWall ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: recallColor }} />
                  {formatDayShort(locale, recallWall.date)}, {formatClock(recallWall)}
                </span>
              ) : t('customers.quick.recall_none', 'Not scheduled')}
              tone="var(--primary)"
              active={panel === 'recall'}
              disabled={!onSaveRecall}
              onClick={() => setPanel((open) => (open === 'recall' ? null : 'recall'))}
            />
            <QuickAction
              icon={PhoneCall}
              label={t('customers.quick.call', 'Call')}
              hint={callHint}
              tone="var(--success)"
              disabled={!phoneNumber || (telephonyAllowed && !phoneReady)}
              href={!telephonyAllowed && phoneNumber ? `tel:${phoneNumber.replace(/[^\d+]/g, '')}` : undefined}
              onClick={telephonyAllowed ? call : undefined}
            />
            {statusChoices && onChangeStatus ? (
              <QuickAction
                icon={status.icon}
                label={t('customers.quick.status', 'Status')}
                hint={status.label}
                tone={status.color}
                active={panel === 'status'}
                onClick={() => setPanel((open) => (open === 'status' ? null : 'status'))}
              />
            ) : null}
          </div>

          <div ref={panelRef} className="scroll-mt-3">
            {panel === 'recall' ? (
              <div className="mt-2">
                <RecallTimePicker
                  value={customer.recall_time}
                  saving={savingRecall}
                  onSave={(wall) => void saveRecall(wall)}
                  onClear={() => void saveRecall(null)}
                  onCancel={() => setPanel(null)}
                />
              </div>
            ) : null}

            {panel === 'status' && statusChoices ? (
              <div className="qa-panel mt-2 grid grid-cols-2 gap-1 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--elev-sm)] sm:grid-cols-3">
                {statusChoices.map((choice) => {
                  const selected = statusKey(choice.value) === currentKey
                  const busy = savingStatus === choice.value
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => void pickStatus(choice.value)}
                      disabled={Boolean(savingStatus)}
                      aria-pressed={selected}
                      className={cn(
                        'flex min-w-0 items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors disabled:cursor-wait',
                        selected ? 'bg-[var(--muted-surface)] text-[var(--foreground)]' : 'text-[var(--muted-strong)] hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]',
                      )}
                    >
                      <span className="status-tint grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border-0" style={{ '--tint': choice.color } as CSSProperties}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <choice.icon size={13} strokeWidth={2.3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                      {selected ? <Check size={14} className="shrink-0 text-[var(--primary)]" /> : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </section>

        {/* details */}
        <section className="grid grid-cols-1 gap-x-4 rounded-[16px] border border-[var(--border)] px-3 py-1.5 sm:grid-cols-2">
          <InfoRow icon={Phone} label={t('common.phone', 'Phone')}>
            <span className="truncate tabular-nums">{phoneNumber ? formatPhone(phoneNumber) : '—'}</span>
            {phoneNumber ? <CopyButton value={phoneNumber} label={t('customers.copy_phone', 'Copy phone')} /> : null}
          </InfoRow>
          {username ? (
            <InfoRow icon={AtSign} label={t('common.username', 'Username')}>
              <span className="truncate">{username}</span>
              <CopyButton value={username} label={t('common.copy', 'Copy')} />
            </InfoRow>
          ) : null}
          {platform && platformLook ? (
            <InfoRow icon={platformLook.icon} color={platformLook.color} label={t('common.platform', 'Platform')}>
              <span className="truncate">{platform}</span>
            </InfoRow>
          ) : null}
          {customer.assistant_name ? (
            <InfoRow icon={Bot} label={t('common.assistant', 'Assistant')}>
              <span className="truncate">{customer.assistant_name}</span>
            </InfoRow>
          ) : null}
          {language ? (
            <InfoRow icon={Languages} label={t('common.conversation_language', 'Conversation language')}>
              <span className="truncate">{language}</span>
            </InfoRow>
          ) : null}
          <InfoRow icon={CalendarPlus} label={t('common.created', 'Created')}>
            <span className="truncate tabular-nums">{formatNumericDate(customer.created_at)}</span>
          </InfoRow>
        </section>

        {/* lead response */}
        {metrics ? (
          <section className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[14px] bg-[var(--muted-surface)] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--muted-strong)]">
              <Timer size={14} />
              {t('customers.detail.lead_response.title', 'Response time')}
              <strong className={cn('font-semibold', metrics.is_late_response ? 'text-[var(--danger-text)]' : 'text-[var(--success-text)]')}>{metrics.response_human ?? '—'}</strong>
            </span>
            <span className="flex flex-wrap gap-1">
              {!metrics.status_changed ? <span className="rounded-[6px] bg-[var(--warning-dim)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--warning-text)]">{t('customers.detail.lead_response.not_contacted', 'Not contacted yet')}</span> : null}
              {metrics.status_changed && !metrics.is_late_response ? <span className="rounded-[6px] bg-[var(--success-dim)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--success-text)]">{t('customers.detail.lead_response.on_time', 'On time')}</span> : null}
              {metrics.is_late_response ? <span className="rounded-[6px] bg-[var(--danger-dim)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--danger-text)]">{t('customers.detail.lead_response.late', 'Late')}</span> : null}
              {metrics.status_changed_without_note ? <span className="rounded-[6px] bg-[var(--warning-dim)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--warning-text)]">{t('customers.detail.lead_response.no_note', 'No note written')}</span> : null}
            </span>
            <span className="ml-auto text-[11px] text-[var(--muted)]">SLA {metrics.response_limit_minutes} {t('customers.recall.unit_min_short', 'min')}</span>
          </section>
        ) : null}

        {/* AI summary */}
        {customer.aisummary ? (
          <section>
            <SectionLabel icon={Sparkles}>{t('customers.detail.ai_summary.title', 'AI summary')}</SectionLabel>
            <div className="rounded-[14px] bg-[color-mix(in_srgb,var(--violet-dim)_70%,transparent)] px-3.5 py-3">
              <p className={cn('text-[13px] leading-[1.6] whitespace-pre-wrap text-[var(--muted-strong)]', !summaryOpen && 'line-clamp-4')}>{customer.aisummary}</p>
              {customer.aisummary.length > 260 ? (
                <button type="button" onClick={() => setSummaryOpen((open) => !open)} className="mt-1 inline-flex items-center gap-0.5 text-[12px] font-semibold text-[var(--violet-text)]">
                  {summaryOpen ? t('common.show_less', 'Show less') : t('common.show_more', 'Show more')}
                  <ChevronDown size={13} className={cn('transition-transform', summaryOpen && 'rotate-180')} />
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* audio */}
        {audioSource ? (
          <section>
            <SectionLabel
              icon={Phone}
              aside={<a href={audioSource} download className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--primary)] hover:underline"><Download size={12} />{t('common.download', 'Download')}</a>}
            >
              {t('customers.detail.recording', 'Recording')}
            </SectionLabel>
            <AudioPlayerCard src={audioSource} name={name} />
          </section>
        ) : null}

        <CustomerNotes customer={customer} readOnly={!onSaveRecall} />
      </div>
    </div>
  )
}
