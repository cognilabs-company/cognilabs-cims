import { cn } from '../../../../shared/lib/cn'
import { Button } from '../../../../shared/ui/button'
import { SelectField } from '../../../../shared/ui/select-field'
import { getVisiblePages, useCommentAutomationT } from './shared'

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}

export function PaginationBar({
  page,
  pageSize,
  totalItems,
  hasNextPage,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: {
  page: number
  pageSize: number
  totalItems: number | null
  hasNextPage?: boolean
  onPageChange: (page: number) => void
  pageSizeOptions?: readonly number[]
  onPageSizeChange?: (pageSize: number) => void
  className?: string
}) {
  const tx = useCommentAutomationT()
  const totalPages = totalItems === null ? null : Math.max(1, Math.ceil(totalItems / pageSize))
  const canGoNext = totalPages === null ? Boolean(hasNextPage) : page < totalPages
  const start = (page - 1) * pageSize + 1
  const end = totalItems === null ? page * pageSize : Math.min(page * pageSize, totalItems)

  if (totalItems === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        <span data-ui-number="true">
          {totalItems === null
            ? tx('pagination.page', 'Page {{page}}', { page })
            : tx('pagination.range', '{{start}}–{{end}} of {{total}}', { start, end, total: totalItems })}
        </span>
        {pageSizeOptions && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>{tx('pagination.per_page', 'Per page')}</span>
            <SelectField
              value={String(pageSize)}
              options={pageSizeOptions.map((option) => ({ value: String(option), label: String(option) }))}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              className="min-h-0 h-8 w-20 text-xs"
            />
          </div>
        )}
      </div>

      {(page > 1 || canGoNext) && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-2"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronIcon direction="left" />
            <span className="text-xs font-medium">{tx('pagination.prev', 'Prev')}</span>
          </Button>

          {totalPages !== null && (
            <div className="flex items-center gap-1" data-ui-number="true">
              {getVisiblePages(page, totalPages).map((item, index) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="inline-flex h-8 w-6 items-center justify-center text-xs text-[var(--muted)]">
                    ...
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === page ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-8 min-w-8 px-2 text-xs font-medium',
                      item === page && 'border border-[var(--border)] bg-[var(--accent-soft)]',
                    )}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </Button>
                ),
              )}
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-2"
            disabled={!canGoNext}
            onClick={() => onPageChange(page + 1)}
          >
            <span className="text-xs font-medium">{tx('pagination.next', 'Next')}</span>
            <ChevronIcon direction="right" />
          </Button>
        </div>
      )}
    </div>
  )
}
