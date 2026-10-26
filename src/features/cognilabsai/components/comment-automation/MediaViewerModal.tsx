import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  cognilabsaiService,
  type CommentAutomationMedia,
} from '../../../../shared/api/services/cognilabsai.service'
import { useConfirm } from '../../../../shared/confirm/useConfirm'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { cn } from '../../../../shared/lib/cn'
import { formatShortDateTime } from '../../../../shared/lib/format'
import { useToast } from '../../../../shared/toast/useToast'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import {
  AlertIcon,
  ChevronIcon,
  CloseIcon,
  CommentIcon,
  ExternalIcon,
  InstagramGlyph,
  ReplyIcon,
  SendIcon,
  SettingsIcon,
} from './icons'
import { MediaImage } from './MediaImage'
import { ReplyHistoryPanel } from './ReplyHistoryPanel'
import { AutomationToggle, SettingsForm } from './SettingsForm'
import {
  INSTAGRAM_GRADIENT,
  draftFromSettings,
  getMediaKind,
  getMediaKindLabel,
  getValidationMessage,
  isSameDraft,
  isVideoMedia,
  payloadFromDraft,
  useCommentAutomationT,
  validateDraft,
  type SettingsDraft,
} from './shared'

type ViewerTab = 'settings' | 'history'

const CAPTION_COLLAPSE_LENGTH = 140

function MediaStage({ media }: { media: CommentAutomationMedia }) {
  const [videoFailed, setVideoFailed] = useState(false)
  const isReel = getMediaKind(media) === 'reel'
  const canPlay = isVideoMedia(media) && Boolean(media.media_url) && !videoFailed

  return (
    <div
      className={cn(
        'relative flex h-[42dvh] w-full shrink-0 items-center justify-center bg-black md:h-full md:w-auto md:min-w-0 md:shrink',
        isReel ? 'md:aspect-[9/16]' : 'md:aspect-[4/5]',
      )}
    >
      {canPlay ? (
        <video
          src={media.media_url ?? undefined}
          poster={media.thumbnail_url ?? undefined}
          className="h-full w-full object-contain"
          controls
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <MediaImage media={media} fit="contain" className="h-full w-full" />
      )}
    </div>
  )
}

