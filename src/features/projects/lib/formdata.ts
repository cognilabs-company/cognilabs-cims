/**
 * Build a FormData object for multipart/form-data requests.
 * Skips null, undefined, and empty-string values to avoid sending invalid
 * optional fields. Arrays are appended with the same key for each element.
 */
export function buildFormData(
  fields: Record<string, string | number | boolean | File | File[] | number[] | null | undefined>,
): FormData {
  const fd = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '') {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof File) {
          fd.append(key, item)
        } else if (typeof item === 'number') {
          fd.append(key, String(item))
        }
      }
      continue
    }

    if (value instanceof File) {
      fd.append(key, value)
      continue
    }

    fd.append(key, String(value))
  }

  return fd
}
