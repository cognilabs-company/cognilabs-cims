import { useEffect, useRef, useState } from 'react'
import {
  cognilabsaiService,
  type CommentAutomationMedia,
  type CommentAutomationSettingsPayload,
} from '../../../shared/api/services/cognilabsai.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { formatShortDateTime } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { SectionTitle } from '../../../shared/ui/section-title'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { BulkSettingsDialog } from '../components/comment-automation/BulkSettingsDialog'
import { EventsDialog } from '../components/comment-automation/EventsDialog'
import { MediaRow } from '../components/comment-automation/MediaRow'
import { PaginationBar } from '../components/comment-automation/PaginationBar'
import { SummaryTile } from '../components/comment-automation/SummaryTile'
import {
  BULK_CHUNK_SIZE,
  DEFAULT_PAGE_SIZE,
  INSTAGRAM_GRADIENT,
  MEDIA_FILTERS,
  MEDIA_PAGE_LIMIT,
  PAGE_SIZE_OPTIONS,
  appendUniqueMedia,
  chunkIds,
  getMediaFilterLabel,
  getNextCursor,
  getSettingsKey,
  matchesMediaFilter,
  matchesMediaSearch,
  useCommentAutomationT,
  type MediaFilter,
} from '../components/comment-automation/shared'

