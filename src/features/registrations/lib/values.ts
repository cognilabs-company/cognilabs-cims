import {
  REGISTRATION_MAX_FILE_BYTES,
  REGISTRATION_MAX_TOTAL_BYTES,
  type RegistrationField,
  type RegistrationSubmissionBody,
} from '../../../shared/api/services/registrations.service'
import { hasOptions, isFileType } from './fields'

/* Public form: values, client validation and the request body (JSON or multipart). */

export type FormValue = string | string[] | boolean
export type FormValues = Record<string, FormValue>

/** A file chosen in the browser; `preview` is an object URL for images (revoked by the owner). */
export type PickedFile = { id: string; file: File; preview: string | null }
export type FormFiles = Record<string, PickedFile[]>

export type ValueIssue =
  | { code: 'required' }
  | { code: 'email' }
  | { code: 'phone' }
  | { code: 'number' }
  | { code: 'option' }
  | { code: 'accept'; name: string }
  | { code: 'file_size'; name: string }
  | { code: 'server'; message: string }

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function emptyValue(field: RegistrationField): FormValue {
  if (field.type === 'multi_select') return []
  if (field.type === 'checkbox') return false
  return ''
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** A saved answer → the editor's value (rejected applications are prefilled with it). */
function valueFromAnswer(field: RegistrationField, answer: unknown): FormValue {
  if (answer == null) return emptyValue(field)
  switch (field.type) {
    case 'multi_select':
      return Array.isArray(answer) ? answer.map(String) : typeof answer === 'string' && answer ? [answer] : []
    case 'checkbox':
      return answer === true || answer === 'true' || answer === 1 || answer === '1'
    case 'date': {
      const text = String(answer)
      return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
    }
    case 'datetime': {
      const text = String(answer)
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return ''
      // With an offset ("…+05:00" / "Z") the moment is shown in the applicant's local time.
      if (/(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
        const date = new Date(text)
        if (!Number.isNaN(date.getTime())) {
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
        }
      }
      return text.slice(0, 16)
    }
    case 'password':
    case 'file':
    case 'image':
      return emptyValue(field)
    default:
      return typeof answer === 'object' ? '' : String(answer)
  }
}

export function initialValues(fields: RegistrationField[], answers: Record<string, unknown> = {}): FormValues {
  return Object.fromEntries(fields.map((field) => [field.key, valueFromAnswer(field, answers[field.key])]))
}

/** The accept list the file input uses: image fields always limit to images. */
export function effectiveAccept(field: RegistrationField) {
  if (field.accept.length) return field.accept
  return field.type === 'image' ? ['image/*'] : []
}

export function matchesAccept(file: File, accept: string[]) {
  if (!accept.length) return true
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return accept.some((raw) => {
    const token = raw.trim().toLowerCase()
    if (!token) return false
    if (token.startsWith('.')) return name.endsWith(token)
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1))
    if (token.includes('/')) return type === token
    return name.endsWith(`.${token}`)
  })
}

export function totalBytes(files: FormFiles) {
  return Object.values(files).flat().reduce((sum, item) => sum + item.file.size, 0)
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const trim = (value: string) => value.replace(/\.0$/, '')
  if (bytes < 1024 * 1024) return `${trim((bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0))} KB`
  return `${trim((bytes / (1024 * 1024)).toFixed(1))} MB`
}

const isBlank = (value: FormValue | undefined) =>
  value === undefined || value === false || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)

/**
 * Client checks before sending. `keptFiles` — files already stored for a rejected application
 * (they satisfy a required file field when nothing new is chosen).
 */
export function validateValues(
  fields: RegistrationField[],
  values: FormValues,
  files: FormFiles,
  keptFiles: Record<string, number> = {},
): Record<string, ValueIssue> {
  const issues: Record<string, ValueIssue> = {}
  for (const field of fields) {
    const value = values[field.key]
    if (isFileType(field.type)) {
      const picked = files[field.key] ?? []
      const accept = effectiveAccept(field)
      const wrong = picked.find((item) => !matchesAccept(item.file, accept))
      const huge = picked.find((item) => item.file.size > REGISTRATION_MAX_FILE_BYTES)
      if (wrong) issues[field.key] = { code: 'accept', name: wrong.file.name }
      else if (huge) issues[field.key] = { code: 'file_size', name: huge.file.name }
      else if (field.required && picked.length === 0 && !(keptFiles[field.key] > 0)) issues[field.key] = { code: 'required' }
      continue
    }
    if (isBlank(value)) {
      if (field.required) issues[field.key] = { code: 'required' }
      continue
    }
    const text = typeof value === 'string' ? value.trim() : ''
    if (field.type === 'email' && !EMAIL_PATTERN.test(text)) issues[field.key] = { code: 'email' }
    else if (field.type === 'phone' && (text.replace(/\D/g, '').length < 7 || !/^\+?[\d\s()-]+$/.test(text))) issues[field.key] = { code: 'phone' }
    else if (field.type === 'number' && !Number.isFinite(Number(text))) issues[field.key] = { code: 'number' }
    else if ((field.type === 'select' || field.type === 'radio') && !field.options.includes(String(value))) issues[field.key] = { code: 'option' }
    else if (field.type === 'multi_select' && Array.isArray(value) && value.some((item) => !field.options.includes(item))) issues[field.key] = { code: 'option' }
  }
  return issues
}

/** Over 100 MB in total? (each file is checked by validateValues). */
export function exceedsTotal(files: FormFiles) {
  return totalBytes(files) > REGISTRATION_MAX_TOTAL_BYTES
}

/** "2026-11-15T15:00" (picker, local time) → "2026-11-15T15:00:00+05:00", so the moment is unambiguous. */
function withOffset(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]))
  if (Number.isNaN(date.getTime())) return value
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  return `${value}:00${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
}

/** Non-file answers in the shape the backend stores; empty optional answers are left out. */
export function answersPayload(fields: RegistrationField[], values: FormValues) {
  const data: Record<string, unknown> = {}
  for (const field of fields) {
    if (isFileType(field.type)) continue
    const value = values[field.key]
    if (field.type === 'checkbox') {
      data[field.key] = value === true
      continue
    }
    if (isBlank(value)) continue
    if (field.type === 'multi_select') data[field.key] = Array.isArray(value) ? value : [value]
    else if (field.type === 'datetime') data[field.key] = withOffset(String(value))
    else if (field.type === 'number') data[field.key] = Number(String(value).trim())
    else if (field.type === 'password') data[field.key] = String(value)
    else if (hasOptions(field.type)) data[field.key] = String(value)
    else data[field.key] = String(value).trim()
  }
  return data
}

/** JSON when no file is chosen, otherwise multipart: `data` + one `file__{key}` part per file. */
export function buildSubmissionBody(fields: RegistrationField[], values: FormValues, files: FormFiles): RegistrationSubmissionBody {
  const data = answersPayload(fields, values)
  const withFiles = fields.filter((field) => isFileType(field.type) && (files[field.key]?.length ?? 0) > 0)
  if (withFiles.length === 0) return data
  const form = new FormData()
  form.append('data', JSON.stringify(data))
  for (const field of withFiles) {
    for (const item of files[field.key] ?? []) form.append(`file__${field.key}`, item.file, item.file.name)
  }
  return form
}
