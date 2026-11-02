export type Tone = 'neutral' | 'blue' | 'success' | 'warning' | 'danger' | 'violet' | 'lime'

export const TONES: Tone[] = ['blue', 'success', 'warning', 'danger', 'violet', 'lime', 'neutral']

export const toneSurface: Record<Tone, string> = {
  neutral: 'bg-[var(--muted-surface)]',
  blue: 'bg-[var(--blue-dim)]',
  success: 'bg-[var(--success-dim)]',
  warning: 'bg-[var(--warning-dim)]',
  danger: 'bg-[var(--danger-dim)]',
  violet: 'bg-[var(--violet-dim)]',
  lime: 'bg-[var(--lime-dim)]',
}

export const toneText: Record<Tone, string> = {
  neutral: 'text-[var(--muted-strong)]',
  blue: 'text-[var(--blue-text)]',
  success: 'text-[var(--success-text)]',
  warning: 'text-[var(--warning-text)]',
  danger: 'text-[var(--danger-text)]',
  violet: 'text-[var(--violet-text)]',
  lime: 'text-[var(--lime-text)]',
}

export const toneBorder: Record<Tone, string> = {
  neutral: 'border-[var(--border)]',
  blue: 'border-[var(--blue-border)]',
  success: 'border-[var(--success-border)]',
  warning: 'border-[var(--warning-border)]',
  danger: 'border-[var(--danger-border)]',
  violet: 'border-[var(--violet-border)]',
  lime: 'border-[var(--lime)]',
}

export const toneSolid: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-inverse)] text-white',
  blue: 'bg-[var(--primary)] text-white',
  success: 'bg-[var(--success-text)] text-white',
  warning: 'bg-[var(--warning-text)] text-white',
  danger: 'bg-[var(--danger-text)] text-white',
  violet: 'bg-[var(--violet-text)] text-white',
  lime: 'bg-[var(--lime)] text-[var(--lime-ink)]',
}

export const toneDot: Record<Tone, string> = {
  neutral: 'bg-[var(--muted)]',
  blue: 'bg-[var(--blue-text)]',
  success: 'bg-[var(--success-text)]',
  warning: 'bg-[var(--warning-text)]',
  danger: 'bg-[var(--danger-text)]',
  violet: 'bg-[var(--violet-text)]',
  lime: 'bg-[var(--lime)]',
}

export function tonePill(tone: Tone) {
  return `${toneSurface[tone]} ${toneText[tone]}`
}

const TONE_KEYWORDS: Array<[RegExp, Tone]> = [
  [/^(active|online|paid|done|closed|finished|success|completed|approved|yopildi|yopilgan|bajarildi|faol)$/, 'success'],
  [/^(pending|inprocess|processing|waiting|review|draft|jarayonda|kutilmoqda|muzokara)$/, 'warning'],
  [/^(inactive|failed|rejected|deleted|error|cancelled|canceled|overdue|bekor|xato)$/, 'danger'],
  [/^(contacted|new|lead|open|taklif|aloqa|yangi)$/, 'blue'],
  [/^(continuing|planned|scheduled|reja)$/, 'violet'],
]

export function resolveTone(value?: string | null, fallback: Tone = 'neutral'): Tone {
  if (!value) return fallback
  const normalized = value.toLowerCase().replace(/[^a-zЀ-ӿ']/g, '')
  for (const [pattern, tone] of TONE_KEYWORDS) {
    if (pattern.test(normalized)) return tone
  }
  return fallback
}

export function toneByIndex(index: number): Tone {
  const cycle: Tone[] = ['blue', 'lime', 'violet', 'warning', 'success', 'danger']
  return cycle[Math.abs(index) % cycle.length]
}
