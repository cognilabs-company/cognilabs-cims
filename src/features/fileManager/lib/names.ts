import type { Translate } from './items'

export const MAX_NAME = 255

/** Why a folder / file name cannot be saved, or null when it is fine (same rules as the server). */
export function nameError(value: string, t: Translate): string | null {
  const name = value.trim()
  if (!name) return t('files.name.required', 'Enter a name')
  if (name.length > MAX_NAME) return t('files.name.too_long', 'The name is too long (max {{count}} characters)', { count: MAX_NAME })
  if (/[\\/]/.test(name)) return t('files.name.slash', 'The name cannot contain / or \\')
  if (name === '.' || name === '..') return t('files.name.dots', 'This name is not allowed')
  return null
}

/** "New folder", "New folder (2)", … — the first name not taken here (case-insensitive, like Windows). */
export function uniqueName(base: string, taken: Iterable<string>) {
  const used = new Set([...taken].map((name) => name.trim().toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base} (${index})`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `${base} (${used.size + 1})`
}
