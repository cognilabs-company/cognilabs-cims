import { createContext, useContext, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { Tooltip, ResponsiveContainer } from 'recharts'
import type { TooltipProps } from 'recharts'
import { cn } from '../lib/cn'

export type ChartConfig = Record<string, { label: string; color?: string }>

const ChartContext = createContext<{ config: ChartConfig }>({ config: {} })

export function ChartContainer({
  config,
  children,
  className,
}: {
  config: ChartConfig
  children: ReactElement
  className?: string
}) {
  const cssVars = Object.entries(config).reduce<CSSProperties>((acc, [key, val]) => {
    if (val.color) (acc as Record<string, string>)[`--color-${key}`] = val.color
    return acc
  }, {})

  return (
    <ChartContext.Provider value={{ config }}>
      <div className={cn('w-full', className)} style={cssVars}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

export { Tooltip as ChartTooltip }

type TooltipContentProps = TooltipProps<number, string> & {
  labelFormatter?: (label: string, payload: any) => ReactNode
  formatter?: (value: number, name: string) => ReactNode
  className?: string
  payload?: any[]
  label?: any
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  className,
}: TooltipContentProps) {
  const { config } = useContext(ChartContext)
  if (!active || !payload?.length) return null

  return (
    <div className={cn(
      'rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 shadow-xl text-xs',
      className,
    )}>
      {labelFormatter
        ? labelFormatter(String(label), payload)
        : <p className="mb-1.5 text-[10px] font-semibold text-[var(--muted)]">{label}</p>
      }
      {payload.map((item: any) => (
        <div key={String(item.dataKey)}>
          {formatter
            ? formatter(item.value as number, String(item.dataKey))
            : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: item.color }} />
                  <span className="text-[var(--muted-strong)]">
                    {config[String(item.dataKey)]?.label ?? item.dataKey}
                  </span>
                </div>
                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                  {Number(item.value).toLocaleString()}
                </span>
              </div>
            )
          }
        </div>
      ))}
    </div>
  )
}
