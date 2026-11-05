export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function formatCallDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

export function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function statusTone(value: string) {
  if (value === 'answered' || value === 'completed') return 'text-[var(--success-text)] bg-[var(--success-dim)]'
  if (value === 'missed' || value === 'failed') return 'text-[var(--danger-text)] bg-[var(--danger-dim)]'
  if (value === 'rejected' || value === 'busy') return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30'
  return 'text-[var(--blue-text)] bg-[var(--blue-dim)]'
}
