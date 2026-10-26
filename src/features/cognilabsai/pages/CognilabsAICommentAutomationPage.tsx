import { useState } from 'react'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { formatShortDateTime } from '../../../shared/lib/format'
import { Button } from '../../../shared/ui/button'
import { Textarea } from '../../../shared/ui/textarea'
import { Switch } from '../../../shared/ui/switch'
import { Dialog } from '../../../shared/ui/dialog'
import { Label } from '../../../shared/ui/label'
import {
  cognilabsaiService,
  type CommentAutomationEvent,
  type CommentAutomationEventStatus,
  type CommentAutomationEventsResponse,
  type CommentAutomationMedia,
  type CommentAutomationMediaListResponse,
  type CommentAutomationReplyMode,
  type CommentAutomationSettings,
  type CommentAutomationSettingsPayload,
} from '../../../shared/api/services/cognilabsai.service'

const PAGE_SIZE = 25
const BULK_CHUNK_SIZE = 5000
const EVENTS_PAGE_SIZE = 50
const MAX_PAGE_REQUESTS = 1000
const INSTAGRAM_GRADIENT = 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
const TEMPLATE_PLACEHOLDERS = ['{username}', '{comment}', '{post_caption}'] as const

type SettingsDraft = {
  automation_enabled: boolean
  public_reply_enabled: boolean
  public_reply_mode: CommentAutomationReplyMode
  public_reply_template: string
  dm_enabled: boolean
  dm_mode: CommentAutomationReplyMode
  dm_template: string
  ai_instructions: string
}

type EventFilter = 'all' | CommentAutomationEventStatus

const STATUS_CONFIG: Record<CommentAutomationEventStatus, { label: string; className: string }> = {
  received: { label: 'Qabul qilindi', className: 'border-sky-500/30 bg-sky-500/10 text-sky-500' },
  processing: { label: 'Ishlanmoqda', className: 'border-blue-500/30 bg-blue-500/10 text-blue-500' },
  sent: { label: 'Yuborildi', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' },
  partial: { label: 'Qisman', className: 'border-orange-500/40 bg-orange-500/10 text-orange-500' },
  failed: { label: 'Xato', className: 'border-red-500/50 bg-red-500/15 text-red-500' },
  unknown: { label: "Noma'lum", className: 'border-amber-500/50 bg-amber-500/15 text-amber-500' },
  skipped: { label: "O'tkazildi", className: 'border-[var(--border)] bg-[var(--muted-surface)] text-[var(--muted)]' },
}

const EVENT_FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'received', label: STATUS_CONFIG.received.label },
  { key: 'processing', label: STATUS_CONFIG.processing.label },
  { key: 'sent', label: STATUS_CONFIG.sent.label },
  { key: 'partial', label: STATUS_CONFIG.partial.label },
  { key: 'failed', label: STATUS_CONFIG.failed.label },
  { key: 'unknown', label: STATUS_CONFIG.unknown.label },
  { key: 'skipped', label: STATUS_CONFIG.skipped.label },
]

function normalizeMode(mode: string | null | undefined): CommentAutomationReplyMode {
  return mode === 'template' ? 'template' : 'ai'
}

function draftFromSettings(settings: CommentAutomationSettings): SettingsDraft {
  return {
    automation_enabled: Boolean(settings.automation_enabled),
    public_reply_enabled: Boolean(settings.public_reply_enabled),
    public_reply_mode: normalizeMode(settings.public_reply_mode),
    public_reply_template: settings.public_reply_template ?? '',
    dm_enabled: Boolean(settings.dm_enabled),
    dm_mode: normalizeMode(settings.dm_mode),
    dm_template: settings.dm_template ?? '',
    ai_instructions: settings.ai_instructions ?? '',
  }
}

function emptyBulkDraft(): SettingsDraft {
  return {
    automation_enabled: true,
    public_reply_enabled: true,
    public_reply_mode: 'ai',
    public_reply_template: '',
    dm_enabled: true,
    dm_mode: 'ai',
    dm_template: '',
    ai_instructions: '',
  }
}

function isSameDraft(a: SettingsDraft, b: SettingsDraft) {
  return (Object.keys(a) as Array<keyof SettingsDraft>).every((key) => a[key] === b[key])
}

