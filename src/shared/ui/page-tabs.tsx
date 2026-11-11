import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'

export type PageTab = { key: string; label: string; icon: LucideIcon; render: () => ReactNode }

/**
 * Several existing pages under one sidebar item: a tab bar on top, the chosen page below.
 * The first tab comes from ?tab= once; after that the pages may rewrite the query freely.
 */
export function PageTabs({ tabs, ariaLabel }: { tabs: PageTab[]; ariaLabel: string }) {
  const [params] = useSearchParams()
  const [active, setActive] = useState(() => params.get('tab') ?? '')
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0]
  if (!current) return null

  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 ? (
        <div role="tablist" aria-label={ariaLabel} className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-[14px] bg-[var(--surface)] p-1 ring-1 ring-[var(--border)] no-scrollbar">
          {tabs.map(({ key, label, icon: Icon }) => {
            const selected = key === current.key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(key)}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
                  selected ? 'bg-[var(--primary)] text-white shadow-[0_6px_16px_-10px_rgba(43,89,255,0.9)]' : 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
                )}
              >
                <Icon size={15} /> {label}
              </button>
            )
          })}
        </div>
      ) : null}
      <div key={current.key}>{current.render()}</div>
    </div>
  )
}
