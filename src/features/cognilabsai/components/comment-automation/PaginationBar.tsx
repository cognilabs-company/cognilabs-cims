import { cn } from '../../../../shared/lib/cn'
import { Button } from '../../../../shared/ui/button'
import { SelectField } from '../../../../shared/ui/select-field'
import { ChevronIcon } from './icons'
import { getVisiblePages, useCommentAutomationT } from './shared'

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
      <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-[var(--muted)]">
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
              className="h-9 min-h-9 w-[80px] rounded-[11px] bg-[var(--muted-surface)] px-3 text-[12.5px]"
            />
          </div>
        )}
      </div>

      {(page > 1 || canGoNext) && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 px-3"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronIcon direction="left" className="h-3.5 w-3.5" />
            <span className="text-[12.5px] font-semibold">{tx('pagination.prev', 'Prev')}</span>
          </Button>

          {totalPages !== null && (
            <div className="flex items-center gap-1" data-ui-number="true">
              {getVisiblePages(page, totalPages).map((item, index) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="inline-flex h-9 w-6 items-center justify-center text-[12.5px] text-[var(--muted)]">
                    ...
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-9 min-h-9 min-w-9 rounded-[11px] px-0 text-[12.5px] font-semibold',
                      item === page
                        ? 'bg-[var(--surface-inverse)] text-white hover:bg-[var(--surface-inverse)] hover:text-white'
                        : 'text-[var(--muted)]',
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
            className="gap-1.5 px-3"
            disabled={!canGoNext}
            onClick={() => onPageChange(page + 1)}
          >
            <span className="text-[12.5px] font-semibold">{tx('pagination.next', 'Next')}</span>
            <ChevronIcon direction="right" className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
