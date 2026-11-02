export const avatarPalette = [
  'bg-[var(--blue-dim)] text-[var(--blue-text)]',
  'bg-[var(--lime-dim)] text-[var(--lime-text)]',
  'bg-[var(--warning-dim)] text-[var(--warning-text)]',
  'bg-[var(--violet-dim)] text-[var(--violet-text)]',
  'bg-[var(--blue-soft)] text-[var(--primary)]',
  'bg-[var(--success-dim)] text-[var(--success-text)]',
]

export function pickAvatarTone(value: string) {
  const hash = value.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 997, 7)
  return avatarPalette[hash % avatarPalette.length]
}
