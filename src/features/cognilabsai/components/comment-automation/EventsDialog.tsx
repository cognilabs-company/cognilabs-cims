import { useState } from 'react'
import {
  cognilabsaiService,
  type CommentAutomationEvent,
  type CommentAutomationMedia,
} from '../../../../shared/api/services/cognilabsai.service'
import { useAsyncData } from '../../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { cn } from '../../../../shared/lib/cn'
import { formatShortDateTime } from '../../../../shared/lib/format'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import { Dialog } from '../../../../shared/ui/dialog'
import { PaginationBar } from './PaginationBar'
import {
  EVENTS_PAGE_SIZE,
  EVENT_STATUSES,
  getEventAlert,
  getEventStatusBadge,
  getEventStatusLabel,
  getMediaKind,
  getMediaKindLabel,
  useCommentAutomationT,
  type EventFilter,
} from './shared'

function EventStatusBadge({ status }: { status: string | null | undefined }) {
  const tx = useCommentAutomationT()
  if (!status) return null

  return (
    <Badge variant={getEventStatusBadge(status)} size="sm" dot>
      {getEventStatusLabel(status, tx)}
    </Badge>
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
  const tx = useCommentAutomationT()

  return (
    <div
      className={cn(
        'space-y-1.5 rounded-lg border p-2.5',
        status === 'failed' && 'border-[var(--danger-border)]',
        status === 'unknown' && 'border-[var(--warning-border)]',
        status !== 'failed' && status !== 'unknown' && 'border-[var(--border)]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--caption)]">{title}</span>
        {status ? <EventStatusBadge status={status} /> : <span className="text-[11px] text-[var(--caption)]">-</span>}
      </div>
      {text ? (
        <p data-i18n-skip="true" className="whitespace-pre-wrap text-[12px] text-[var(--foreground)]">{text}</p>
      ) : (
        <p className="text-[11px] italic text-[var(--caption)]">{tx('events.no_text', 'No text')}</p>
      )}
      {messageId && (
        <p className="break-all text-[10px] text-[var(--caption)]">
          {tx('events.message_id', 'Message ID')}: <span data-i18n-skip="true" className="font-mono">{messageId}</span>
        </p>
      )}
      {error && (
        <p data-i18n-skip="true" className="rounded-md bg-[var(--danger-dim)] px-2 py-1 text-[11px] text-[var(--danger-text)]">
          {error}
        </p>
      )}
    </div>
  )
}

function EventCard({ event }: { event: CommentAutomationEvent }) {
  const tx = useCommentAutomationT()
  const alert = getEventAlert(event)

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border p-3',
        alert === 'failed' && 'border-[var(--danger-border)] bg-[var(--danger-dim)]',
        alert === 'unknown' && 'border-[var(--warning-border)] bg-amber-500/[0.06]',
        !alert && 'border-[var(--border)] bg-[var(--card)]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p data-i18n-skip="true" className="truncate text-[13px] font-semibold text-[var(--foreground)]">
            {event.sender_username ? `@${event.sender_username}` : event.sender_id ?? '-'}
          </p>
          <p className="text-[11px] text-[var(--caption)]">
            {formatShortDateTime(event.created_at)}
            {event.sent_at ? ` · ${tx('events.sent_at', 'sent {{date}}', { date: formatShortDateTime(event.sent_at) })}` : ''}
          </p>
        </div>
        <EventStatusBadge status={event.status} />
      </div>

      {event.comment_text && (
        <p data-i18n-skip="true" className="whitespace-pre-wrap rounded-lg bg-[var(--muted-surface)] px-3 py-2 text-[13px] text-[var(--foreground)]">
          {event.comment_text}
        </p>
      )}

      {alert === 'unknown' && (
        <p className="text-[11px] font-medium text-[var(--warning-text)]">
          {tx('events.unknown_hint', 'It is unknown whether Meta accepted this reply. It will not be retried automatically, so check it on Instagram.')}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <EventChannel
          title={tx('settings.public_title', 'Public reply')}
          status={event.public_reply_status}
          text={event.public_reply_text}
          messageId={event.public_reply_message_id}
          error={event.public_reply_error}
        />
        <EventChannel
          title={tx('settings.dm_title', 'Direct message')}
          status={event.dm_status}
          text={event.dm_text}
          messageId={event.dm_message_id}
          error={event.dm_error}
        />
      </div>

      <p className="break-all text-[10px] text-[var(--caption)]">
        {tx('events.comment_id', 'Comment ID')}: <span data-i18n-skip="true" className="font-mono">{event.comment_id}</span>
        {event.sender_id && (
          <>
            {' · '}
            {tx('events.sender_id', 'Sender ID')}: <span data-i18n-skip="true" className="font-mono">{event.sender_id}</span>
          </>
        )}
      </p>
    </div>
  )
}

export function EventsDialog({ media, onClose }: { media: CommentAutomationMedia; onClose: () => void }) {
  const tx = useCommentAutomationT()
  const [filter, setFilter] = useState<EventFilter>('all')
  const [page, setPage] = useState(1)
  const status = filter === 'all' ? null : filter

  const query = useAsyncData(
    () =>
      cognilabsaiService.listCommentAutomationEvents({
        mediaId: media.media_id,
        status,
        limit: EVENTS_PAGE_SIZE,
        offset: (page - 1) * EVENTS_PAGE_SIZE,
      }),
    [media.media_id, status, page],
  )

  const events = query.data?.items ?? []
  const total = query.data?.total ?? null
  const caption = media.caption?.trim()
  const filters: EventFilter[] = ['all', ...EVENT_STATUSES]

  function handleFilterChange(next: EventFilter) {
    setFilter(next)
    setPage(1)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow={tx('header.eyebrow', 'CognilabsAI')}
      title={tx('events.title', 'Reply history')}
      description={caption ? (caption.length > 100 ? `${caption.slice(0, 100)}...` : caption) : getMediaKindLabel(getMediaKind(media), tx)}
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] p-1">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleFilterChange(item)}
              aria-pressed={filter === item}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
                filter === item
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]',
              )}
            >
              {item === 'all' ? tx('filters.all', 'All') : getEventStatusLabel(item, tx)}
            </button>
          ))}
        </div>

        {query.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl bg-[var(--muted-surface)]" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-dim)] p-6 text-center">
            <p className="text-sm text-[var(--danger-text)]">{getApiErrorMessage(query.error)}</p>
            <Button variant="secondary" className="mt-3" onClick={() => void query.refetch().catch(() => undefined)}>
              {tx('actions.retry', 'Retry')}
            </Button>
          </div>
        ) : events.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[var(--caption)]">{tx('events.empty', 'No records for this filter')}</p>
        ) : (
          <div className="space-y-2">
            {events.map((event, index) => (
              <EventCard key={`${event.id ?? event.comment_id}-${index}`} event={event} />
            ))}
          </div>
        )}

        {!query.isError && (page > 1 || events.length > 0) && (
          <PaginationBar
            page={page}
            pageSize={EVENTS_PAGE_SIZE}
            totalItems={total}
            hasNextPage={events.length === EVENTS_PAGE_SIZE}
            onPageChange={setPage}
            className="border-t border-[var(--border)] pt-3"
          />
        )}
      </div>
    </Dialog>
  )
}
