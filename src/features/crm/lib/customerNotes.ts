/** Splits the AI/operator notes blob into separate entries. */
export function formatCustomerNotes(notes?: string | null) {
  if (!notes) {
    return []
  }

  const normalizedNotes = notes
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')

  const segmentedNotes = normalizedNotes
    .replace(/\s+(?=\([^)]+\)\s+\d{1,2}[./]\d{1,2}[./]\d{2,4}\b)/g, '\n\n')
    .replace(
      /\s+(?=\d{1,2}[./]\d{1,2}[./]\d{2,4}\s+\d{1,2}(?::|\.)\d{2}(?:\s?[APMapm]{2})?\s+\([^)]+\)\s+)/g,
      '\n\n',
    )
    .replace(
      /\s+(?=\d{1,2}[./]\d{1,2}[./]\d{2,4}\s+\d{1,2}(?::|\.)\d{2}(?:\s?[APMapm]{2})?\s+[A-ZА-ЯЁ][\p{L}.'-]*(?:\s+[A-ZА-ЯЁ][\p{L}.'-]*){0,2}\s+)/gu,
      '\n\n',
    )
    .replace(
      /\s+(?=\d{1,2}(?::|\.)\d{2}(?:\s?[APMapm]{2})?\s+\d{1,2}[./]\d{1,2}[./]\d{2,4}\s+[A-ZА-ЯЁ][\p{L}.'-]*(?:\s+[A-ZА-ЯЁ][\p{L}.'-]*){0,2}\b)/gu,
      '\n\n',
    )
    .replace(
      /\s+(?=(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{1,2}:\d{2}(?:\s+\([^)]+\))?)/g,
      '\n\n',
    )
    .replace(
      /([.!?])\s+(?=\d{1,2}[./]\d{1,2}[./]\d{2,4}\s+(?:Today|Tomorrow|Yesterday|Call|Called|Need|Meeting|Spoke|Contacted|Lead)\b)/g,
      '$1\n\n',
    )
    .replace(/\n{3,}/g, '\n\n')

  return segmentedNotes
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function formatConversationLanguageLabel(
  t: (key: string, fallback: string) => string,
  value?: string | null,
) {
  const normalized = (value ?? '').trim().toLowerCase()

  if (normalized === 'uz' || normalized === 'ru' || normalized === 'en') {
    return t(`common.language.${normalized}`, value ?? normalized)
  }

  return value || '-'
}
