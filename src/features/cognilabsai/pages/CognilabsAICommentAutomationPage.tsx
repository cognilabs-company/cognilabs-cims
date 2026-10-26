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
import { EmptyStateBlock, ErrorStateBlock } from '../../../shared/ui/state-block'
import { BulkSettingsDialog } from '../components/comment-automation/BulkSettingsDialog'
import { CheckIcon, GridIcon, InstagramGlyph, PostIcon, ReelsIcon } from '../components/comment-automation/icons'
import { MediaGridTile } from '../components/comment-automation/MediaGridTile'
import { MediaViewerModal } from '../components/comment-automation/MediaViewerModal'
import { PaginationBar } from '../components/comment-automation/PaginationBar'
import { SummaryTile } from '../components/comment-automation/SummaryTile'
import {
  BULK_CHUNK_SIZE,
  DEFAULT_PAGE_SIZE,
  INSTAGRAM_GRADIENT,
  MEDIA_PAGE_LIMIT,
  MEDIA_TABS,
  PAGE_SIZE_OPTIONS,
  STATUS_FILTERS,
  appendUniqueMedia,
  chunkIds,
  getMediaTabLabel,
  getNextCursor,
  getStatusFilterLabel,
  matchesMediaSearch,
  matchesMediaTab,
  matchesStatusFilter,
  useCommentAutomationT,
  type MediaTab,
  type StatusFilter,
} from '../components/comment-automation/shared'

function MediaTabIcon({ tab, className }: { tab: MediaTab; className?: string }) {
  if (tab === 'reel') return <ReelsIcon className={className} />
  if (tab === 'post') return <PostIcon className={className} />
  return <GridIcon className={className} />
}

