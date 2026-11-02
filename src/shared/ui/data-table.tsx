/* eslint-disable react-hooks/set-state-in-effect */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { translateCurrent, translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'

type Column<T> = {
  key: string
  header: ReactNode
  align?: 'left' | 'center' | 'right'
  width?: string
  minWidth?: string
  render: (row: T) => ReactNode
}

type DataTableProps<T> = {
  caption?: string
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  emptyState?: ReactNode
  pageSize?: number
  initialPage?: number
  zebra?: boolean
  compact?: boolean
  onRowClick?: (row: T) => void
  onPageChange?: (page: number) => void
  disableAutoResetPage?: boolean
  className?: string
  fillHeight?: boolean
}

const alignClassName = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function getColumnStyle<T>(column: Column<T>) {
  if (!column.width && !column.minWidth) {
    return undefined
  }

  return {
    width: column.width,
    minWidth: column.minWidth ?? column.width,
  }
}

function getVisiblePageItems(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) items.push('ellipsis')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < totalPages - 1) items.push('ellipsis')
  items.push(totalPages)

  return items
}

const pagerButton =
  'inline-flex h-9 items-center justify-center gap-1 rounded-[11px] px-3 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40'

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyState,
  pageSize = 75,
  initialPage = 1,
  zebra = false,
  compact = false,
  onRowClick,
  onPageChange,
  disableAutoResetPage = false,
  className,
  fillHeight = false,
}: DataTableProps<T>) {
  const effectivePageSize = Math.max(1, pageSize > 0 ? pageSize : rows.length)
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, initialPage))
  const totalPages = Math.max(1, Math.ceil(rows.length / effectivePageSize))

  useEffect(() => {
    if (disableAutoResetPage) {
      return
    }

    setCurrentPage((current) => (current === 1 ? current : 1))
  }, [disableAutoResetPage, rows.length, effectivePageSize])

  useEffect(() => {
    if (!disableAutoResetPage) {
      return
    }

    setCurrentPage(Math.max(1, initialPage))
  }, [disableAutoResetPage, initialPage])

  useEffect(() => {
    setCurrentPage((current) => {
      const nextPage = Math.min(current, totalPages)
      return nextPage === current ? current : nextPage
    })
  }, [totalPages])

  useEffect(() => {
    onPageChange?.(currentPage)
  }, [currentPage, onPageChange])

  const startIndex = (currentPage - 1) * effectivePageSize
  const endIndex = Math.min(startIndex + effectivePageSize, rows.length)
  const visibleRows = useMemo(() => rows.slice(startIndex, endIndex), [endIndex, rows, startIndex])
  const visiblePageItems = useMemo(
    () => getVisiblePageItems(totalPages, currentPage),
    [totalPages, currentPage],
  )

  if (rows.length === 0) {
    return <>{emptyState ?? null}</>
  }

  const localizedCaption = caption ? translateCurrentLiteral(caption) : null

  return (
    <div
      className={cn(
        'w-full',
        fillHeight && 'flex h-full min-h-0 flex-col',
        className,
      )}
    >
      <div className={cn('custom-scrollbar-visible overflow-x-auto', fillHeight && 'flex-1')}>
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          {localizedCaption ? <caption className="sr-only">{localizedCaption}</caption> : null}

          <thead>
            <tr>
              {columns.map((col, index) => (
                <th
                  key={col.key}
                  style={getColumnStyle(col)}
                  className={cn(
                    'bg-[var(--muted-surface)] px-3 py-2.5 text-left align-middle text-xs font-medium whitespace-nowrap text-[var(--muted)]',
                    index === 0 && 'rounded-l-[12px] pl-3.5',
                    index === columns.length - 1 && 'rounded-r-[12px] pr-3.5',
                    alignClassName[col.align ?? 'left'],
                  )}
                >
                  {typeof col.header === 'string' ? translateCurrentLiteral(col.header) : col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row, rowIndex) => {
              const isEven = rowIndex % 2 === 0

              return (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  data-row-key={getRowKey(row)}
                  className={cn(
                    'transition-colors hover:bg-[var(--card-hover)]',
                    zebra && isEven && 'bg-[var(--muted-surface)]/60',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={getColumnStyle(col)}
                      className={cn(
                        'border-b border-[var(--border-subtle)] px-3 align-middle text-[13.5px] text-[var(--foreground)]',
                        compact ? 'py-2' : 'py-3',
                        alignClassName[col.align ?? 'left'],
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-4">
          <div className="text-xs text-[var(--muted)]">
            {translateCurrent('common.results_range', '{{start}}-{{end}} of {{total}} results', {
              start: startIndex + 1,
              end: endIndex,
              total: rows.length,
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
              className={cn(pagerButton, 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)]')}
            >
              <ChevronLeft strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true" />
              {translateCurrent('common.prev', 'Prev')}
            </button>

            {visiblePageItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="inline-flex h-9 w-9 items-center justify-center text-xs text-[var(--muted)]"
                >
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-[11px] text-[13px] font-semibold transition-colors',
                    item === currentPage
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)]',
                  )}
                >
                  {item}
                </button>
              ),
            )}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
              className={cn(pagerButton, 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)]')}
            >
              {translateCurrent('common.next', 'Next')}
              <ChevronRight strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
