import { cn } from '../../../shared/lib/cn'

const TONES = [
  'bg-[var(--blue-dim)] text-[var(--blue-text)]',
  'bg-[var(--success-dim)] text-[var(--success-text)]',
  'bg-[var(--warning-dim)] text-[var(--warning-text)]',
  'bg-[var(--muted-surface)] text-[var(--muted-strong)]',
  'bg-[var(--danger-dim)] text-[var(--danger-text)]',
]

function initials(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Initials in a soft, name-stable colour. */
export function ApplicantAvatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const hash = name.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 997, 7)
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold select-none', TONES[hash % TONES.length], className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      data-i18n-skip="true"
    >
      {initials(name)}
    </span>
  )
}
