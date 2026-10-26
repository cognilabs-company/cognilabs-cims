import { request } from '../http'
import type { CreateResponse, FinanceItem, SuccessResponse } from '../types'

export type FinanceDashboardResponse = {
  finances: FinanceItem[]
  permissions: string[]
  donation_balance: number
  exchange_rate: string
  balances: {
    card1_balance: string
    card2_balance: string
    card3_balance: string
    total_balance: string
    potential_balance: string
  }
  member_data: Array<{
    name: string
    surname: string
    cards: Array<{ card_number: string; is_primary: boolean }>
  }>
}

export const financeService = {
  dashboard() {
    return request<FinanceDashboardResponse>({
      path: '/finance/dashboard',
    })
  },

  list(page = 1, perPage = 10) {
    return request<{
      finances: FinanceItem[]
      total_count: number
      page: number
      per_page: number
      total_pages: number
      has_next: boolean
      has_prev: boolean
    }>({
      path: '/finance/',
      query: { page, per_page: perPage },
    })
  },

  create(payload: Record<string, unknown>) {
    return request<CreateResponse>({
      path: '/finance/create',
      method: 'POST',
      body: payload,
    })
  },

  update(financeId: number, payload: Record<string, unknown>) {
    return request<SuccessResponse>({
      path: `/finance/${financeId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  delete(financeId: number) {
    return request<SuccessResponse>({
      path: `/finance/${financeId}`,
      method: 'DELETE',
    })
  },

  detail(financeId: number) {
    return request<FinanceItem>({
      path: `/finance/${financeId}`,
    })
  },

  exchangeRate() {
    return request<{ usd_to_uzs: number; formatted_rate: string }>({
      path: '/finance/exchange-rate',
    })
  },

  liveExchangeRate() {
    return request<{ usd_to_uzs: number; formatted_rate: string }>({
      path: '/finance/exchange-rate/live',
    })
  },

  syncExchangeRate() {
    return request<SuccessResponse>({
      path: '/finance/exchange-rate/sync',
      method: 'POST',
    })
  },

  advancedStats(params?: {
    date_from?: string
    date_to?: string
    card?: string
    transaction_status?: string
  }) {
    return request<{
      total_income: number
      total_outcome: number
      total_donation: number
      net_profit: number
      transaction_count: number
      income_count: number
      outcome_count: number
    }>({
      path: '/finance/advanced/stats',
      query: params,
    })
  },
}
