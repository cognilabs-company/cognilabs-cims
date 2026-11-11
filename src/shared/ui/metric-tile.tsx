import type { ComponentType } from 'react'
import { IconContext } from '@phosphor-icons/react'
import { cn } from '../lib/cn'
import { CountUp } from './count-up'

type MetricTileProps = {
  label: string
  /** Numbers count up; strings ("3 min 40 s", "11.5M", "—") are shown as they are. */
  value: number | string
  caption: string
  /** A Phosphor icon (rendered duotone). */
  icon: ComponentType<{ size?: number | string; className?: string }>
  accent: string
  format?: (value: number) => string
  /** Makes the tile a toggle button (e.g. a quick filter). */
  onClick?: () => void
  active?: boolean
}

const DUOTONE = { weight: 'duotone' as const, size: 18 }

/** KPI tile used across the app (Customers, CRM, Archive, CEO dashboard): label + icon, big number, one-line caption. */
export function MetricTile({ label, value, caption, icon: Icon, accent, format, onClick, active }: MetricTileProps) {
  const Cell = onClick ? 'button' : 'div'
  return (
    <Cell
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': active } : {})}
      className={cn(
        'group relative overflow-hidden rounded-[14px] border bg-[var(--card)] px-4 py-3.5 text-left transition-[transform,box-shadow,border-color] duration-300',
        active ? 'border-transparent shadow-[0_0_0_2px_var(--primary),0_12px_28px_-18px_rgba(43,89,255,0.6)]' : 'border-[var(--border)] shadow-[0_1px_2px_rgba(14,21,37,0.04)]',
        onClick && 'hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgba(14,21,37,0.45)]',
      )}
    >
      <span className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-[0.07] transition-transform duration-500 group-hover:scale-125" style={{ background: accent }} />
      <span className="flex items-center justify-between gap-3">
        <span className="truncate text-[12.5px] font-medium text-[var(--muted-strong)]">{label}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-110" style={{ background: `color-mix(in srgb, ${accent} 8%, transparent)`, color: accent }}>
          <IconContext.Provider value={DUOTONE}>
            <Icon size={18} />
          </IconContext.Provider>
        </span>
      </span>
      <span className="mt-1 block text-[28px] leading-8 font-bold tracking-[-0.035em] text-[var(--foreground)] tabular-nums" data-ui-number="true">
        {typeof value === 'number' ? <CountUp value={value} format={format} /> : value}
      </span>
      <span className="mt-1 flex items-center gap-1.5 truncate text-[11.5px] text-[var(--muted)]" title={caption}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        <span className="truncate">{caption}</span>
      </span>
    </Cell>
  )
}
