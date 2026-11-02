import type { CommentAutomationMedia } from '../../../../shared/api/services/cognilabsai.service'
import { cn } from '../../../../shared/lib/cn'
import { AlertIcon, CarouselIcon, CheckIcon, CommentIcon, PlayIcon, ReelsIcon, ReplyIcon, SendIcon } from './icons'
import { MediaImage } from './MediaImage'
import { getMediaKind, getMediaKindLabel, useCommentAutomationT } from './shared'

function KindIcon({ media }: { media: CommentAutomationMedia }) {
  const kind = getMediaKind(media)
  const className = 'h-5 w-5 text-white drop-shadow-[0_1px_3px_rgba(14,21,37,0.65)]'

  if (kind === 'reel') return <ReelsIcon className={className} data-keep-color="true" />
  if (kind === 'carousel') return <CarouselIcon className={className} data-keep-color="true" />
  if (kind === 'video') return <PlayIcon className={className} data-keep-color="true" />
  return null
}

export function MediaGridTile({
  media,
  shape,
  selectionMode,
  isSelected,
  onOpen,
  onToggleSelect,
}: {
  media: CommentAutomationMedia
  shape: 'portrait' | 'reel'
  selectionMode: boolean
  isSelected: boolean
  onOpen: () => void
  onToggleSelect: () => void
}) {
  const tx = useCommentAutomationT()
  const stats = media.automation_stats
  const comments = stats?.comments_received ?? media.comments_count ?? 0
  const needsAttention = stats?.needs_attention ?? 0
  const kindLabel = getMediaKindLabel(getMediaKind(media), tx)
  const caption = media.caption?.trim()

  return (
    <button
      type="button"
      onClick={selectionMode ? onToggleSelect : onOpen}
      aria-pressed={selectionMode ? isSelected : undefined}
      aria-label={selectionMode ? tx('tile.select', 'Select {{kind}}', { kind: kindLabel }) : tx('tile.open', 'Open {{kind}} settings', { kind: kindLabel })}
      title={caption || kindLabel}
      className={cn(
        'group relative block w-full overflow-hidden rounded-[18px] bg-[var(--muted-surface)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2',
        shape === 'reel' ? 'aspect-[9/16]' : 'aspect-[3/4]',
      )}
    >
      <MediaImage
        media={media}
        className={cn(
          'absolute inset-0 h-full w-full transition-transform duration-300',
          !selectionMode && 'group-hover:scale-[1.03]',
          isSelected && 'scale-[0.94]',
        )}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--surface-inverse)]/60 to-transparent" />

      <span className="absolute right-2.5 top-2.5">
        <KindIcon media={media} />
      </span>

      {needsAttention > 0 && !selectionMode && (
        <span
          data-ui-number="true"
          data-keep-color="true"
          title={tx('stats.attention', 'Attention')}
          className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[var(--danger-text)] px-2 py-0.5 text-[11px] font-semibold text-white"
        >
          <AlertIcon className="h-3 w-3" strokeWidth={2.4} />
          {needsAttention}
        </span>
      )}

      <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
        {media.automation_enabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-2 py-0.5 text-[11px] font-semibold text-[var(--lime-ink)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-ink)]" />
            {tx('tile.auto', 'Auto')}
          </span>
        ) : null}
      </span>

      <span
        data-ui-number="true"
        data-keep-color="true"
        className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(14,21,37,0.7)]"
      >
        <CommentIcon className="h-3.5 w-3.5" />
        {comments}
      </span>

      {!selectionMode && (
        <span
          data-keep-color="true"
          className="absolute inset-0 flex items-center justify-center gap-4 bg-[var(--surface-inverse)]/55 text-sm font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span data-ui-number="true" className="inline-flex items-center gap-1.5" title={tx('stats.comments', 'Comments')}>
            <CommentIcon className="h-5 w-5" />
            {comments}
          </span>
          <span data-ui-number="true" className="inline-flex items-center gap-1.5" title={tx('stats.public', 'Replies')}>
            <ReplyIcon className="h-5 w-5" />
            {stats?.public_replies_sent ?? 0}
          </span>
          <span data-ui-number="true" className="inline-flex items-center gap-1.5" title={tx('stats.dm', 'DMs')}>
            <SendIcon className="h-5 w-5" />
            {stats?.private_replies_sent ?? 0}
          </span>
        </span>
      )}

      {selectionMode && (
        <>
          <span
            className={cn(
              'absolute inset-0 transition-colors',
              isSelected ? 'bg-[var(--primary)]/20 ring-2 ring-inset ring-[var(--primary)]' : 'bg-transparent',
            )}
          />
          <span
            data-keep-color="true"
            className={cn(
              'absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white transition-colors',
              isSelected ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-inverse)]/30 text-transparent',
            )}
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        </>
      )}
    </button>
  )
}
