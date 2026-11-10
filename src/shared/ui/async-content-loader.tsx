import { cn } from '../lib/cn'
import { LoadingBar } from './loader'

type AsyncContentLoaderProps = {
  variant?: 'page' | 'panel' | 'dialog'
  className?: string
}

function Line({ className }: { className?: string }) {
  return <span className={cn('skeleton block h-3 rounded-full', className)} />
}

/** Page skeleton: title row, KPI tiles and a table — the shape most pages load into. */
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="skeleton block h-8 w-44 rounded-[10px]" />
          <span className="skeleton block h-5 w-16 rounded-[6px]" />
        </div>
        <span className="skeleton block h-10 w-full rounded-[10px] sm:w-[300px]" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3.5">
            <div className="flex items-center justify-between">
              <Line className="w-24" />
              <span className="skeleton block h-8 w-8 rounded-[9px]" />
            </div>
            <span className="skeleton mt-2 block h-7 w-20 rounded-[8px]" />
            <Line className="mt-2.5 h-2.5 w-32" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <span className="skeleton block h-8 w-24 rounded-[8px]" />
          <span className="skeleton block h-8 w-20 rounded-[8px]" />
          <span className="ml-auto skeleton block h-8 w-28 rounded-[8px]" />
        </div>
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0">
            <span className="skeleton block h-7 w-7 shrink-0 rounded-full" />
            <Line className={index % 2 ? 'w-36' : 'w-44'} />
            <Line className="hidden w-28 sm:block" />
            <Line className="hidden w-24 md:block" />
            <span className="ml-auto skeleton block h-5 w-24 rounded-[6px]" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Panel skeleton: heading, two fields and a button (forms, auth, side panels). */
function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-5 rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="space-y-2.5">
        <span className="skeleton block h-10 w-10 rounded-[12px]" />
        <span className="skeleton block h-7 w-3/5 rounded-[8px]" />
        <Line className="w-4/5" />
      </div>
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="space-y-2">
          <Line className="h-2.5 w-20" />
          <span className="skeleton block h-12 w-full rounded-[12px]" />
        </div>
      ))}
      <span className="skeleton block h-12 w-full rounded-[12px]" />
    </div>
  )
}

/** Dialog skeleton: header and a few rows. */
function DialogSkeleton() {
  return (
    <div className="flex h-full min-h-[360px] flex-col gap-4 rounded-[18px] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-3">
        <span className="skeleton block h-11 w-11 rounded-[14px]" />
        <div className="flex-1 space-y-2">
          <Line className="h-4 w-2/5" />
          <Line className="h-2.5 w-1/4" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, index) => <span key={index} className="skeleton block h-14 rounded-[12px]" />)}
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="skeleton block h-7 w-7 rounded-[8px]" />
          <Line className={index % 2 ? 'w-1/2' : 'w-2/3'} />
        </div>
      ))}
    </div>
  )
}

/** Suspense fallback while a lazy page / dialog loads: a progress line plus a skeleton of what is coming. */
export function AsyncContentLoader({ variant = 'page', className }: AsyncContentLoaderProps) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn('relative', className)}>
      <LoadingBar className={cn('absolute inset-x-0 z-10', variant === 'page' ? '-top-[26px]' : 'top-0')} />
      {variant === 'page' ? <PageSkeleton /> : variant === 'panel' ? <PanelSkeleton /> : <DialogSkeleton />}
    </div>
  )
}