function validateDraft(draft: SettingsDraft): string | null {
  if (draft.automation_enabled && !draft.public_reply_enabled && !draft.dm_enabled) {
    return "Automation yoqilganda Public javob yoki DM'dan kamida bittasi yoqilgan bo'lishi kerak."
  }

  if (draft.public_reply_enabled && draft.public_reply_mode === 'template' && !draft.public_reply_template.trim()) {
    return "Public javob template rejimida: template matni bo'sh bo'lmasin."
  }

  if (draft.dm_enabled && draft.dm_mode === 'template' && !draft.dm_template.trim()) {
    return "DM template rejimida: template matni bo'sh bo'lmasin."
  }

  return null
}

function payloadFromDraft(draft: SettingsDraft): CommentAutomationSettingsPayload {
  return {
    automation_enabled: draft.automation_enabled,
    public_reply_enabled: draft.public_reply_enabled,
    public_reply_mode: draft.public_reply_mode,
    public_reply_template: draft.public_reply_template.trim() || null,
    dm_enabled: draft.dm_enabled,
    dm_mode: draft.dm_mode,
    dm_template: draft.dm_template.trim() || null,
    ai_instructions: draft.ai_instructions.trim() || null,
  }
}

function getSettingsKey(media: CommentAutomationMedia) {
  return JSON.stringify(draftFromSettings(media))
}

function getNextCursor(response: CommentAutomationMediaListResponse) {
  return response.next_cursor && response.has_more !== false ? response.next_cursor : null
}

function appendUniqueMedia(current: CommentAutomationMedia[], incoming: CommentAutomationMedia[]) {
  const seen = new Set(current.map((item) => item.media_id))
  return [...current, ...incoming.filter((item) => !seen.has(item.media_id))]
}

function chunkIds(ids: string[], size: number) {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}

function getBulkFailureTitle(index: number, total: number) {
  if (total === 1) return "O'zgarish saqlanmadi"
  if (index === 0) return `1/${total}-bo'lak saqlanmadi, hech narsa o'zgarmadi`
  return `${index + 1}/${total}-bo'lak saqlanmadi. Oldingi ${index} ta bo'lak saqlandi, qolganlari yuborilmadi.`
}

function getMediaKindLabel(media: CommentAutomationMedia) {
  if (media.media_product_type === 'REELS') return 'Reel'
  if (media.media_product_type === 'STORY') return 'Story'
  if (media.media_product_type === 'AD') return 'Ad'
  if (media.media_type === 'CAROUSEL_ALBUM') return 'Carousel'
  if (media.media_type === 'VIDEO') return 'Video'
  return 'Post'
}

function getPreviewUrl(media: CommentAutomationMedia) {
  if (media.thumbnail_url) return media.thumbnail_url
  if (media.media_type === 'VIDEO') return null
  return media.media_url
}

function getEventsHasMore(response: CommentAutomationEventsResponse, offset: number) {
  if (response.total !== null) return offset + response.items.length < response.total
  return response.items.length === EVENTS_PAGE_SIZE
}

function getEventAlert(event: CommentAutomationEvent): 'failed' | 'unknown' | null {
  const statuses = [event.status, event.public_reply_status, event.dm_status]
  if (statuses.includes('unknown')) return 'unknown'
  if (statuses.includes('failed')) return 'failed'
  return null
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null
  const config = STATUS_CONFIG[status as CommentAutomationEventStatus]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        config?.className ?? 'border-[var(--border)] text-[var(--muted)]',
      )}
    >
      {config?.label ?? status}
    </span>
  )
}

function MediaPreview({ media }: { media: CommentAutomationMedia }) {
  const [hasFailed, setHasFailed] = useState(false)
  const src = getPreviewUrl(media)

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--accent-soft)]">
      {src && !hasFailed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center" style={{ background: INSTAGRAM_GRADIENT }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-white">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none" />
          </svg>
        </div>
      )}
      <span className="absolute bottom-1 left-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
        {getMediaKindLabel(media)}
      </span>
    </div>
  )
}

function ModeToggle({ value, onChange }: { value: CommentAutomationReplyMode; onChange: (mode: CommentAutomationReplyMode) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
      {(['ai', 'template'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
            value === mode
              ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--foreground)]',
          )}
        >
          {mode === 'ai' ? 'AI' : 'Template'}
        </button>
      ))}
    </div>
  )
}