export function MediaViewerModal({
  media,
  position,
  total,
  onPrev,
  onNext,
  onClose,
  onSaved,
}: {
  media: CommentAutomationMedia
  position: number | null
  total: number
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onClose: () => void
  onSaved: (media: CommentAutomationMedia) => void
}) {
  const tx = useCommentAutomationT()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const isConfirmingRef = useRef(false)
  const [tab, setTab] = useState<ViewerTab>('settings')
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromSettings(media))
  const [isSaving, setIsSaving] = useState(false)
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false)

  const savedDraft = draftFromSettings(media)
  const isDirty = !isSameDraft(draft, savedDraft)
  const validationError = validateDraft(draft)
  const validationMessage = validationError ? getValidationMessage(validationError, tx) : null
  const kindLabel = getMediaKindLabel(getMediaKind(media), tx)
  const caption = media.caption?.trim() ?? ''
  const stats = media.automation_stats
  const needsAttention = stats?.needs_attention ?? 0

  const guard = useCallback(
    async (action: () => void) => {
      if (!isDirty) {
        action()
        return
      }
      if (isConfirmingRef.current) return
      isConfirmingRef.current = true
      const approved = await confirm({
        title: tx('viewer.unsaved_title', 'Discard unsaved changes?'),
        description: tx('viewer.unsaved_description', 'Changes to this post\'s reply settings have not been saved.'),
        confirmLabel: tx('viewer.discard', 'Discard'),
        cancelLabel: tx('actions.cancel', 'Cancel'),
        tone: 'danger',
      })
      isConfirmingRef.current = false
      if (approved) action()
    },
    [confirm, isDirty, tx],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isConfirmingRef.current) return
      if (event.key === 'Escape') {
        event.preventDefault()
        void guard(onClose)
        return
      }
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft' && onPrev) void guard(onPrev)
      if (event.key === 'ArrowRight' && onNext) void guard(onNext)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [guard, onClose, onNext, onPrev])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  async function handleSave() {
    if (validationMessage) {
      showToast({ title: tx('toast.not_saved', 'Changes were not saved'), description: validationMessage, tone: 'error' })
      return
    }

    setIsSaving(true)
    try {
      const updated = await cognilabsaiService.updateCommentAutomationMedia(media.media_id, payloadFromDraft(draft))
      onSaved({ ...media, ...updated })
      showToast({ title: tx('toast.saved', 'Settings saved'), tone: 'success' })
    } catch (error) {
      showToast({ title: tx('toast.not_saved', 'Changes were not saved'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const navButtonClass =
    'absolute top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition hover:bg-white md:flex'
  const headerIconButtonClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] disabled:opacity-30'

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={tx('viewer.title', '{{kind}} settings', { kind: kindLabel })}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={tx('viewer.close', 'Close')}
        className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-[2px]"
        onClick={() => void guard(onClose)}
      />

      <button
        type="button"
        aria-label={tx('viewer.close', 'Close')}
        data-keep-color="true"
        onClick={() => void guard(onClose)}
        className="absolute right-4 top-4 z-20 hidden h-10 w-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white md:flex"
      >
        <CloseIcon className="h-7 w-7" />
      </button>

      {onPrev && (
        <button type="button" aria-label={tx('viewer.prev', 'Previous')} onClick={() => void guard(onPrev)} className={cn(navButtonClass, 'left-4')}>
          <ChevronIcon direction="left" className="h-5 w-5" />
        </button>
      )}
      {onNext && (
        <button type="button" aria-label={tx('viewer.next', 'Next')} onClick={() => void guard(onNext)} className={cn(navButtonClass, 'right-4')}>
          <ChevronIcon direction="right" className="h-5 w-5" />
        </button>
      )}

      <div className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--card)] md:h-[min(90vh,880px)] md:w-auto md:max-w-[calc(100vw-9rem)] md:flex-row md:rounded-md md:shadow-2xl">
        <MediaStage key={media.media_id} media={media} />

        <aside className="flex min-h-0 w-full flex-1 flex-col md:w-[420px] md:flex-none md:border-l md:border-[var(--border)]">
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
            <span className="shrink-0 rounded-full p-[2px]" style={{ background: INSTAGRAM_GRADIENT }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card)]">
                <InstagramGlyph className="h-4 w-4 text-[var(--foreground)]" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{kindLabel}</p>
                <Badge variant={media.automation_enabled ? 'success' : 'secondary'} size="sm" dot>
                  {media.automation_enabled ? tx('badge.on', 'On') : tx('badge.off', 'Off')}
                </Badge>
              </div>
              <p className="truncate text-[11px] text-[var(--caption)]">
                {formatShortDateTime(media.published_at)}
                {position !== null ? ` · ${position} / ${total}` : ''}
              </p>
            </div>
            {media.permalink && (
              <a
                href={media.permalink}
                target="_blank"
                rel="noopener noreferrer"
                title={tx('media.open_instagram', 'Open on Instagram')}
                aria-label={tx('media.open_instagram', 'Open on Instagram')}
                className={headerIconButtonClass}
              >
                <ExternalIcon className="h-4 w-4" />
              </a>
            )}
            <div className="flex items-center gap-0.5 md:hidden">
              <button type="button" aria-label={tx('viewer.prev', 'Previous')} disabled={!onPrev} onClick={() => onPrev && void guard(onPrev)} className={headerIconButtonClass}>
                <ChevronIcon direction="left" className="h-4 w-4" />
              </button>
              <button type="button" aria-label={tx('viewer.next', 'Next')} disabled={!onNext} onClick={() => onNext && void guard(onNext)} className={headerIconButtonClass}>
                <ChevronIcon direction="right" className="h-4 w-4" />
              </button>
              <button type="button" aria-label={tx('viewer.close', 'Close')} onClick={() => void guard(onClose)} className={headerIconButtonClass}>
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-[var(--border)] px-4 py-3">
            {caption ? (
              <>
                <p
                  data-i18n-skip="true"
                  className={cn('whitespace-pre-wrap text-[13px] leading-snug text-[var(--foreground)]', !isCaptionExpanded && 'line-clamp-3')}
                >
                  {caption}
                </p>
                {caption.length > CAPTION_COLLAPSE_LENGTH && (
                  <button
                    type="button"
                    onClick={() => setIsCaptionExpanded((value) => !value)}
                    className="mt-0.5 text-[12px] font-medium text-[var(--caption)] hover:text-[var(--foreground)]"
                  >
                    {isCaptionExpanded ? tx('viewer.less', 'less') : tx('viewer.more', 'more')}
                  </button>
                )}
              </>
            ) : (
              <p className="text-[13px] italic text-[var(--caption)]">{tx('media.no_caption', 'No caption')}</p>
            )}

            <div data-ui-number="true" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[var(--muted-strong)]">
              <span className="inline-flex items-center gap-1.5" title={tx('stats.comments', 'Comments')}>
                <CommentIcon className="h-4 w-4" />
                <b className="font-semibold text-[var(--foreground)]">{stats?.comments_received ?? media.comments_count ?? 0}</b>
              </span>
              <span className="inline-flex items-center gap-1.5" title={tx('stats.public', 'Replies')}>
                <ReplyIcon className="h-4 w-4" />
                <b className="font-semibold text-[var(--foreground)]">{stats?.public_replies_sent ?? 0}</b>
              </span>
              <span className="inline-flex items-center gap-1.5" title={tx('stats.dm', 'DMs')}>
                <SendIcon className="h-4 w-4" />
                <b className="font-semibold text-[var(--foreground)]">{stats?.private_replies_sent ?? 0}</b>
              </span>
              {needsAttention > 0 && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--danger-text)]">
                  <AlertIcon className="h-4 w-4" />
                  {tx('viewer.attention_count', '{{count}} need attention', { count: needsAttention })}
                </span>
              )}
            </div>
          </div>

          <div className="flex border-b border-[var(--border)]" role="tablist">
            {(['settings', 'history'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                className={cn(
                  '-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors',
                  tab === item
                    ? 'border-[var(--foreground)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]',
                )}
              >
                {item === 'settings' ? <SettingsIcon className="h-3.5 w-3.5" /> : <CommentIcon className="h-3.5 w-3.5" />}
                {item === 'settings' ? tx('viewer.settings_tab', 'Reply settings') : tx('viewer.history_tab', 'Comments & replies')}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {tab === 'settings' ? (
              <div className="space-y-3">
                <AutomationToggle enabled={draft.automation_enabled} onChange={(value) => setDraft({ ...draft, automation_enabled: value })} />
                <SettingsForm idPrefix={`viewer-${media.media_id}`} draft={draft} onChange={setDraft} layout="stacked" />
                {isDirty && validationMessage && (
                  <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-dim)] px-3 py-2 text-[12px] text-[var(--danger-text)]">
                    {validationMessage}
                  </p>
                )}
              </div>
            ) : (
              <ReplyHistoryPanel mediaId={media.media_id} />
            )}
          </div>

          {tab === 'settings' && (
            <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-3">
              <span className={cn('text-[11px] font-medium', isDirty ? 'text-[var(--warning-text)]' : 'text-[var(--caption)]')}>
                {isDirty ? tx('media.unsaved', 'Unsaved changes') : tx('viewer.saved_state', 'All changes saved')}
              </span>
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
          )}
        </aside>
      </div>
    </div>,
    document.body,
  )
}
