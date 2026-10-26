/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { translateCurrent, translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'
import { Button } from './button'

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

function getVisiblePageItems(totalPages: number) {
  if (totalPages <= 6) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  return [1, 2, 3, 'ellipsis', totalPages - 1, totalPages] as const
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 4L6 8l4 4" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyState,
  pageSize = 75,
  initialPage = 1,
  zebra = false,
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
  const visiblePageItems = useMemo(() => getVisiblePageItems(totalPages), [totalPages])

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
      <div className={cn('overflow-x-auto custom-scrollbar-visible', fillHeight && 'flex-1')}>
        <table className="w-full min-w-max border-collapse text-sm">
          {localizedCaption ? <caption className="sr-only">{localizedCaption}</caption> : null}

          <thead>
            <tr className="border-b border-[var(--border)] transition-colors">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={getColumnStyle(col)}
                  className={cn(
                    'h-12 px-4 text-left align-middle font-bold text-[11px] uppercase tracking-[0.12em] text-[var(--muted-strong)] whitespace-nowrap',
                    alignClassName[col.align ?? 'left'],
                  )}
                >
                  {typeof col.header === 'string' ? translateCurrentLiteral(col.header) : col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="[&_tr:last-child]:border-0">
            {visibleRows.map((row, rowIndex) => {
              const isEven = rowIndex % 2 === 0

              return (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  data-row-key={getRowKey(row)}
                  className={cn(
                    'border-b border-[var(--border)] transition-colors hover:bg-[var(--accent-soft)]',
                    zebra && isEven && 'bg-white/[0.012]',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={getColumnStyle(col)}
                      className={cn(
                        'p-4 align-middle text-[var(--foreground)]',
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
        <div className="flex items-center justify-end space-x-2 py-4 px-2">
          <div className="flex-1 text-xs text-[var(--muted)]">
            {translateCurrent('common.results_range', '{{start}}-{{end}} of {{total}} results', {
              start: startIndex + 1,
              end: endIndex,
              total: rows.length,
            })}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
              className="h-8 px-2"
            >
              <ChevronLeft />
              <span className="ml-1 text-xs font-medium">Prev</span>
            </Button>

            <div className="flex items-center gap-1">
              {visiblePageItems.map((item, index) => {
                if (item === 'ellipsis') {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="inline-flex h-8 w-8 items-center justify-center text-xs text-[var(--muted)]"
                    >
                      ...
                    </span>
                  )
                }

                return (
                  <Button
                    key={item}
                    variant={item === currentPage ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-8 w-8 p-0 text-xs font-medium',
                      item === currentPage && 'border border-[var(--border)] bg-[var(--accent-soft)]',
                    )}
                    onClick={() => setCurrentPage(item)}
                  >
                    {item}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
              className="h-8 px-2"
            >
              <span className="mr-1 text-xs font-medium">Next</span>
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