export function CognilabsAICommentAutomationPage() {
  const tx = useCommentAutomationT()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const runIdRef = useRef(0)
  const gridRef = useRef<HTMLDivElement>(null)

  const [items, setItems] = useState<CommentAutomationMedia[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [loadVersion, setLoadVersion] = useState(0)
  const [pendingCursor, setPendingCursor] = useState<string | null>(null)
  const [isLoadingRest, setIsLoadingRest] = useState(false)
  const [restError, setRestError] = useState<unknown>(null)
  const [tab, setTab] = useState<MediaTab>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [viewerId, setViewerId] = useState<string | null>(null)

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
  const tabItems = items.filter((media) => matchesMediaTab(media, tab))
  const filteredItems = tabItems.filter((media) => matchesStatusFilter(media, statusFilter) && matchesMediaSearch(media, search))
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
  const tabCounts = Object.fromEntries(MEDIA_TABS.map((item) => [item, items.filter((media) => matchesMediaTab(media, item)).length])) as Record<MediaTab, number>
  const statusCounts = Object.fromEntries(
    STATUS_FILTERS.map((item) => [item, tabItems.filter((media) => matchesStatusFilter(media, item)).length]),
  ) as Record<StatusFilter, number>

  const viewerMedia = viewerId ? items.find((media) => media.media_id === viewerId) ?? null : null
  const viewerIndex = viewerId ? filteredItems.findIndex((media) => media.media_id === viewerId) : -1

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
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleTabChange(nextTab: MediaTab) {
    setTab(nextTab)
    setPage(1)
  }

  function handleStatusFilterChange(nextFilter: StatusFilter) {
    setStatusFilter(nextFilter)
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

  function showViewerAt(index: number) {
    const target = filteredItems[index]
    if (!target) return
    setViewerId(target.media_id)
    setPage(Math.floor(index / pageSize) + 1)
  }

  function handleToggleSelected(mediaId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(mediaId)) next.delete(mediaId)
      else next.add(mediaId)
      return next
    })
  }

  function handleSelectionModeToggle() {
    if (isSelectionMode) setSelectedIds(new Set())
    setIsSelectionMode((value) => !value)
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
        cancelLabel: tx('actions.cancel', 'Cancel'),
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
            <span className="hidden shrink-0 rounded-full p-[3px] sm:inline-flex" style={{ background: INSTAGRAM_GRADIENT }}>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--card)]">
                <InstagramGlyph className="h-7 w-7 text-[var(--foreground)]" />
              </span>
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
        <SummaryTile label={tx('summary.comments', 'Comments received')} value={commentsCount} accent="blue" />
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

      <details className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[12px] text-[var(--muted-strong)]">
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

      <div ref={gridRef} className="scroll-mt-4">
        <Card variant="glass" noPadding className="overflow-hidden">
          <div className="flex justify-center gap-6 border-b border-[var(--border)] px-4 sm:gap-14" role="tablist">
            {MEDIA_TABS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => handleTabChange(item)}
                className={cn(
                  '-mb-px inline-flex items-center gap-2 border-b-2 px-1 py-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors',
                  tab === item
                    ? 'border-[var(--foreground)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]',
                )}
              >
                <MediaTabIcon tab={item} className="h-4 w-4" />
                {getMediaTabLabel(item, tx)}
                <span data-ui-number="true" className="text-[11px] font-medium text-[var(--caption)]">{tabCounts[item]}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_FILTERS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleStatusFilterChange(item)}
                    aria-pressed={statusFilter === item}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                      statusFilter === item
                        ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]',
                    )}
                  >
                    {getStatusFilterLabel(item, tx)}
                    <span
                      data-ui-number="true"
                      className={cn(
                        'text-[10px] font-bold',
                        item === 'attention' && statusCounts[item] > 0 && statusFilter !== item ? 'text-[var(--danger-text)]' : 'opacity-70',
                      )}
                    >
                      {statusCounts[item]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 lg:ml-auto">
                <div className="relative w-full lg:w-64">
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
                <Button
                  size="sm"
                  variant={isSelectionMode ? 'primary' : 'secondary'}
                  className="h-9 shrink-0 rounded-lg"
                  onClick={handleSelectionModeToggle}
                  disabled={items.length === 0}
                  leftIcon={isSelectionMode ? <CheckIcon className="h-3.5 w-3.5" /> : undefined}
                >
                  {isSelectionMode ? tx('selection.done', 'Done') : tx('selection.mode', 'Select')}
                </Button>
              </div>
            </div>

            {isSelectionMode && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--blue-border)] bg-[var(--blue-soft)] px-3 py-2">
                <span className="text-[12px] font-medium text-[var(--blue-text)]">{tx('selection.hint', 'Tap posts to select them')}</span>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={handleTogglePage} disabled={pageItems.length === 0}>
                    {isPageSelected
                      ? tx('selection.page_clear', 'Deselect this page')
                      : tx('selection.page', 'Select this page ({{count}})', { count: pageItems.length })}
                  </Button>
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
                </div>
              </div>
            )}

            {isInitialLoading ? (
              <div className="grid grid-cols-3 gap-1 md:grid-cols-4 xl:grid-cols-6">
                {Array.from({ length: 12 }, (_, index) => (
                  <div key={index} className={cn('animate-pulse bg-[var(--muted-surface)]', tab === 'reel' ? 'aspect-[9/16]' : 'aspect-[3/4]')} />
                ))}
              </div>
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
                  handleStatusFilterChange('all')
                  handleSearchChange('')
                }}
              />
            ) : (
              <div className="grid grid-cols-3 gap-1 md:grid-cols-4 xl:grid-cols-6">
                {pageItems.map((media) => (
                  <MediaGridTile
                    key={media.media_id}
                    media={media}
                    shape={tab === 'reel' ? 'reel' : 'portrait'}
                    selectionMode={isSelectionMode}
                    isSelected={selectedIds.has(media.media_id)}
                    onOpen={() => setViewerId(media.media_id)}
                    onToggleSelect={() => handleToggleSelected(media.media_id)}
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
                className="border-t border-[var(--border)] pt-3"
              />
            )}
          </div>
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

      {viewerMedia && (
        <MediaViewerModal
          key={viewerMedia.media_id}
          media={viewerMedia}
          position={viewerIndex >= 0 ? viewerIndex + 1 : null}
          total={filteredItems.length}
          onPrev={viewerIndex > 0 ? () => showViewerAt(viewerIndex - 1) : null}
          onNext={viewerIndex >= 0 && viewerIndex < filteredItems.length - 1 ? () => showViewerAt(viewerIndex + 1) : null}
          onClose={() => setViewerId(null)}
          onSaved={handleMediaSaved}
        />
      )}
    </section>
  )
}
