import { CheckCircleIcon, ClockCountdownIcon, WarningCircleIcon, XCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../app/hooks/useLocale'
import type { DeliveryStatus } from '../../shared/api/services/botRecipients'

type ApiError = { status?: number; details?: { detail?: unknown } | null }

export const apiStatusOf = (error: unknown) => (error as ApiError | null)?.status ?? 0

/** The readable part of a FastAPI error body (a string, { message }, or a 422 list). */
export function apiDetailText(error: unknown) {
  const detail = (error as ApiError | null)?.details?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const data = detail as { message?: unknown; detail?: unknown; error?: unknown }
    for (const value of [data.message, data.detail, data.error]) if (typeof value === 'string') return value
    return ''
  }
  if (Array.isArray(detail)) return (detail as Array<{ msg?: string }>).map((item) => item.msg).filter(Boolean).join(' · ')
  return ''
}

/** detail.status of a 422 Telegram setup error ("not_started", "blocked", …). */
export function telegramStatusOf(error: unknown) {
  const detail = (error as ApiError | null)?.details?.detail
  if (apiStatusOf(error) !== 422 || !detail || typeof detail !== 'object') return null
  const status = (detail as { status?: unknown }).status
  return typeof status === 'string' ? status : null
}

export const settingsCard = 'rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-5'

export function useDeliveryMeta() {
  const { t } = useLocale()
  return (value: DeliveryStatus) => {
    switch (value) {
      case 'ready': return { label: t('botrecipients.delivery.ready', 'Ready'), className: 'bg-[var(--success-dim)] text-[var(--success-text)]', Icon: CheckCircleIcon }
      case 'not_started': return { label: t('botrecipients.delivery.not_started', 'Bot not started'), className: 'bg-[var(--warning-dim)] text-[var(--warning-text)]', Icon: ClockCountdownIcon }
      case 'blocked': return { label: t('botrecipients.delivery.blocked', 'Bot blocked'), className: 'bg-[var(--danger-dim)] text-[var(--danger-text)]', Icon: XCircleIcon }
      case 'error': return { label: t('botrecipients.delivery.error', 'Error'), className: 'bg-[var(--danger-dim)] text-[var(--danger-text)]', Icon: WarningCircleIcon }
      default: return { label: t('botrecipients.delivery.unknown', 'Not checked yet'), className: 'bg-[var(--muted-surface)] text-[var(--muted-strong)]', Icon: ClockCountdownIcon }
    }
  }
}
