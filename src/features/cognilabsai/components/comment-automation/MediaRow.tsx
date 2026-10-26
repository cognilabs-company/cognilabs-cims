import { useState } from 'react'
import {
  cognilabsaiService,
  type CommentAutomationMedia,
} from '../../../../shared/api/services/cognilabsai.service'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { cn } from '../../../../shared/lib/cn'
import { formatShortDateTime } from '../../../../shared/lib/format'
import { useToast } from '../../../../shared/toast/useToast'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import { AutomationToggle, SettingsForm } from './SettingsForm'
import {
  INSTAGRAM_GRADIENT,
  draftFromSettings,
  getMediaKind,
  getMediaKindLabel,
  getPreviewUrl,
  getValidationMessage,
  isSameDraft,
  payloadFromDraft,
  useCommentAutomationT,
  validateDraft,
  type SettingsDraft,
} from './shared'

function MediaPreview({ media, kindLabel }: { media: CommentAutomationMedia; kindLabel: string }) {
  const [hasFailed, setHasFailed] = useState(false)
  const src = getPreviewUrl(media)

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--muted-surface)]">
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
        {kindLabel}
      </span>
    </div>
  )
}

export function MediaRow({
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
  const tx = useCommentAutomationT()
  const { showToast } = useToast()
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromSettings(media))
  const [isSaving, setIsSaving] = useState(false)

  const savedDraft = draftFromSettings(media)
  const isDirty = !isSameDraft(draft, savedDraft)
  const validationError = validateDraft(draft)
  const validationMessage = validationError ? getValidationMessage(validationError, tx) : null
  const stats = media.automation_stats
  const needsAttention = stats?.needs_attention ?? 0
  const kindLabel = getMediaKindLabel(getMediaKind(media), tx)
  const caption = media.caption?.trim()

  async function handleSave() {
    if (validationMessage) {
      showToast({ title: tx('toast.not_saved', 'Changes were not saved'), description: validationMessage, tone: 'error' })
      return
    }

    setIsSaving(true)
    try {
      const updated = await cognilabsaiService.updateCommentAutomationMedia(media.media_id, payloadFromDraft(draft))
      showToast({ title: tx('toast.saved', 'Settings saved'), tone: 'success' })
      onSaved({ ...media, ...updated })
    } catch (error) {
      showToast({ title: tx('toast.not_saved', 'Changes were not saved'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const statItems = [
    { key: 'comments', label: tx('stats.comments', 'Comments'), value: stats?.comments_received ?? media.comments_count ?? 0, alert: false },
    { key: 'public', label: tx('stats.public', 'Replies'), value: stats?.public_replies_sent ?? 0, alert: false },
    { key: 'dm', label: tx('stats.dm', 'DMs'), value: stats?.private_replies_sent ?? 0, alert: false },
    { key: 'attention', label: tx('stats.attention', 'Attention'), value: needsAttention, alert: needsAttention > 0 },
  ]

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border bg-[var(--card)] shadow-sm transition-colors',
        isSelected ? 'border-[var(--blue-border)] ring-1 ring-blue-500/30' : 'border-[var(--border)]',
      )}
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <input
              type="checkbox"
              aria-label={tx('actions.select_media', 'Select media')}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-blue-500"
              checked={isSelected}
              onChange={(event) => onSelectedChange(event.target.checked)}
            />
            <MediaPreview key={getPreviewUrl(media) ?? media.media_id} media={media} kindLabel={kindLabel} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={media.automation_enabled ? 'success' : 'secondary'} size="sm" dot>
                  {media.automation_enabled ? tx('badge.on', 'On') : tx('badge.off', 'Off')}
                </Badge>
                <span className="text-[11px] text-[var(--caption)]">{formatShortDateTime(media.published_at)}</span>
              </div>
              {caption ? (
                <p data-i18n-skip="true" title={caption} className="line-clamp-3 text-[13px] leading-snug text-[var(--foreground)]">
                  {caption}
                </p>
              ) : (
                <p className="text-[13px] italic text-[var(--caption)]">{tx('media.no_caption', 'No caption')}</p>
              )}
              {media.permalink && (
                <a
                  href={media.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--blue-text)] hover:underline"
                >
                  {tx('media.open_instagram', 'Open on Instagram')}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                    <path d="M7 17 17 7" />
                    <path d="M7 7h10v10" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5" data-ui-number="true">
            {statItems.map((item) => (
              <div
                key={item.key}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-center',
                  item.alert ? 'border-[var(--danger-border)] bg-[var(--danger-dim)]' : 'border-[var(--border)] bg-[var(--muted-surface)]',
                )}
              >
                <p className={cn('text-[15px] font-semibold', item.alert ? 'text-[var(--danger-text)]' : 'text-[var(--foreground)]')}>
                  {item.value}
                </p>
                <p className="truncate text-[10px] text-[var(--caption)]">{item.label}</p>
              </div>
            ))}
          </div>

          <AutomationToggle enabled={draft.automation_enabled} onChange={(value) => setDraft({ ...draft, automation_enabled: value })} />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <SettingsForm idPrefix={`media-${media.media_id}`} draft={draft} onChange={setDraft} />

          {isDirty && validationMessage && (
            <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-dim)] px-3 py-2 text-[12px] text-[var(--danger-text)]">
              {validationMessage}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
            <Button variant="ghost" size="sm" onClick={onOpenEvents}>
              {tx('actions.history', 'Reply history')}
            </Button>
            {isDirty && (
              <span className="text-[11px] font-medium text-[var(--warning-text)]">{tx('media.unsaved', 'Unsaved changes')}</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {isDirty && (
                <Button variant="ghost" size="sm" onClick={() => setDraft(savedDraft)} disabled={isSaving}>
                  {tx('actions.cancel', 'Cancel')}
                </Button>
              )}
              <Button size="sm" onClick={() => void handleSave()} disabled={!isDirty || Boolean(validationMessage)} loading={isSaving}>
                {tx('actions.save', 'Save')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
