import { getApiErrorMessage, isNotFoundError } from '../../../shared/lib/api-error'

type Translate = (key: string, fallback: string) => string

export function getCustomerUnavailableTitle(t: Translate) {
  return t('customers.errors.unavailable.title', 'Customer not found or not assigned to you')
}

export function getCustomerUnavailableMessage(t: Translate) {
  return t(
    'customers.errors.unavailable.description',
    'This customer does not exist or is no longer assigned to you.',
  )
}

export function getCustomerActionErrorMessage(error: unknown, t: Translate) {
  return isNotFoundError(error) ? getCustomerUnavailableMessage(t) : getApiErrorMessage(error)
}
