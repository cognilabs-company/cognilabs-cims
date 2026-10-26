import { cn } from '../lib/cn'

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  tone?: 'blue' | 'emerald'
  label?: string
  className?: string
}

export function Switch({ checked, onChange, disabled, size = 'md', tone = 'blue', label, className }: SwitchProps) {
  const trackOn = tone === 'emerald' ? 'bg-emerald-500' : 'bg-blue-600'
  const ringColor = tone === 'emerald' ? 'focus-visible:ring-emerald-500/30' : 'focus-visible:ring-blue-500/30'

  const trackClass = size === 'sm'
    ? 'h-4 w-7'
    : 'h-5 w-9'
  const thumbClass = size === 'sm'
    ? 'h-3 w-3'
    : 'h-4 w-4'
  const thumbOn = size === 'sm' ? 'translate-x-3.5' : 'translate-x-4'
  const thumbOff = 'translate-x-0'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2',
        ringColor,
        'disabled:cursor-not-allowed disabled:opacity-50',
        trackClass,
        checked ? trackOn : 'bg-[var(--border)]',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-sm',
          'transform transition-transform duration-200',
          thumbClass,
          checked ? thumbOn : thumbOff,
        )}
      />
    </button>
  )
}