function ChannelSettings({
  idPrefix,
  title,
  description,
  enabled,
  mode,
  template,
  templatePlaceholder,
  onEnabledChange,
  onModeChange,
  onTemplateChange,
}: {
  idPrefix: string
  title: string
  description: string
  enabled: boolean
  mode: CommentAutomationReplyMode
  template: string
  templatePlaceholder: string
  onEnabledChange: (enabled: boolean) => void
  onModeChange: (mode: CommentAutomationReplyMode) => void
  onTemplateChange: (template: string) => void
}) {
  const templateId = `${idPrefix}-template`

  return (
    <div
      className={cn(
        'space-y-2.5 rounded-xl border p-3 transition-colors',
        enabled ? 'border-[var(--border)] bg-[var(--surface)]' : 'border-dashed border-[var(--border)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">{title}</p>
          <p className="text-[11px] text-[var(--caption)]">{description}</p>
        </div>
        <Switch checked={enabled} onChange={onEnabledChange} size="sm" tone="emerald" label={title} />
      </div>

      {enabled && (
        <>
          <ModeToggle value={mode} onChange={onModeChange} />
          {mode === 'template' ? (
            <div className="space-y-1.5">
              <Label htmlFor={templateId} className="sr-only">{title} template</Label>
              <Textarea
                id={templateId}
                value={template}
                onChange={(event) => onTemplateChange(event.target.value)}
                placeholder={templatePlaceholder}
                className="min-h-[80px] text-[13px]"
              />
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-[var(--caption)]">Qo'shish:</span>
                {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                  <button
                    key={placeholder}
                    type="button"
                    data-i18n-skip="true"
                    onClick={() => onTemplateChange(`${template}${placeholder}`)}
                    className="rounded-md border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
                  >
                    {placeholder}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--caption)]">Aynan shu matn yuboriladi, placeholder'lar avtomatik almashtiriladi.</p>
            </div>
          ) : (
            <p className="text-[11px] text-[var(--caption)]">AI har bir izohga alohida javob yozadi, matn oldindan kafolatlanmaydi.</p>
          )}
        </>
      )}
    </div>
  )
}

function SettingsForm({ idPrefix, draft, onChange }: { idPrefix: string; draft: SettingsDraft; onChange: (draft: SettingsDraft) => void }) {
  function set<K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) {
    onChange({ ...draft, [key]: value })
  }

  const usesAi = (draft.public_reply_enabled && draft.public_reply_mode === 'ai') || (draft.dm_enabled && draft.dm_mode === 'ai')
  const aiInstructionsId = `${idPrefix}-ai-instructions`

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors',
          draft.automation_enabled ? 'bg-emerald-500/10' : 'bg-[var(--accent-soft)]',
        )}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">Avtomatik javob</p>
          <p className="text-[11px] text-[var(--caption)]">
            {draft.automation_enabled ? 'Yoqilgan: yangi izohlarga javob yuboriladi' : "O'chiq: hech qanday javob yuborilmaydi"}
          </p>
        </div>
        <Switch
          checked={draft.automation_enabled}
          onChange={(value) => set('automation_enabled', value)}
          tone="emerald"
          label="Avtomatik javob"
        />
      </div>

      <ChannelSettings
        idPrefix={`${idPrefix}-public`}
        title="Public javob"
        description="Izoh ostiga hammaga ko'rinadigan javob"
        enabled={draft.public_reply_enabled}
        mode={draft.public_reply_mode}
        template={draft.public_reply_template}
        templatePlaceholder="Rahmat, {username}! Sizga DM orqali batafsil yozdik."
        onEnabledChange={(value) => set('public_reply_enabled', value)}
        onModeChange={(value) => set('public_reply_mode', value)}
        onTemplateChange={(value) => set('public_reply_template', value)}
      />

      <ChannelSettings
        idPrefix={`${idPrefix}-dm`}
        title="DM"
        description="Izoh muallifiga birinchi private xabar"
        enabled={draft.dm_enabled}
        mode={draft.dm_mode}
        template={draft.dm_template}
        templatePlaceholder="Assalomu alaykum, {username}! {post_caption} haqida ma'lumot kerakmi?"
        onEnabledChange={(value) => set('dm_enabled', value)}
        onModeChange={(value) => set('dm_mode', value)}
        onTemplateChange={(value) => set('dm_template', value)}
      />

      <div>
        <Label htmlFor={aiInstructionsId}>AI ko'rsatmasi</Label>
        <Textarea
          id={aiInstructionsId}
          value={draft.ai_instructions}
          onChange={(event) => set('ai_instructions', event.target.value)}
          placeholder="Postdagi xizmat haqida qisqa aytib, javob yozishga taklif qil."
          className="mt-1 min-h-[64px] text-[13px]"
        />
        <p className="mt-1 text-[11px] text-[var(--caption)]">
          {usesAi ? "AI rejimidagi javoblarga qo'shimcha ko'rsatma." : 'Faqat AI rejimida ishlatiladi.'}
        </p>
      </div>
    </div>
  )
}

