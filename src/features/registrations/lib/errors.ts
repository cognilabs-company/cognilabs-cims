import type { ApiResponseError } from '../../../shared/api/types'

/* Reading `{ message, status, details }` errors thrown by request(). */

type Loose = Record<string, unknown>
const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null && !Array.isArray(value)

export function errorStatus(error: unknown): number | null {
  const status = (error as Partial<ApiResponseError> | null | undefined)?.status
  return typeof status === 'number' ? status : null
}

/** A network failure (fetch threw) rather than an HTTP answer. */
export function isNetworkError(error: unknown) {
  return errorStatus(error) === null
}

function detailOf(error: unknown): unknown {
  const details = (error as Partial<ApiResponseError> | null | undefined)?.details
  return isObject(details) ? details.detail ?? details.errors ?? details.message ?? details.error : details
}

function messageOf(entry: unknown): string {
  if (typeof entry === 'string') return entry
  if (isObject(entry)) {
    const text = entry.msg ?? entry.message ?? entry.detail ?? entry.error
    return typeof text === 'string' ? text.replace(/^Value error,\s*/i, '') : ''
  }
  return ''
}

/** The backend's own human message (string `detail`, or the first validation message), if any. */
export function serverMessage(error: unknown): string {
  const detail = detailOf(error)
  if (typeof detail === 'string') return detail.trim()
  if (Array.isArray(detail)) return messageOf(detail[0]).trim()
  if (isObject(detail)) {
    const direct = messageOf(detail)
    if (direct) return direct.trim()
    const first = Object.values(detail)[0]
    return (Array.isArray(first) ? messageOf(first[0]) : messageOf(first)).trim()
  }
  const details = (error as Partial<ApiResponseError> | null | undefined)?.details
  return typeof details === 'string' && details.length < 300 ? details.trim() : ''
}

type LocatedMessage = { path: Array<string | number>; message: string }

/** Every `{loc, msg}` / `{field: msg}` / `{errors: {field: msg}}` entry as a path + message. */
function locatedMessages(error: unknown): LocatedMessage[] {
  const detail = detailOf(error)
  const result: LocatedMessage[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (isObject(entry) && Array.isArray(entry.loc)) {
          result.push({ path: entry.loc.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), message: messageOf(entry) })
        } else if (isObject(entry) && typeof (entry.field ?? entry.key) === 'string') {
          result.push({ path: [String(entry.field ?? entry.key)], message: messageOf(entry) })
        }
      }
      return
    }
    if (isObject(value)) {
      if (typeof (value.field ?? value.key) === 'string') {
        result.push({ path: [String(value.field ?? value.key)], message: messageOf(value) })
        return
      }
      // A plain `{message, code}` object is a general error, not a per-field map.
      if (messageOf(value)) return
      for (const nested of ['errors', 'fields', 'field_errors']) {
        if (isObject(value[nested]) || Array.isArray(value[nested])) {
          visit(value[nested])
          return
        }
      }
      for (const [key, message] of Object.entries(value)) {
        const text = Array.isArray(message) ? messageOf(message[0]) : messageOf(message)
        if (text) result.push({ path: [key], message: text })
      }
    }
  }
  visit(detail)
  return result
}

/** Public form: messages next to fields (`loc` ending in a field key, or `file__key`). */
export function fieldErrorsFromApi(error: unknown, keys: string[]): Record<string, string> {
  const known = new Set(keys)
  const result: Record<string, string> = {}
  for (const { path, message } of locatedMessages(error)) {
    for (let index = path.length - 1; index >= 0; index -= 1) {
      const part = String(path[index]).replace(/^file__/, '')
      if (known.has(part)) {
        if (!result[part]) result[part] = message
        break
      }
    }
  }
  return result
}

/** Builder: `loc: ["body", "fields", 3, "options"]` → field index 3; also title / slug / description. */
export function formErrorsFromApi(error: unknown): { fields: Record<number, string>; title?: string; slug?: string; description?: string } {
  const result: { fields: Record<number, string>; title?: string; slug?: string; description?: string } = { fields: {} }
  for (const { path, message } of locatedMessages(error)) {
    const at = path.indexOf('fields')
    if (at >= 0 && typeof path[at + 1] === 'number') {
      const index = path[at + 1] as number
      if (!result.fields[index]) result.fields[index] = message
      continue
    }
    const last = path[path.length - 1]
    if (last === 'title' || last === 'slug' || last === 'description') result[last] ??= message
  }
  return result
}
