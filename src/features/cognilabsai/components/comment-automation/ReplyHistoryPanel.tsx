import { useState, type ReactNode } from 'react'
import {
  cognilabsaiService,
  type CommentAutomationEvent,
} from '../../../../shared/api/services/cognilabsai.service'
import { useAsyncData } from '../../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { cn } from '../../../../shared/lib/cn'
import { formatShortDateTime } from '../../../../shared/lib/format'
import { Alert } from '../../../../shared/ui/alert'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import { Skeleton } from '../../../../shared/ui/skeleton'
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
    <div className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-[var(--muted)]">{icon}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{title}</span>
          {status ? <EventStatusBadge status={status} /> : <span className="text-[12.5px] text-[var(--muted)]">-</span>}
        </div>
        {text ? (
          <p data-i18n-skip="true" className="whitespace-pre-wrap text-[13px] leading-snug text-[var(--foreground)]">{text}</p>
        ) : (
          <p className="text-[12.5px] italic text-[var(--muted)]">{tx('events.no_text', 'No text')}</p>
        )}
        {error && (
          <p data-i18n-skip="true" className="rounded-[9px] bg-[var(--danger-dim)] px-2.5 py-1.5 text-[11.5px] text-[var(--danger-text)]">{error}</p>
        )}
        {messageId && (
          <p className="break-all text-[11px] text-[var(--caption)]">
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
        'flex gap-3 rounded-[18px] px-3 py-3.5',
        alert === 'failed' && 'bg-[var(--danger-dim)]',
        alert === 'unknown' && 'bg-[var(--warning-dim)]',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[12.5px] font-bold text-[var(--muted-strong)]">
        {initial}
      </span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div>
          <p className="text-[13px] leading-snug text-[var(--foreground)]">
            <span data-i18n-skip="true" className="mr-1.5 font-semibold">{event.sender_username ? event.sender_username : name}</span>
            {event.comment_text ? <span data-i18n-skip="true" className="whitespace-pre-wrap">{event.comment_text}</span> : null}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--caption)]">
            <span>{formatShortDateTime(event.created_at)}</span>
            {event.sent_at && <span>{tx('events.sent_at', 'sent {{date}}', { date: formatShortDateTime(event.sent_at) })}</span>}
            <EventStatusBadge status={event.status} />
          </div>
        </div>

        {alert === 'unknown' && (
          <p className="flex items-start gap-1.5 text-[11.5px] font-medium text-[var(--warning-text)]">
            <AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" />
            {tx('events.unknown_hint', 'It is unknown whether Meta accepted this reply. It will not be retried automatically, so check it on Instagram.')}
          </p>
        )}

        <div className="space-y-3 border-l-2 border-[var(--border-hover)] pl-3">
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

        <p className="break-all text-[11px] text-[var(--caption)]">
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
    <div className="flex flex-col gap-[18px]">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleFilterChange(item)}
            aria-pressed={filter === item}
            className={cn(
              'inline-flex h-[30px] shrink-0 items-center rounded-full px-3 text-[12.5px] font-semibold transition-colors',
              filter === item
                ? 'bg-[var(--surface-inverse)] text-white'
                : 'bg-[var(--muted-surface)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
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
              <Skeleton rounded="full" className="h-9 w-9 shrink-0" />
              <Skeleton rounded="xl" className="h-20 flex-1" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <Alert
          tone="danger"
          action={
            <Button variant="secondary" size="sm" onClick={() => void query.refetch().catch(() => undefined)}>
              {tx('actions.retry', 'Retry')}
            </Button>
          }
        >
          {getApiErrorMessage(query.error)}
        </Alert>
      ) : events.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[var(--muted)]">{tx('events.empty', 'No records for this filter')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
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
          className="border-t border-[var(--border-subtle)] pt-[18px]"
        />
      )}
    </div>
  )
}
