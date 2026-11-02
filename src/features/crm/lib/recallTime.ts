export type RecallTimeTone = 'past' | 'active' | 'future'

export function getRecallTimeTone(value?: string | null, now = new Date()): RecallTimeTone | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const recallDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())

  if (nowDay < recallDay) {
    return 'future'
  }

  if (nowDay > recallDay) {
    return 'past'
  }

  return 'active'
}

export function getRecallTimeToneClasses(tone: RecallTimeTone) {
  switch (tone) {
    case 'past':
      return 'border-transparent bg-[var(--danger-dim)] text-[var(--danger-text)]'
    case 'active':
      return 'border-transparent bg-[var(--warning-dim)] text-[var(--warning-text)]'
    case 'future':
      return 'border-transparent bg-[var(--success-dim)] text-[var(--success-text)]'
  }
}
