import {
  REGISTRATION_BASE_FIELDS,
  REGISTRATION_FIELD_KEY_PATTERN,
  type RegistrationField,
  type RegistrationFieldPayload,
  type RegistrationFieldType,
} from '../../../shared/api/services/registrations.service'

/* Field builder helpers: base fields, key / slug generation, draft ↔ payload, validation. */

export const OPTION_FIELD_TYPES: ReadonlySet<RegistrationFieldType> = new Set(['select', 'multi_select', 'radio'])
export const FILE_FIELD_TYPES: ReadonlySet<RegistrationFieldType> = new Set(['file', 'image'])
export const MAX_FIELDS = 100

const BASE_KEYS: ReadonlySet<string> = new Set(REGISTRATION_BASE_FIELDS.map((field) => field.key))

export function isBaseKey(key: string) {
  return BASE_KEYS.has(key)
}

export function hasOptions(type: RegistrationFieldType) {
  return OPTION_FIELD_TYPES.has(type)
}

export function isFileType(type: RegistrationFieldType) {
  return FILE_FIELD_TYPES.has(type)
}

/** A field while it is being edited in the builder. */
export type DraftField = RegistrationField & {
  /** Stable React key (the field key itself can change). */
  uid: string
  /** The key was typed by hand (or comes from a saved form) — the label no longer rewrites it. */
  keyEdited: boolean
  /** One of the four required fields: only the label can change. */
  locked: boolean
}

export type FieldIssue = 'label_required' | 'key_invalid' | 'key_duplicate' | 'options_required' | 'option_empty' | 'option_duplicate'
export type FieldIssues = Partial<Record<'label' | 'key' | 'options', FieldIssue>>

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu',
  я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
}

/** Latin, lower-case words of `value` (Cyrillic transliterated, accents and Uzbek apostrophes dropped). */
function latinWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (char) => CYRILLIC[char] ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʻʼ'`‘’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** "Telefon raqami" → "telefon_raqami"; always matches ^[a-z][a-z0-9_]{0,63}$ and is not in `taken`. */
export function keyFromLabel(label: string, taken: ReadonlySet<string>) {
  let base = latinWords(label).join('_') || 'field'
  if (!/^[a-z]/.test(base)) base = `f_${base}`
  base = base.slice(0, 64).replace(/_+$/, '')
  let key = base
  for (let index = 2; taken.has(key); index += 1) {
    const suffix = `_${index}`
    key = `${base.slice(0, 64 - suffix.length).replace(/_+$/, '')}${suffix}`
  }
  return key
}

/** Typing a key by hand: lower-case, spaces → "_", other characters dropped (validation explains the rest). */
export function sanitizeKeyInput(value: string) {
  return value.toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 64)
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const SLUG_MAX = 80

/** "Developer registration" → "developer-registration". */
export function slugFromTitle(title: string) {
  return latinWords(title).join('-').slice(0, SLUG_MAX).replace(/-+$/, '')
}

/** Typing a slug by hand: lower-case latin, digits and single hyphens. */
export function sanitizeSlugInput(value: string) {
  return value.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, SLUG_MAX)
}

export function publicUrl(slug: string) {
  return `${window.location.origin}/register/${slug}`
}

