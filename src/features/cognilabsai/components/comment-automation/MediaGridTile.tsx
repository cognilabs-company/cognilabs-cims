import type { CommentAutomationMedia } from '../../../../shared/api/services/cognilabsai.service'
import { cn } from '../../../../shared/lib/cn'
import { AlertIcon, CarouselIcon, CheckIcon, CommentIcon, PlayIcon, ReelsIcon, ReplyIcon, SendIcon } from './icons'
import { MediaImage } from './MediaImage'
import { getMediaKind, getMediaKindLabel, useCommentAutomationT } from './shared'

function KindIcon({ media }: { media: CommentAutomationMedia }) {
  const kind = getMediaKind(media)
  const className = 'h-5 w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]'

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
        'group relative block w-full overflow-hidden bg-[var(--muted-surface)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-text)] focus-visible:ring-offset-1',
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />

      <span className="absolute right-2 top-2">
        <KindIcon media={media} />
      </span>

      {needsAttention > 0 && !selectionMode && (
        <span
          data-ui-number="true"
          data-keep-color="true"
          title={tx('stats.attention', 'Attention')}
          className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-red-500 py-0.5 pl-1 pr-1.5 text-[10px] font-bold text-white shadow"
        >
          <AlertIcon className="h-3 w-3" strokeWidth={2.4} />
          {needsAttention}
        </span>
      )}

      <span className="absolute bottom-2 left-2 flex items-center gap-1.5">
        {media.automation_enabled ? (
          <span
            data-keep-color="true"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {tx('tile.auto', 'Auto')}
          </span>
        ) : null}
      </span>

      <span
        data-ui-number="true"
        data-keep-color="true"
        className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[12px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
      >
        <CommentIcon className="h-3.5 w-3.5" />
        {comments}
      </span>

      {!selectionMode && (
        <span
          data-keep-color="true"
          className="absolute inset-0 flex items-center justify-center gap-4 bg-black/45 text-[14px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
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
          <span className={cn('absolute inset-0 transition-colors', isSelected ? 'bg-blue-500/20 ring-2 ring-inset ring-blue-500' : 'bg-black/0')} />
          <span
            data-keep-color="true"
            className={cn(
              'absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow transition-colors',
              isSelected ? 'bg-blue-500 text-white' : 'bg-black/25 text-transparent',
            )}
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        </>
      )}
    </button>
  )
}
