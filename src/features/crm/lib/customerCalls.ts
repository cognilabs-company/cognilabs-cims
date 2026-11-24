import { normalizePhone, telephonyService, type TelephonyCall } from '../../../shared/api/services/telephony.service'
import { telephonyQualityService, type CallQuality } from '../../../shared/api/services/telephonyQuality.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useAuth } from '../../auth/hooks/useAuth'
import { useCrmScope } from './crmScope'

/** Enough of the number to match "+998 90 123 45 67", "998901234567" and "901234567" alike. */
export const phoneTailOf = (value: string | null | undefined) => normalizePhone(value).slice(-9)

/** How many of the newest talked calls get their AI grade loaded (one request each). */
const GRADED = 3

export type CustomerCalls = {
  /** False when the user may not see calls or the number is too short to search by. */
  allowed: boolean
  loading: boolean
  /** Every CIMS call with this customer (answered, missed, recorded or not), newest first. */
  calls: TelephonyCall[]
  /** AI grade by call id: a CallQuality, or null when that call was not graded (yet). Only the newest talked calls are looked up. */
  quality: Map<number, CallQuality | null>
}

/**
 * CIMS phone calls with one customer, plus the AI grade of the newest conversations.
 * /telephony/calls has no customer filter: search by the number, then keep this customer's calls.
 */
export function useCustomerCalls(customerId: number, phoneNumber: string): CustomerCalls {
  const { can } = useAuth()
  const { kind } = useCrmScope()
  const source = kind === 'outbound' ? 'crm_outbound' : 'crm'
  const tail = phoneTailOf(phoneNumber)
  const allowed = can('calls') && tail.length >= 7

  const query = useAsyncData(async () => {
    const response = await telephonyService.calls({ page: 1, page_size: 100, search: tail })
    const calls = response.items
      .filter((call) => phoneTailOf(call.phone_number) === tail || (call.customer_id === customerId && (call.crm_source ?? source) === source))
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

    // A missing grade (404 → null) or a failed request must not hide the calls themselves.
    const talked = calls.filter((call) => call.talk_seconds > 0 && call.has_recording).slice(0, GRADED)
    const grades = await Promise.allSettled(talked.map((call) => telephonyQualityService.call(call.id)))
    const quality = new Map<number, CallQuality | null>()
    talked.forEach((call, index) => {
      const grade = grades[index]
      quality.set(call.id, grade.status === 'fulfilled' && grade.value?.status === 'completed' ? grade.value : null)
    })
    return { calls, quality }
  }, [tail, customerId, source], { enabled: allowed })

  return {
    allowed,
    loading: allowed && (query.isLoading || query.isIdle) && !query.data,
    calls: query.data?.calls ?? [],
    quality: query.data?.quality ?? new Map(),
  }
}