export function CognilabsAICommentAutomationPage() {
  const tx = useCommentAutomationT()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const runIdRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  const [items, setItems] = useState<CommentAutomationMedia[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [loadVersion, setLoadVersion] = useState(0)
  const [pendingCursor, setPendingCursor] = useState<string | null>(null)
  const [isLoadingRest, setIsLoadingRest] = useState(false)
  const [restError, setRestError] = useState<unknown>(null)
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [eventsMedia, setEventsMedia] = useState<CommentAutomationMedia | null>(null)

  useEffect(() => {
    const runIds = runIdRef
    return () => {
      runIds.current += 1
    }
  }, [])

  async function loadRemainingPages(runId: number, startCursor: string | null) {
    if (!startCursor) {
      setPendingCursor(null)
      return
    }

    const visitedCursors = new Set<string>()
    let cursor: string | null = startCursor

    setIsLoadingRest(true)
    setRestError(null)
    setPendingCursor(cursor)
    try {
      while (cursor && !visitedCursors.has(cursor)) {
        visitedCursors.add(cursor)
        const response = await cognilabsaiService.listCommentAutomationMedia({ refresh: true, limit: MEDIA_PAGE_LIMIT, after: cursor })
        if (runIdRef.current !== runId) return
        setItems((prev) => appendUniqueMedia(prev, response.items))
        if (response.synced_at) setSyncedAt(response.synced_at)
        cursor = getNextCursor(response)
        setPendingCursor(cursor)
      }
      if (runIdRef.current === runId) setPendingCursor(null)
    } catch (error) {
      if (runIdRef.current === runId) setRestError(error)
    } finally {
      if (runIdRef.current === runId) setIsLoadingRest(false)
    }
  }

  const firstPageQuery = useAsyncData(
    () => cognilabsaiService.listCommentAutomationMedia({ refresh: true, limit: MEDIA_PAGE_LIMIT }),
    [loadVersion],
    {
      onSuccess: (response) => {
        runIdRef.current += 1
        setItems(response.items)
        setSyncedAt(response.synced_at)
        setSelectedIds(new Set())
        setPage(1)
        void loadRemainingPages(runIdRef.current, getNextCursor(response))
      },
      onError: (error) => {
        if (items.length > 0) {
          showToast({ title: tx('toast.refresh_failed', 'Could not refresh the list'), description: getApiErrorMessage(error), tone: 'error' })
        }
      },
    },
  )

  const isInitialLoading = firstPageQuery.isLoading && items.length === 0
  const isFullyLoaded = !firstPageQuery.isLoading && !firstPageQuery.isError && !isLoadingRest && !pendingCursor
  const filteredItems = items.filter((media) => matchesMediaFilter(media, filter) && matchesMediaSearch(media, search))
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageIds = pageItems.map((media) => media.media_id)
  const selectedCount = selectedIds.size
  const isPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const isAllFilteredSelected = filteredItems.length > 0 && filteredItems.every((media) => selectedIds.has(media.media_id))
  const enabledCount = items.filter((media) => media.automation_enabled).length
  const attentionCount = items.reduce((sum, media) => sum + (media.automation_stats?.needs_attention ?? 0), 0)
  const commentsCount = items.reduce((sum, media) => sum + (media.automation_stats?.comments_received ?? media.comments_count ?? 0), 0)
  const filterCounts = Object.fromEntries(
    MEDIA_FILTERS.map((item) => [item, items.filter((media) => matchesMediaFilter(media, item)).length]),
  ) as Record<MediaFilter, number>

  function handleRefresh() {
    runIdRef.current += 1
    setIsLoadingRest(false)
    setRestError(null)
    setPendingCursor(null)
    setLoadVersion((version) => version + 1)
  }

  function handleContinueLoading() {
    void loadRemainingPages(runIdRef.current, pendingCursor)
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleFilterChange(nextFilter: MediaFilter) {
    setFilter(nextFilter)
    setPage(1)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize)
    setPage(1)
  }

  function handleMediaSaved(updated: CommentAutomationMedia) {
    setItems((prev) => prev.map((media) => (media.media_id === updated.media_id ? updated : media)))
  }

  function handleSelectedChange(mediaId: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(mediaId)
      else next.delete(mediaId)
      return next
    })
  }

  function handleTogglePage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      pageIds.forEach((id) => {
        if (isPageSelected) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }

  function handleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredItems.forEach((media) => next.add(media.media_id))
      return next
    })
  }

  function getBulkFailureTitle(index: number, total: number) {
    if (total === 1) return tx('toast.not_saved', 'Changes were not saved')
    if (index === 0) return tx('bulk.failed_first', 'Part 1 of {{total}} failed, nothing was changed', { total })
    return tx('bulk.failed_chunk', 'Part {{part}} of {{total}} failed. The first {{saved}} part(s) were saved, the rest were not sent.', {
      part: index + 1,
      total,
      saved: index,
    })
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
          const updatedById = new Map((response.items ?? []).map((media) => [media.media_id, media]))
          updatedCount += response.updated_count ?? chunk.length
          setItems((prev) =>
            prev.map((media) => (chunkSet.has(media.media_id) ? { ...media, ...payload, ...updatedById.get(media.media_id) } : media)),
          )
        } catch (error) {
          showToast({ title: getBulkFailureTitle(index, chunks.length), description: getApiErrorMessage(error), tone: 'error' })
          return false
        }
      }

      showToast({ title: successTitle, description: tx('bulk.updated_count', '{{count}} items updated.', { count: updatedCount }), tone: 'success' })
      return true
    } finally {
      setIsBulkSaving(false)
    }
  }

  async function handleBulkToggle(enabled: boolean) {
    if (enabled) {
      const approved = await confirm({
        title: tx('bulk.enable_confirm_title', 'Enable auto reply?'),
        description: tx(
          'bulk.enable_confirm_description',
          'Auto reply will be turned on for {{count}} selected items. New comments will get a public reply and/or DM based on each item\'s own settings.',
          { count: selectedCount },
        ),
        confirmLabel: tx('bulk.enable', 'Enable selected'),
      })
      if (!approved) return
    }

    await runBulkUpdate(
      { automation_enabled: enabled },
      enabled ? tx('bulk.enabled_toast', 'Auto reply enabled') : tx('bulk.disabled_toast', 'Auto reply disabled'),
    )
  }

  return (
    <section className="space-y-4 page-enter">
      <Card variant="glass" noPadding className="overflow-hidden rounded-xl border-[var(--border)]">
        <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
          <div className="flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md sm:inline-flex" style={{ background: INSTAGRAM_GRADIENT }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--blue-text)]">
                {tx('header.eyebrow', 'CognilabsAI')}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[1.75rem]">
                {tx('header.title', 'Instagram comments')}
              </h1>
              <p className="mt-1.5 max-w-2xl text-[13px] text-(--muted-strong)">
                {tx('header.description', 'Manage public replies and the first DM for comments on each post and reel.')}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-9 rounded-xl"
              onClick={handleRefresh}
              loading={firstPageQuery.isLoading && items.length > 0}
              disabled={isBulkSaving || isInitialLoading}
            >
              {tx('actions.refresh', 'Refresh')}
            </Button>
            {syncedAt && (
              <span className="text-[11px] text-[var(--caption)]">
                {tx('header.synced', 'Synced {{date}}', { date: formatShortDateTime(syncedAt) })}
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label={tx('summary.total', 'Posts and reels')}
          value={items.length}
          hint={isFullyLoaded ? tx('summary.all_loaded', 'All pages loaded') : tx('summary.loading', 'Loading...')}
        />
        <SummaryTile
          label={tx('summary.enabled', 'Auto reply on')}
          value={enabledCount}
          hint={tx('summary.enabled_hint', 'of {{total}}', { total: items.length })}
          accent="success"
        />
        <SummaryTile
          label={tx('summary.comments', 'Comments received')}
          value={commentsCount}
          accent="blue"
        />
        <SummaryTile
          label={tx('summary.attention', 'Needs attention')}
          value={attentionCount}
          hint={attentionCount > 0 ? tx('summary.attention_hint', 'Check the reply history') : undefined}
          accent={attentionCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {isLoadingRest && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--blue-border)] bg-[var(--blue-soft)] px-4 py-2.5 text-[12px] font-medium text-[var(--blue-text)]">
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {tx('loading.progress', 'Loading all posts and reels... {{count}} loaded', { count: items.length })}
        </div>
      )}

      {Boolean(restError) && !isLoadingRest && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-dim)] px-4 py-2.5 text-[12px] text-[var(--danger-text)]">
          <span>
            {tx('loading.partial_error', 'Only {{count}} items were loaded: {{error}}', { count: items.length, error: getApiErrorMessage(restError) })}
          </span>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={handleContinueLoading}>
            {tx('actions.continue_loading', 'Continue loading')}
          </Button>
        </div>
      )}

      <details className="group rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[12px] text-[var(--muted-strong)]">
        <summary className="flex cursor-pointer select-none items-center gap-2 text-[13px] font-semibold text-[var(--foreground)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-[var(--blue-text)]">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          {tx('rules.title', 'Meta rules')}
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
          <li>{tx('rules.private_reply', 'The DM is sent by comment ID, so no previous chat is required.')}</li>
          <li>{tx('rules.one_reply', 'Each comment can get only one private reply, within 7 days of the comment (Live comments are an exception).')}</li>
          <li>{tx('rules.message_requests', 'If the user does not follow the account, the DM may land in Message Requests. No further DM is sent until the user replies.')}</li>
          <li>{tx('rules.independent', 'Public reply and DM are sent separately: a failure in one does not stop the other.')}</li>
          <li>{tx('rules.new_media', 'Auto reply is not turned on automatically for new posts and reels.')}</li>
          <li>{tx('rules.permissions', 'The connected Meta app needs the comments webhook field and comment/message permissions.')}</li>
        </ul>
      </details>

      <div ref={listRef} className="scroll-mt-4">
        <Card variant="glass" className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SectionTitle title={tx('list.title', 'Posts and reels')} />
            <div className="relative w-full lg:max-w-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--caption)]">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <Input
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={tx('list.search', 'Search by caption')}
                className="h-9 pl-8 text-[13px]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] p-1">
            {MEDIA_FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleFilterChange(item)}
                aria-pressed={filter === item}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all',
                  filter === item
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]',
                )}
              >
                {getMediaFilterLabel(item, tx)}
                <span
                  data-ui-number="true"
                  className={cn(
                    'rounded-md px-1.5 text-[10px] font-bold',
                    item === 'attention' && filterCounts[item] > 0
                      ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]'
                      : 'bg-[var(--accent-soft)] text-[var(--muted)]',
                  )}
                >
                  {filterCounts[item]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--accent-soft)]">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-blue-500"
                checked={isPageSelected}
                onChange={handleTogglePage}
                disabled={pageItems.length === 0}
              />
              {tx('selection.page', 'Select this page ({{count}})', { count: pageItems.length })}
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSelectAll}
              disabled={!isFullyLoaded || filteredItems.length === 0 || isAllFilteredSelected}
            >
              {isFullyLoaded
                ? tx('selection.all', 'Select all {{count}}', { count: filteredItems.length })
                : tx('selection.all_loading', 'Select all (loading...)')}
            </Button>
            {selectedCount > 0 && (
              <span className="ml-auto text-[12px] text-[var(--muted)]">
                {tx('selection.count', '{{count}} selected', { count: selectedCount })}
              </span>
            )}
          </div>

          {isInitialLoading ? (
            <LoadingStateBlock eyebrow={tx('header.eyebrow', 'CognilabsAI')} title={tx('states.loading', 'Loading posts and reels')} />
          ) : firstPageQuery.isError && items.length === 0 ? (
            <ErrorStateBlock
              eyebrow={tx('header.eyebrow', 'CognilabsAI')}
              title={tx('states.error', 'Could not load posts and reels')}
              actionLabel={tx('actions.retry', 'Retry')}
              onAction={handleRefresh}
            >
              <p className="max-w-md text-[13px] text-[var(--danger-text)]">{getApiErrorMessage(firstPageQuery.error)}</p>
            </ErrorStateBlock>
          ) : items.length === 0 ? (
            <EmptyStateBlock
              eyebrow={tx('header.eyebrow', 'CognilabsAI')}
              title={tx('states.empty', 'No posts or reels found')}
              actionLabel={tx('actions.refresh', 'Refresh')}
              onAction={handleRefresh}
            >
              <p className="max-w-md text-[13px] text-[var(--caption)]">
                {tx('states.empty_hint', 'Check that the Instagram account is connected in AI Integrations.')}
              </p>
            </EmptyStateBlock>
          ) : filteredItems.length === 0 ? (
            <EmptyStateBlock
              eyebrow={tx('header.eyebrow', 'CognilabsAI')}
              title={tx('states.no_match', 'Nothing matches the filter')}
              actionLabel={tx('actions.reset_filters', 'Reset filters')}
              onAction={() => {
                handleFilterChange('all')
                handleSearchChange('')
              }}
            />
          ) : (
            <div className="space-y-3">
              {pageItems.map((media) => (
                <MediaRow
                  key={`${media.media_id}:${getSettingsKey(media)}`}
                  media={media}
                  isSelected={selectedIds.has(media.media_id)}
                  onSelectedChange={(selected) => handleSelectedChange(media.media_id, selected)}
                  onSaved={handleMediaSaved}
                  onOpenEvents={() => setEventsMedia(media)}
                />
              ))}
            </div>
          )}

          {filteredItems.length > 0 && (
            <PaginationBar
              page={currentPage}
              pageSize={pageSize}
              totalItems={filteredItems.length}
              onPageChange={handlePageChange}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={handlePageSizeChange}
              className="border-t border-[var(--border)] pt-4"
            />
          )}
        </Card>
      </div>

      {selectedCount > 0 && (
        <div className="sticky bottom-4 z-30">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-[var(--shadow-xl)]">
            <Badge variant="blue" dot>
              {tx('selection.count', '{{count}} selected', { count: selectedCount })}
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={isBulkSaving}>
              {tx('selection.clear', 'Clear selection')}
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="success" onClick={() => void handleBulkToggle(true)} disabled={isBulkSaving}>
                {tx('bulk.enable', 'Enable selected')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void handleBulkToggle(false)} disabled={isBulkSaving}>
                {tx('bulk.disable', 'Disable selected')}
              </Button>
              <Button size="sm" onClick={() => setIsBulkDialogOpen(true)} disabled={isBulkSaving} loading={isBulkSaving}>
                {tx('bulk.settings', 'Shared reply settings')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isBulkDialogOpen && (
        <BulkSettingsDialog
          count={selectedCount}
          onClose={() => setIsBulkDialogOpen(false)}
          onSubmit={(payload) => runBulkUpdate(payload, tx('bulk.applied_toast', 'Shared settings applied'))}
        />
      )}

      {eventsMedia && <EventsDialog media={eventsMedia} onClose={() => setEventsMedia(null)} />}
    </section>
  )
}