function MediaCard({
  media,
  isSelected,
  onSelectedChange,
  onSaved,
  onOpenEvents,
}: {
  media: CommentAutomationMedia
  isSelected: boolean
  onSelectedChange: (selected: boolean) => void
  onSaved: (media: CommentAutomationMedia) => void
  onOpenEvents: () => void
}) {
  const { showToast } = useToast()
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromSettings(media))
  const [isSaving, setIsSaving] = useState(false)

  const savedDraft = draftFromSettings(media)
  const isDirty = !isSameDraft(draft, savedDraft)
  const validationError = validateDraft(draft)
  const stats = media.automation_stats
  const needsAttention = stats?.needs_attention ?? 0

  async function handleSave() {
    if (validationError) {
      showToast({ title: "O'zgarish saqlanmadi", description: validationError, tone: 'error' })
      return
    }

    setIsSaving(true)
    try {
      const updated = await cognilabsaiService.updateCommentAutomationMedia(media.media_id, payloadFromDraft(draft))
      showToast({ title: 'Sozlama saqlandi', tone: 'success' })
      onSaved({ ...media, ...updated })
    } catch (error) {
      showToast({ title: "O'zgarish saqlanmadi", description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border bg-[var(--surface)] transition-colors',
        isSelected ? 'border-blue-500/60 ring-1 ring-blue-500/30' : 'border-[var(--border)]',
      )}
    >
      <div className="h-1 w-full" style={{ background: media.automation_enabled ? INSTAGRAM_GRADIENT : 'var(--border)' }} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex gap-3">
          <input
            type="checkbox"
            aria-label="Tanlash"
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-blue-500"
            checked={isSelected}
            onChange={(event) => onSelectedChange(event.target.checked)}
          />
          <MediaPreview key={getPreviewUrl(media) ?? media.media_id} media={media} />
          <div className="min-w-0 flex-1 space-y-1.5">
            {media.caption?.trim() ? (
              <p data-i18n-skip="true" className="line-clamp-3 text-[13px] leading-snug text-[var(--foreground)]">{media.caption}</p>
            ) : (
              <p className="text-[13px] italic text-[var(--caption)]">Caption yo'q</p>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--caption)]">
              <span>{formatShortDateTime(media.published_at)}</span>
              <span>{media.comments_count ?? 0} izoh</span>
              {media.permalink && (
                <a href={media.permalink} target="_blank" rel="noopener noreferrer" className="font-medium text-pink-500 hover:underline">
                  Instagram'da ochish
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5" data-ui-number="true">
          {[
            { label: 'Izohlar', value: stats?.comments_received ?? 0, alert: false },
            { label: 'Public', value: stats?.public_replies_sent ?? 0, alert: false },
            { label: 'DM', value: stats?.private_replies_sent ?? 0, alert: false },
            { label: "E'tibor", value: needsAttention, alert: needsAttention > 0 },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-center',
                item.alert ? 'border-red-500/40 bg-red-500/10' : 'border-[var(--border)] bg-[var(--accent-soft)]',
              )}
            >
              <p className={cn('text-[15px] font-bold', item.alert ? 'text-red-500' : 'text-[var(--foreground)]')}>{item.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-[var(--caption)]">{item.label}</p>
            </div>
          ))}
        </div>

        <SettingsForm idPrefix={`media-${media.media_id}`} draft={draft} onChange={setDraft} />

        {isDirty && validationError && <p className="text-[11px] font-medium text-red-500">{validationError}</p>}

        <div className="mt-auto flex items-center gap-2 border-t border-[var(--border)] pt-3">
          <Button variant="ghost" size="sm" onClick={onOpenEvents}>Tarix</Button>
          <div className="ml-auto flex items-center gap-2">
            {isDirty && (
              <Button variant="ghost" size="sm" onClick={() => setDraft(savedDraft)} disabled={isSaving}>Bekor qilish</Button>
            )}
            <Button size="sm" onClick={() => void handleSave()} disabled={!isDirty || Boolean(validationError)} loading={isSaving}>
              Saqlash
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

function BulkSettingsDialog({
  count,
  onClose,
  onSubmit,
}: {
  count: number
  onClose: () => void
  onSubmit: (payload: CommentAutomationSettingsPayload) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<SettingsDraft>(emptyBulkDraft)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const validationError = validateDraft(draft)

  async function handleSubmit() {
    if (validationError) return
    setIsSubmitting(true)
    const isSaved = await onSubmit(payloadFromDraft(draft))
    setIsSubmitting(false)
    if (isSaved) onClose()
  }

  return (
    <Dialog
      open
      onClose={isSubmitting ? () => undefined : onClose}
      title="Umumiy javob sozlamasi"
      description={`Tanlangan ${count} ta post/reel'ga bir xil sozlama qo'llanadi va ularning avvalgi sozlamasi almashtiriladi.`}
      size="lg"
    >
      <div className="space-y-4">
        <SettingsForm idPrefix="bulk" draft={draft} onChange={setDraft} />
        {validationError && <p className="text-[12px] font-medium text-red-500">{validationError}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void handleSubmit()} disabled={Boolean(validationError)} loading={isSubmitting}>
            {count} ta post/reel'ga qo'llash
          </Button>
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isSubmitting}>Bekor qilish</Button>
        </div>
      </div>
    </Dialog>
  )
}

function EventChannel({
  title,
  status,
  text,
  messageId,
  error,
}: {
  title: string
  status: string | null
  text: string | null
  messageId: string | null
  error: string | null
}) {
  return (
    <div
      className={cn(
        'space-y-1.5 rounded-lg border p-2.5',
        status === 'failed' ? 'border-red-500/40' : status === 'unknown' ? 'border-amber-500/50' : 'border-[var(--border)]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--caption)]">{title}</span>
        {status ? <StatusBadge status={status} /> : <span className="text-[10px] text-[var(--caption)]">-</span>}
      </div>
      {text ? (
        <p data-i18n-skip="true" className="whitespace-pre-wrap text-[12px] text-[var(--foreground)]">{text}</p>
      ) : (
        <p className="text-[11px] italic text-[var(--caption)]">Matn yo'q</p>
      )}
      {messageId && (
        <p className="break-all text-[10px] text-[var(--caption)]">
          Message ID: <span data-i18n-skip="true" className="font-mono">{messageId}</span>
        </p>
      )}
      {error && (
        <p data-i18n-skip="true" className="rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-500">{error}</p>
      )}
    </div>
  )
}

function EventCard({ event }: { event: CommentAutomationEvent }) {
  const alert = getEventAlert(event)

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border p-3',
        alert === 'failed' && 'border-red-500/50 bg-red-500/5',
        alert === 'unknown' && 'border-amber-500/60 bg-amber-500/5',
        !alert && 'border-[var(--border)] bg-[var(--surface)]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p data-i18n-skip="true" className="truncate text-[13px] font-semibold text-[var(--foreground)]">
            {event.sender_username ? `@${event.sender_username}` : event.sender_id ?? '-'}
          </p>
          <p className="text-[11px] text-[var(--caption)]">
            {formatShortDateTime(event.created_at)}
            {event.sent_at ? ` · yuborildi ${formatShortDateTime(event.sent_at)}` : ''}
          </p>
        </div>
        <StatusBadge status={event.status} />
      </div>

      {event.comment_text && (
        <p data-i18n-skip="true" className="whitespace-pre-wrap rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-[13px] text-[var(--foreground)]">
          {event.comment_text}
        </p>
      )}

      {alert === 'unknown' && (
        <p className="text-[11px] font-medium text-amber-500">
          Meta javobni qabul qilgan-qilmagani noma'lum. Avtomatik qayta yuborilmaydi, Instagram'da qo'lda tekshiring.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <EventChannel
          title="Public javob"
          status={event.public_reply_status}
          text={event.public_reply_text}
          messageId={event.public_reply_message_id}
          error={event.public_reply_error}
        />
        <EventChannel
          title="DM"
          status={event.dm_status}
          text={event.dm_text}
          messageId={event.dm_message_id}
          error={event.dm_error}
        />
      </div>

      <p className="break-all text-[10px] text-[var(--caption)]">
        Comment ID: <span data-i18n-skip="true" className="font-mono">{event.comment_id}</span>
        {event.sender_id && (
          <>
            {' · '}Sender ID: <span data-i18n-skip="true" className="font-mono">{event.sender_id}</span>
          </>
        )}
      </p>
    </div>
  )
}

function EventsDialog({ media, onClose }: { media: CommentAutomationMedia; onClose: () => void }) {
  const { showToast } = useToast()
  const [filter, setFilter] = useState<EventFilter>('all')
  const [events, setEvents] = useState<CommentAutomationEvent[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const status = filter === 'all' ? null : filter

  const query = useAsyncData(
    () => cognilabsaiService.listCommentAutomationEvents({ mediaId: media.media_id, status, limit: EVENTS_PAGE_SIZE, offset: 0 }),
    [media.media_id, status],
    {
      onSuccess: (data) => {
        setEvents(data.items)
        setTotal(data.total)
        setHasMore(getEventsHasMore(data, 0))
      },
    },
  )

  async function handleLoadMore() {
    const offset = events.length
    setIsLoadingMore(true)
    try {
      const data = await cognilabsaiService.listCommentAutomationEvents({ mediaId: media.media_id, status, limit: EVENTS_PAGE_SIZE, offset })
      setEvents((prev) => [...prev, ...data.items])
      if (data.total !== null) setTotal(data.total)
      setHasMore(getEventsHasMore(data, offset))
    } catch (error) {
      showToast({ title: 'Tarixni yuklab bo\'lmadi', description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsLoadingMore(false)
    }
  }

  const caption = media.caption?.trim()

  return (
    <Dialog
      open
      onClose={onClose}
      title="Izohlarga javob tarixi"
      description={caption ? (caption.length > 100 ? `${caption.slice(0, 100)}...` : caption) : getMediaKindLabel(media)}
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {EVENT_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
                filter === item.key
                  ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {query.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl bg-[var(--accent-soft)]" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-400">{getApiErrorMessage(query.error)}</p>
            <Button variant="ghost" className="mt-3" onClick={() => void query.refetch().catch(() => undefined)}>Qayta urinish</Button>
          </div>
        ) : events.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[var(--caption)]">Bu filter bo'yicha yozuv yo'q</p>
        ) : (
          <div className="space-y-2">
            {total !== null && (
              <p className="text-[11px] text-[var(--caption)]">{events.length} / {total} ta yozuv</p>
            )}
            {events.map((event, index) => (
              <EventCard key={`${event.id ?? event.comment_id}-${index}`} event={event} />
            ))}
            {hasMore && (
              <Button variant="ghost" className="w-full" onClick={() => void handleLoadMore()} loading={isLoadingMore}>
                Ko'proq yuklash
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}

export function CognilabsAICommentAutomationPage() {
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const [items, setItems] = useState<CommentAutomationMedia[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [listRefreshMode, setListRefreshMode] = useState(false)
  const [loadRequest, setLoadRequest] = useState({ refresh: false, version: 0 })
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSelectingAll, setIsSelectingAll] = useState(false)
  const [selectAllProgress, setSelectAllProgress] = useState(0)
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [eventsMedia, setEventsMedia] = useState<CommentAutomationMedia | null>(null)

  const query = useAsyncData(
    async () => {
      const response = await cognilabsaiService.listCommentAutomationMedia({ refresh: loadRequest.refresh, limit: PAGE_SIZE })
      if (!loadRequest.refresh && response.items.length === 0) {
        const synced = await cognilabsaiService.listCommentAutomationMedia({ refresh: true, limit: PAGE_SIZE })
        return { response: synced, refresh: true }
      }
      return { response, refresh: loadRequest.refresh }
    },
    [loadRequest],
    {
      onSuccess: ({ response, refresh }) => {
        setItems(response.items)
        setNextCursor(getNextCursor(response))
        setSyncedAt(response.synced_at)
        setListRefreshMode(refresh)
        setSelectedIds(new Set())
      },
      onError: (error) => {
        if (items.length > 0) {
          showToast({ title: "Yangilab bo'lmadi", description: getApiErrorMessage(error), tone: 'error' })
        }
      },
    },
  )

  const isBusy = query.isLoading || isSelectingAll || isBulkSaving
  const selectedCount = selectedIds.size
  const enabledCount = items.filter((item) => item.automation_enabled).length
  const attentionCount = items.reduce((sum, item) => sum + (item.automation_stats?.needs_attention ?? 0), 0)

  function requestReload(refresh: boolean) {
    setLoadRequest((prev) => ({ refresh, version: prev.version + 1 }))
  }

  function handleMediaSaved(updated: CommentAutomationMedia) {
    setItems((prev) => prev.map((item) => (item.media_id === updated.media_id ? updated : item)))
  }

  function handleSelectedChange(mediaId: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(mediaId)
      else next.delete(mediaId)
      return next
    })
  }

  function handleSelectLoaded() {
    setSelectedIds(new Set(items.map((item) => item.media_id)))
  }

  async function handleLoadMore() {
    if (!nextCursor) return
    setIsLoadingMore(true)
    try {
      const response = await cognilabsaiService.listCommentAutomationMedia({ refresh: listRefreshMode, limit: PAGE_SIZE, after: nextCursor })
      setItems((prev) => appendUniqueMedia(prev, response.items))
      setNextCursor(getNextCursor(response))
      if (response.synced_at) setSyncedAt(response.synced_at)
    } catch (error) {
      showToast({ title: "Keyingi sahifani yuklab bo'lmadi", description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsLoadingMore(false)
    }
  }

  async function handleSelectAll() {
    let collected = items
    let cursor = nextCursor
    let requests = 0

    setIsSelectingAll(true)
    setSelectAllProgress(collected.length)
    try {
      while (cursor && requests < MAX_PAGE_REQUESTS) {
        const response = await cognilabsaiService.listCommentAutomationMedia({ refresh: listRefreshMode, limit: PAGE_SIZE, after: cursor })
        collected = appendUniqueMedia(collected, response.items)
        cursor = getNextCursor(response)
        requests += 1
        setSelectAllProgress(collected.length)
      }

      setItems(collected)
      setNextCursor(cursor)
      setSelectedIds(new Set(collected.map((item) => item.media_id)))
      showToast({
        title: `${collected.length} ta post/reel tanlandi`,
        description: cursor ? "Sahifalar soni chegaraga yetdi, qolganlari yuklanmadi." : 'Barcha post va reel\'lar yuklandi.',
        tone: cursor ? 'error' : 'info',
      })
    } catch (error) {
      setItems(collected)
      setNextCursor(cursor)
      showToast({ title: "Barcha media'ni yuklab bo'lmadi", description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsSelectingAll(false)
    }
  }

  async function runBulkUpdate(payload: CommentAutomationSettingsPayload, successTitle: string) {
    const chunks = chunkIds(Array.from(selectedIds), BULK_CHUNK_SIZE)
    if (chunks.length === 0) return false

    let updatedCount = 0
    setIsBulkSaving(true)
    try {
      for (const [index, chunk] of chunks.entries()) {
        try {
          const response = await cognilabsaiService.bulkUpdateCommentAutomationMedia({ ...payload, media_ids: chunk })
          const chunkSet = new Set(chunk)
          const updatedById = new Map((response.items ?? []).map((item) => [item.media_id, item]))
          updatedCount += response.updated_count ?? chunk.length
          setItems((prev) =>
            prev.map((item) => (chunkSet.has(item.media_id) ? { ...item, ...payload, ...updatedById.get(item.media_id) } : item)),
          )
        } catch (error) {
          showToast({ title: getBulkFailureTitle(index, chunks.length), description: getApiErrorMessage(error), tone: 'error' })
          return false
        }
      }

      showToast({ title: successTitle, description: `${updatedCount} ta post/reel yangilandi.`, tone: 'success' })
      return true
    } finally {
      setIsBulkSaving(false)
    }
  }

  async function handleBulkToggle(enabled: boolean) {
    if (enabled) {
      const approved = await confirm({
        title: 'Automationni yoqish',
        description: `Tanlangan ${selectedCount} ta post/reel'da avtomatik javob yoqiladi. Yangi izohlarga har bir media'ning o'z sozlamasi bo'yicha public javob va/yoki DM yuboriladi.`,
        confirmLabel: 'Yoqish',
      })
      if (!approved) return
    }

    await runBulkUpdate({ automation_enabled: enabled }, enabled ? 'Automation yoqildi' : "Automation o'chirildi")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Instagram izohlar</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Post va reel izohlariga public javob hamda birinchi DM'ni boshqaring</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {syncedAt && (
            <span className="text-[11px] text-[var(--caption)]">Sinxronlangan: {formatShortDateTime(syncedAt)}</span>
          )}
          <Button
            onClick={() => requestReload(true)}
            loading={query.isLoading}
            disabled={isSelectingAll || isBulkSaving}
            style={{ background: INSTAGRAM_GRADIENT, border: 'none' }}
            className="font-semibold text-white"
          >
            Yangilash
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3" data-ui-number="true">
        {[
          { label: 'Yuklangan', value: `${items.length}${nextCursor ? '+' : ''}`, className: 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]' },
          { label: 'Automation yoqilgan', value: enabledCount, className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' },
          {
            label: "E'tibor kerak",
            value: attentionCount,
            className: attentionCount > 0 ? 'border-red-500/40 bg-red-500/10 text-red-500' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]',
          },
        ].map((stat) => (
          <div key={stat.label} className={cn('flex flex-col gap-1 rounded-xl border px-4 py-3', stat.className)}>
            <span className="text-2xl font-bold">{stat.value}</span>
            <span className="text-[11px] uppercase tracking-wide text-[var(--caption)]">{stat.label}</span>
          </div>
        ))}
      </div>

      <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[12px] text-[var(--muted)]">
        <summary className="cursor-pointer select-none text-[13px] font-semibold text-[var(--foreground)]">Meta qoidalari</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>DM izoh ID orqali yuboriladi, oldin chat bo'lishi shart emas.</li>
          <li>Har bir izohga faqat bitta private reply mumkin va izohdan keyin 7 kun muddat bor (Live izohlar bundan mustasno).</li>
          <li>Account'ni follow qilmaydigan foydalanuvchida DM "Message Requests" ga tushishi mumkin. User javob bermaguncha keyingi DM yuborilmaydi.</li>
          <li>Public javob va DM alohida yuboriladi: birining xatosi ikkinchisini to'xtatmaydi.</li>
          <li>Yangi post/reel'larda avtomatik javob o'zi yoqilmaydi.</li>
          <li>Meta app'da comment webhook va comment/message permission'lari yoqilgan bo'lishi kerak.</li>
        </ul>
      </details>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <span className="text-[12px] font-semibold text-[var(--foreground)]">{selectedCount} ta tanlandi</span>
        <Button size="sm" variant="ghost" onClick={handleSelectLoaded} disabled={items.length === 0 || isBusy}>
          Joriy sahifani tanlash ({items.length})
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void handleSelectAll()} loading={isSelectingAll} disabled={items.length === 0 || isBusy}>
          {isSelectingAll ? `Yuklanmoqda (${selectAllProgress})` : "Barcha post/reel'ni tanlash"}
        </Button>
        {selectedCount > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={isBulkSaving}>
            Tanlovni bekor qilish
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="success" onClick={() => void handleBulkToggle(true)} disabled={selectedCount === 0 || isBusy}>
            Tanlanganlarni yoqish
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void handleBulkToggle(false)} disabled={selectedCount === 0 || isBusy}>
            Tanlanganlarni o'chirish
          </Button>
          <Button size="sm" onClick={() => setIsBulkDialogOpen(true)} disabled={selectedCount === 0 || isBusy}>
            Umumiy javob sozlamasi
          </Button>
        </div>
      </div>

      {query.isLoading && items.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="h-[420px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
      ) : query.isError && items.length === 0 ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-400">{getApiErrorMessage(query.error)}</p>
          <Button variant="ghost" className="mt-3" onClick={() => requestReload(loadRequest.refresh)}>Qayta urinish</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: INSTAGRAM_GRADIENT }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="mb-1 text-[15px] font-semibold text-[var(--foreground)]">Post yoki reel topilmadi</h3>
          <p className="mb-4 max-w-xs text-[13px] text-[var(--caption)]">Instagram account ulanganini tekshiring va qayta yangilang.</p>
          <Button variant="ghost" onClick={() => requestReload(true)}>Yangilash</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {items.map((media) => (
              <MediaCard
                key={`${media.media_id}:${getSettingsKey(media)}`}
                media={media}
                isSelected={selectedIds.has(media.media_id)}
                onSelectedChange={(selected) => handleSelectedChange(media.media_id, selected)}
                onSaved={handleMediaSaved}
                onOpenEvents={() => setEventsMedia(media)}
              />
            ))}
          </div>
          {nextCursor && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => void handleLoadMore()} loading={isLoadingMore} disabled={isBusy}>
                Ko'proq yuklash
              </Button>
            </div>
          )}
        </div>
      )}

      {isBulkDialogOpen && (
        <BulkSettingsDialog
          count={selectedCount}
          onClose={() => setIsBulkDialogOpen(false)}
          onSubmit={(payload) => runBulkUpdate(payload, "Umumiy sozlama qo'llandi")}
        />
      )}

      {eventsMedia && <EventsDialog media={eventsMedia} onClose={() => setEventsMedia(null)} />}
    </div>
  )
}
