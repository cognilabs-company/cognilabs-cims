import { useState, type ReactNode } from 'react'
import {
  cognilabsaiService,
  type CommentAutomationEvent,
} from '../../../../shared/api/services/cognilabsai.service'
import { useAsyncData } from '../../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { cn } from '../../../../shared/lib/cn'
import { formatShortDateTime } from '../../../../shared/lib/format'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import { AlertIcon, ReplyIcon, SendIcon } from './icons'
import { PaginationBar } from './PaginationBar'
import {
  EVENTS_PAGE_SIZE,
  EVENT_STATUSES,
  getEventAlert,
  getEventStatusBadge,
  getEventStatusLabel,
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

function ReplyLine({
  icon,
  title,
  status,
  text,
  messageId,
  error,
}: {
  icon: ReactNode
  title: string
  status: string | null
  text: string | null
  messageId: string | null
  error: string | null
}) {
  const tx = useCommentAutomationT()

  return (
    <div className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-[var(--caption)]">{icon}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[var(--muted-strong)]">{title}</span>
          {status ? <EventStatusBadge status={status} /> : <span className="text-[11px] text-[var(--caption)]">-</span>}
        </div>
        {text ? (
          <p data-i18n-skip="true" className="whitespace-pre-wrap text-[13px] leading-snug text-[var(--foreground)]">{text}</p>
        ) : (
          <p className="text-[12px] italic text-[var(--caption)]">{tx('events.no_text', 'No text')}</p>
        )}
        {error && (
          <p data-i18n-skip="true" className="rounded-md bg-[var(--danger-dim)] px-2 py-1 text-[11px] text-[var(--danger-text)]">{error}</p>
        )}
        {messageId && (
          <p className="break-all text-[10px] text-[var(--caption)]">
            {tx('events.message_id', 'Message ID')}: <span data-i18n-skip="true" className="font-mono">{messageId}</span>
          </p>
        )}
      </div>
    </div>
  )
}

function CommentThreadItem({ event }: { event: CommentAutomationEvent }) {
  const tx = useCommentAutomationT()
  const alert = getEventAlert(event)
  const name = event.sender_username ? event.sender_username : event.sender_id ?? tx('events.unknown_user', 'Unknown user')
  const initial = name.replace(/^@/, '').charAt(0).toUpperCase() || '?'

  return (
    <li
      className={cn(
        'flex gap-3 rounded-xl px-2 py-3',
        alert === 'failed' && 'bg-[var(--danger-dim)]',
        alert === 'unknown' && 'bg-amber-500/[0.08]',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted-surface)] text-[12px] font-bold text-[var(--muted-strong)] ring-1 ring-[var(--border)]">
        {initial}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-[13px] leading-snug text-[var(--foreground)]">
            <span data-i18n-skip="true" className="mr-1.5 font-semibold">{event.sender_username ? event.sender_username : name}</span>
            {event.comment_text ? <span data-i18n-skip="true" className="whitespace-pre-wrap">{event.comment_text}</span> : null}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--caption)]">
            <span>{formatShortDateTime(event.created_at)}</span>
            {event.sent_at && <span>{tx('events.sent_at', 'sent {{date}}', { date: formatShortDateTime(event.sent_at) })}</span>}
            <EventStatusBadge status={event.status} />
          </div>
        </div>

        {alert === 'unknown' && (
          <p className="flex items-start gap-1.5 text-[11px] font-medium text-[var(--warning-text)]">
            <AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" />
            {tx('events.unknown_hint', 'It is unknown whether Meta accepted this reply. It will not be retried automatically, so check it on Instagram.')}
          </p>
        )}

        <div className="space-y-2.5 border-l-2 border-[var(--border)] pl-3">
          <ReplyLine
            icon={<ReplyIcon className="h-3.5 w-3.5" />}
            title={tx('settings.public_title', 'Public reply')}
            status={event.public_reply_status}
            text={event.public_reply_text}
            messageId={event.public_reply_message_id}
            error={event.public_reply_error}
          />
          <ReplyLine
            icon={<SendIcon className="h-3.5 w-3.5" />}
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
    </li>
  )
}

export function ReplyHistoryPanel({ mediaId }: { mediaId: string }) {
  const tx = useCommentAutomationT()
  const [filter, setFilter] = useState<EventFilter>('all')
  const [page, setPage] = useState(1)
  const status = filter === 'all' ? null : filter
  const filters: EventFilter[] = ['all', ...EVENT_STATUSES]

  const query = useAsyncData(
    () =>
      cognilabsaiService.listCommentAutomationEvents({
        mediaId,
        status,
        limit: EVENTS_PAGE_SIZE,
        offset: (page - 1) * EVENTS_PAGE_SIZE,
      }),
    [mediaId, status, page],
  )

  const events = query.data?.items ?? []
  const total = query.data?.total ?? null

  function handleFilterChange(next: EventFilter) {
    setFilter(next)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleFilterChange(item)}
            aria-pressed={filter === item}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              filter === item
                ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]',
            )}
          >
            {item === 'all' ? tx('filters.all', 'All') : getEventStatusLabel(item, tx)}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="flex gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--muted-surface)]" />
              <div className="h-20 flex-1 animate-pulse rounded-xl bg-[var(--muted-surface)]" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-dim)] p-4 text-center">
          <p className="text-[13px] text-[var(--danger-text)]">{getApiErrorMessage(query.error)}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void query.refetch().catch(() => undefined)}>
            {tx('actions.retry', 'Retry')}
          </Button>
        </div>
      ) : events.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[var(--caption)]">{tx('events.empty', 'No records for this filter')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {events.map((event, index) => (
            <CommentThreadItem key={`${event.id ?? event.comment_id}-${index}`} event={event} />
          ))}
        </ul>
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
  )
}
