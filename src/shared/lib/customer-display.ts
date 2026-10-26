type CustomerIdentity = {
  id?: number | string | null
  full_name?: string | null
  fullName?: string | null
  displayName?: string | null
  name?: string | null
  surname?: string | null
  first_name?: string | null
  last_name?: string | null
  firstName?: string | null
  lastName?: string | null
  display_name?: string | null
  customer_name?: string | null
  customerName?: string | null
  contact_name?: string | null
  full?: string | null
  client_name?: string | null
  lead_name?: string | null
  user_name?: string | null
  fio?: string | null
  username?: string | null
  phone_number?: string | null
  phone?: string | null
  platform?: string | null
  platform_name?: string | null
  source_platform?: string | null
  social_platform?: string | null
  source?: string | null
  lead_source?: string | null
  channel?: string | null
  platforms?: Array<string | null> | null
  customer?: Record<string, unknown> | null
  client?: Record<string, unknown> | null
  lead?: Record<string, unknown> | null
  contact?: Record<string, unknown> | null
  profile?: Record<string, unknown> | null
  details?: Record<string, unknown> | null
} & Record<string, unknown>

function normalizeIdentityValue(value?: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  if (['none', 'null', 'undefined', '-'].includes(normalized.toLowerCase())) {
    return null
  }

  return normalized
}

function toTitleCaseLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function isPlaceholderName(value: string) {
  const normalized = value.trim().toLowerCase()

  return (
    ['customer', 'client', 'lead', 'unknown', 'mijoz'].includes(normalized) ||
    /^customer\s*#?\d+$/i.test(normalized) ||
    /^mijoz\s*#?\d+$/i.test(normalized) ||
    normalized.includes('aniqlashtirilmagan') ||
    normalized.includes("ismi so'rash kerak") ||
    normalized.includes("ismi so‘rash kerak") ||
    normalized.includes('ismi sorash kerak')
  )
}

function getSafeIdentityValue(value?: string | null) {
  const normalized = normalizeIdentityValue(value)

  if (!normalized || isProbablyEncryptedValue(normalized)) {
    return null
  }

  return normalized
}

function getMeaningfulIdentityValue(value?: string | null) {
  const normalized = getSafeIdentityValue(value)

  if (!normalized || isPlaceholderName(normalized)) {
    return null
  }

  return normalized
}

export function isProbablyEncryptedValue(value?: string | null) {
  const normalized = normalizeIdentityValue(value)

  if (!normalized) {
    return false
  }

  return /^gAAAAA[A-Za-z0-9_-]+$/.test(normalized) || (normalized.length > 48 && !normalized.includes(' '))
}

export function formatUsernameHandle(value?: string | null) {
  const normalized = normalizeIdentityValue(value)

  if (!normalized || isProbablyEncryptedValue(normalized)) {
    return null
  }

  return normalized.startsWith('@') ? normalized : `@${normalized}`
}

function getReadablePhone(value?: string | null) {
  return getSafeIdentityValue(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getNestedIdentityCandidates(customer: CustomerIdentity) {
  return [customer.customer, customer.client, customer.lead, customer.contact, customer.profile, customer.details].filter(isRecord)
}

function getNestedIdentityValue(customer: CustomerIdentity, keys: string[]) {
  for (const source of getNestedIdentityCandidates(customer)) {
    for (const key of keys) {
      const value = source[key]

      if (typeof value === 'string') {
        const safeValue = getSafeIdentityValue(value)

        if (safeValue) {
          return safeValue
        }
      }
    }
  }

  return null
}

function getComposedName(customer: CustomerIdentity) {
  const firstName =
    getMeaningfulIdentityValue(customer.name) ??
    getMeaningfulIdentityValue(customer.first_name) ??
    getMeaningfulIdentityValue(customer.firstName) ??
    getMeaningfulIdentityValue(getNestedIdentityValue(customer, ['name', 'first_name', 'firstName']))
  const lastName =
    getMeaningfulIdentityValue(customer.surname) ??
    getMeaningfulIdentityValue(customer.last_name) ??
    getMeaningfulIdentityValue(customer.lastName) ??
    getMeaningfulIdentityValue(getNestedIdentityValue(customer, ['surname', 'last_name', 'lastName']))

  const composedName = [firstName, lastName].filter(Boolean).join(' ').trim()
  return composedName || null
}

export function getCustomerPlatforms(customer: CustomerIdentity) {
  const directPlatforms = [
    customer.platform,
    customer.platform_name,
    customer.source_platform,
    customer.social_platform,
    customer.source,
    customer.lead_source,
    customer.channel,
  ]

  const arrayPlatforms = Array.isArray(customer.platforms) ? customer.platforms : []
  const allCandidates = [...directPlatforms, ...arrayPlatforms]

  return Array.from(
    new Set(
      allCandidates
        .map((value) => getSafeIdentityValue(value))
        .filter(Boolean)
        .map((value) => toTitleCaseLabel(String(value))),
    ),
  )
}

export function getCustomerDisplayPlatform(customer: CustomerIdentity) {
  return getCustomerPlatforms(customer).join(' / ') || null
}

export function getCustomerDisplayName(customer: CustomerIdentity, fallbackLabel = 'Customer') {
  const directNameCandidates = [
    customer.full_name,
    customer.fullName,
    customer.displayName,
    customer.display_name,
    customer.customerName,
    customer.customer_name,
    customer.contact_name,
    customer.full,
    customer.client_name,
    customer.lead_name,
    customer.user_name,
    customer.fio,
  ]
  const nestedNameCandidates = [
    getNestedIdentityValue(customer, [
      'full_name',
      'fullName',
      'display_name',
      'displayName',
      'customer_name',
      'customerName',
      'client_name',
      'lead_name',
      'user_name',
      'contact_name',
      'fio',
      'full',
    ]),
  ]
  const allNameCandidates = [...directNameCandidates, ...nestedNameCandidates]
  const preferredFullName = allNameCandidates.map((value) => getMeaningfulIdentityValue(value)).find(Boolean) ?? null
  const fallbackFullName = allNameCandidates.map((value) => getSafeIdentityValue(value)).find(Boolean) ?? null
  const composedName = getComposedName(customer)

  if (preferredFullName) {
    return preferredFullName
  }

  if (composedName) {
    return composedName
  }

  if (fallbackFullName) {
    return fallbackFullName
  }

  return (
    formatUsernameHandle(customer.username) ??
    getReadablePhone(customer.phone_number) ??
    getReadablePhone(customer.phone) ??
    `${fallbackLabel} #${customer.id ?? '?'}`
  )
}

export function getCustomerDisplayMeta(customer: CustomerIdentity) {
  const parts = [getCustomerDisplayPlatform(customer)]
  const username = formatUsernameHandle(customer.username)
  const phone = getReadablePhone(customer.phone_number) ?? getReadablePhone(customer.phone)
  const displayName = getCustomerDisplayName(customer)

  if (username && username !== displayName) {
    parts.push(username)
  } else if (phone && phone !== displayName) {
    parts.push(phone)
  }

  return parts.filter(Boolean).join(' | ')
}
