/** Soft avatar colours and initials for customer rows (stable per name). */
const avatarTones = [
  'bg-[var(--blue-dim)] text-[var(--blue-text)]',
  'bg-[var(--violet-dim)] text-[var(--violet-text)]',
  'bg-[var(--success-dim)] text-[var(--success-text)]',
  'bg-[var(--warning-dim)] text-[var(--warning-text)]',
  'bg-[#E9F7FB] text-[#0B7285]',
]

export function avatarTone(name: string) {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  return avatarTones[hash % avatarTones.length]
}

export function initialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '—'
}
