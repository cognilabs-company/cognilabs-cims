import { cn } from '../lib/cn'
import { toneSolid, type Tone } from './tone'

type ProgressProps = {
  value: number
  max?: number
  tone?: Tone
  size?: 'xs' | 'sm' | 'md'
  className?: string
  trackClassName?: string
  label?: string
  onInverse?: boolean
}

const heights = {
  xs: 'h-1.5',
  sm: 'h-2',
  md: 'h-2.5',
}

export function Progress({
  value,
  max = 100,
  tone = 'blue',
  size = 'sm',
  className,
  trackClassName,
  label,
  onInverse = false,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100))

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        'w-full overflow-hidden rounded-full',
        heights[size],
        onInverse ? 'bg-white/14' : 'bg-[var(--input-surface)]',
        trackClassName,
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', toneSolid[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
