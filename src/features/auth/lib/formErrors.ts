import type { ApiResponseError } from '../../../shared/api/types'
import { translateCurrent } from '../../../shared/i18n/translations'

export type FieldErrors = Record<string, string>

type FastApiValidation = {
  detail?: Array<{
    loc?: Array<string | number>
    msg?: string
  }>
}

export function extractFieldErrors(error: unknown): FieldErrors {
  const details = (error as ApiResponseError | undefined)?.details as FastApiValidation | undefined
  const validationItems = details?.detail

  if (!Array.isArray(validationItems)) {
    return {}
  }

  return validationItems.reduce<FieldErrors>((acc, item) => {
    const fieldName = [...(item.loc ?? [])].reverse().find((part) => typeof part === 'string')

    if (fieldName && item.msg) {
      acc[fieldName] = item.msg
    }

    return acc
  }, {})
}

export function getErrorMessage(error: unknown, fallback = 'Request failed. Please try again.') {
  const apiError = error as ApiResponseError | undefined
  const details = apiError?.details as
    | string
    | {
        detail?: string | Array<{ msg?: string }>
      }
    | undefined

  if (typeof details === 'string' && details.trim()) {
    return details
  }

  if (details && typeof details === 'object' && typeof details.detail === 'string' && details.detail.trim()) {
    return details.detail
  }

  if (details && typeof details === 'object' && Array.isArray(details.detail) && details.detail.length > 0) {
    const messages = details.detail
      .map((item: { msg?: string }) => item.msg)
      .filter((message): message is string => Boolean(message))

    if (messages.length > 0) {
      return messages.join(', ')
    }
  }

  if (apiError?.message) {
    return apiError.message
  }

  return translateCurrent('common.request_failed', fallback)
}