export function newUid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `f-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function baseDraft(base: (typeof REGISTRATION_BASE_FIELDS)[number], saved?: RegistrationField): DraftField {
  return {
    key: base.key,
    label: saved?.label?.trim() ? saved.label : base.label,
    type: base.type,
    required: true,
    placeholder: saved?.placeholder ?? null,
    help_text: saved?.help_text ?? null,
    options: [],
    accept: [],
    uid: `base-${base.key}`,
    keyEdited: true,
    locked: true,
  }
}

/** Drafts for the builder: the four required fields first (in contract order), then the custom ones. */
export function toDrafts(fields: RegistrationField[] = []): DraftField[] {
  const bases = REGISTRATION_BASE_FIELDS.map((base) => baseDraft(base, fields.find((field) => field.key === base.key)))
  const custom = fields
    .filter((field) => !isBaseKey(field.key))
    .map((field, index): DraftField => ({ ...field, options: [...field.options], accept: [...field.accept], uid: `saved-${index}-${field.key}`, keyEdited: true, locked: false }))
  return [...bases, ...custom]
}

export function newDraft(type: RegistrationFieldType, label: string, taken: ReadonlySet<string>): DraftField {
  return {
    key: keyFromLabel(label, taken),
    label,
    type,
    required: false,
    placeholder: null,
    help_text: null,
    options: [],
    accept: type === 'image' ? ['.jpg', '.jpeg', '.png', '.webp'] : [],
    uid: newUid(),
    keyEdited: false,
    locked: false,
  }
}

const cleanText = (value: string | null) => value?.trim() || undefined

/** The fields as POST / PATCH expect them. */
export function toPayload(drafts: DraftField[]): RegistrationFieldPayload[] {
  return drafts.map((draft) => {
    const payload: RegistrationFieldPayload = {
      key: draft.key,
      label: draft.label.trim(),
      type: draft.type,
      required: draft.locked ? true : draft.required,
    }
    const placeholder = cleanText(draft.placeholder)
    const helpText = cleanText(draft.help_text)
    if (placeholder && draft.type !== 'checkbox' && !isFileType(draft.type)) payload.placeholder = placeholder
    if (helpText) payload.help_text = helpText
    if (hasOptions(draft.type)) payload.options = draft.options.map((option) => option.trim())
    if (isFileType(draft.type) && draft.accept.length) payload.accept = draft.accept
    return payload
  })
}

/** Problems per field uid (empty object = valid). */
export function validateDrafts(drafts: DraftField[]): Record<string, FieldIssues> {
  const result: Record<string, FieldIssues> = {}
  const keyCounts = new Map<string, number>()
  for (const draft of drafts) keyCounts.set(draft.key, (keyCounts.get(draft.key) ?? 0) + 1)

  for (const draft of drafts) {
    const issues: FieldIssues = {}
    if (!draft.label.trim()) issues.label = 'label_required'
    if (!REGISTRATION_FIELD_KEY_PATTERN.test(draft.key)) issues.key = 'key_invalid'
    else if ((keyCounts.get(draft.key) ?? 0) > 1) issues.key = 'key_duplicate'
    if (hasOptions(draft.type)) {
      const trimmed = draft.options.map((option) => option.trim())
      if (trimmed.length === 0) issues.options = 'options_required'
      else if (trimmed.some((option) => !option)) issues.options = 'option_empty'
      else if (new Set(trimmed.map((option) => option.toLowerCase())).size !== trimmed.length) issues.options = 'option_duplicate'
    }
    if (Object.keys(issues).length) result[draft.uid] = issues
  }
  return result
}

/** Common `accept` presets for file fields. */
export const ACCEPT_PRESETS: Array<{ id: string; values: string[] }> = [
  { id: 'pdf', values: ['.pdf'] },
  { id: 'word', values: ['.doc', '.docx'] },
  { id: 'excel', values: ['.xls', '.xlsx'] },
  { id: 'images', values: ['.jpg', '.jpeg', '.png', '.webp'] },
  { id: 'archives', values: ['.zip', '.rar'] },
]

/** ".PDF" / "pdf" → ".pdf"; "image/*" stays a MIME pattern. */
export function normalizeAcceptToken(value: string) {
  const token = value.trim().toLowerCase()
  if (!token) return ''
  if (token.includes('/')) return /^[a-z0-9.+-]+\/(\*|[a-z0-9.+-]+)$/.test(token) ? token : ''
  const extension = token.replace(/^\.+/, '').replace(/[^a-z0-9]/g, '')
  return extension ? `.${extension}` : ''
}
