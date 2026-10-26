import { request } from '../http'
import type {
  AdditionalNote,
  ConversionRateResponse,
  CreateResponse,
  CustomerPeriodReportResponse,
  CustomerStatsResponse,
  CustomerStatusSummaryResponse,
  CustomerSummary,
  DynamicStatusOption,
  ManagementStatusCreatePayload,
  ManagementStatusRecord,
  ManagementStatusUpdatePayload,
  SalesDashboardChartsResponse,
  SalesStatsResponse,
  SuccessResponse,
} from '../types'

export type SalesManagerSummary = {
  id: number
  email: string
  name: string
  surname: string
}

export type SalesManagerLead = {
  id: number
  full_name: string
  phone_number: string | null
  platform: string | null
  username: string | null
  status: string
  status_name: string
  priority_level: 'low' | 'medium' | 'high' | 'critical' | null
  priority_score: number | null
  importance_score: number | null
  industry: string | null
  is_archived: boolean
  created_at: string
  assigned_at: string | null
}

export type SalesManagerLeadsResponse = {
  sales_manager: SalesManagerSummary
  total_count: number
  page: number
  limit: number
  items: SalesManagerLead[]
}

export type SalesManagerStatusStat = {
  status: string
  count: number
}

export type SalesManagerStatsSummary = {
  total_assigned: number
  active_leads: number
  archived_leads: number
  counted_leads: number
}

export type SalesManagerStatsResponse = {
  sales_manager: SalesManagerSummary
  summary: SalesManagerStatsSummary
  status_stats: SalesManagerStatusStat[]
}

export type SalesManagerLeadsParams = {
  page?: number
  limit?: number
  search?: string
  status?: string
  priority_level?: 'low' | 'medium' | 'high' | 'critical'
  include_archived?: boolean
}

export type CustomerPeriodReportParams = {
  period?: string
  search?: string
  status_filter?: string
  from_date?: string
  to_date?: string
}

export type CrmDashboardResponse = {
  customers: CustomerSummary[]
  page?: number
  page_size?: number
  total_items?: number
  total_pages?: number
  status_stats: Record<string, number>
  status_dict: Record<string, number>
  status_percentages: Record<string, number>
  status_choices: Array<{ value: string; label: string }>
  permissions: string[]
  selected_status: string
  period_stats: Record<string, number>
}

type CrmDashboardParams = {
  search?: string
  status_filter?: string
  show_all?: boolean
  page?: number
  page_size?: number
}

export function createCrmCustomerService(basePath: string) {
  const service = {
    latest(limit = 50) {
      return request<CustomerSummary[]>({
        path: `${basePath}/customers/latest`,
        query: { limit },
      })
    },

    dashboard(params?: CrmDashboardParams) {
      return request<CrmDashboardResponse>({
        path: `${basePath}/dashboard`,
        query: params,
      })
    },

    async dashboardWithAllCustomers(pageSize = 50) {
      const firstPage = await service.dashboard({ page: 1, page_size: pageSize, show_all: true })
      const totalPages = Math.max(firstPage.total_pages ?? 1, 1)

      if (totalPages <= 1) {
        return firstPage
      }

      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          service.dashboard({ page: index + 2, page_size: pageSize, show_all: true }),
        ),
      )

      return {
        ...firstPage,
        customers: [
          ...firstPage.customers,
          ...remainingPages.flatMap((page) => page.customers),
        ],
        page: 1,
      }
    },

    detail(customerId: number) {
      return request<CustomerSummary>({
        path: `${basePath}/detail/${customerId}`,
      })
    },

    dynamicStatuses() {
      return request<DynamicStatusOption[]>({
        path: `${basePath}/statuses/dynamic`,
      })
    },

    createCustomer(formData: FormData) {
      return request<CreateResponse>({
        path: `${basePath}/customers`,
        method: 'POST',
        body: formData,
      })
    },

    updateCustomer(customerId: number, formData: FormData) {
      return request<SuccessResponse>({
        path: `${basePath}/customers/${customerId}`,
        method: 'PATCH',
        body: formData,
      })
    },

    patchCustomer(customerId: number, formData: FormData) {
      return request<SuccessResponse>({
        path: `${basePath}/customers/${customerId}`,
        method: 'PATCH',
        body: formData,
      })
    },

    deleteCustomer(customerId: number) {
      return request<SuccessResponse>({
        path: `${basePath}/customers/${customerId}`,
        method: 'DELETE',
      })
    },

    bulkDelete(customerIds: number[]) {
      return request<SuccessResponse>({
        path: `${basePath}/customers/bulk-delete`,
        method: 'DELETE',
        body: { customer_ids: customerIds },
      })
    },

    getAdditionalNotes(customerId: number) {
      return request<{ customer_id: number; items: AdditionalNote[]; total_count: number }>({
        path: `${basePath}/customers/${customerId}/notes`,
      })
    },

    addAdditionalNote(customerId: number, note: string) {
      return request<AdditionalNote>({
        path: `${basePath}/customers/${customerId}/notes`,
        method: 'POST',
        body: { note },
      })
    },

    updateAdditionalNote(customerId: number, noteId: number, note: string) {
      return request<AdditionalNote>({
        path: `${basePath}/customers/${customerId}/notes/${noteId}`,
        method: 'PATCH',
        body: { note },
      })
    },

    deleteAdditionalNote(customerId: number, noteId: number) {
      return request<SuccessResponse>({
        path: `${basePath}/customers/${customerId}/notes/${noteId}`,
        method: 'DELETE',
      })
    },

    filterByStatus(status: string) {
      return request<CustomerSummary[]>({
        path: `${basePath}/customers/filter/status`,
        query: { status_filter: status },
      })
    },

    filterByPlatform(platform: string) {
      return request<CustomerSummary[]>({
        path: `${basePath}/customers/filter/platform`,
        query: { platform },
      })
    },

    summaryStats() {
      return request<CustomerStatsResponse>({
        path: `${basePath}/stats`,
      })
    },

    basicView(limit = 50) {
      return request<CustomerSummary[]>({
        path: `${basePath}/customers/bazakorinish`,
        query: { limit },
      })
    },

    periodStats() {
      return request<unknown>({
        path: `${basePath}/stats/period`,
      })
    },

    filterByDate(start_date: string, end_date?: string) {
      return request<CustomerSummary[]>({
        path: `${basePath}/customers/filter/date`,
        query: { start_date, end_date },
      })
    },

    statusSummary() {
      return request<CustomerStatusSummaryResponse>({
        path: `${basePath}/customers/stats/summary`,
      })
    },

    periodReport(params?: CustomerPeriodReportParams) {
      return request<CustomerPeriodReportResponse>({
        path: `${basePath}/customers/report/period`,
        query: params,
      })
    },

    archivedCustomers() {
      return request<CustomerSummary[]>({
        path: `${basePath}/customers/archived`,
      })
    },

    restoreCustomer(customerId: number) {
      return request<SuccessResponse>({
        path: `${basePath}/customers/${customerId}/restore`,
        method: 'POST',
      })
    },

    hardDeleteCustomer(customerId: number) {
      return request<SuccessResponse>({
        path: `${basePath}/customers/${customerId}/hard`,
        method: 'DELETE',
      })
    },

    bulkHardDelete(customerIds: number[]) {
      return request<SuccessResponse>({
        path: `${basePath}/customers/bulk-hard-delete`,
        method: 'DELETE',
        body: { customer_ids: customerIds },
      })
    },
  }

  return service
}

export const crmService = {
  ...createCrmCustomerService('/crm'),

  salesStats(customer_type?: string) {
    return request<SalesStatsResponse>({
      path: '/sales/stats',
      query: { customer_type },
    })
  },

  detailedSales(days = 30, customer_type?: string) {
    return request<unknown>({
      path: '/sales/detailed',
      query: { days, customer_type },
    })
  },

  salesDashboardCharts(params?: {
    days?: number
    customer_type?: string
    platform_limit?: number
  }) {
    return request<SalesDashboardChartsResponse>({
      path: '/sales/dashboard/charts',
      query: params,
    })
  },

  conversionRate() {
    return request<ConversionRateResponse>({
      path: '/crm/conversion-rate',
    })
  },

  internationalLeads(limit = 50) {
    return request<unknown[]>({
      path: '/sales/international',
      query: { limit },
    })
  },

  salesManagers() {
    return request<unknown>({
      path: '/crm/sales-managers',
    })
  },

  assignSalesManager(payload: Record<string, unknown>) {
    return request<SuccessResponse>({
      path: '/crm/assign-sales-manager',
      method: 'POST',
      body: payload,
    })
  },

  customerSalesManager(customerId: number) {
    return request<unknown>({
      path: `/crm/customer/${customerId}/sales-manager`,
    })
  },

  salesManagerStats(params?: {
    from_date?: string
    to_date?: string
    sales_manager_id?: number
  }) {
    return request<unknown>({
      path: '/crm/sales-manager/stats',
      query: params,
    })
  },

  salesManagerCustomers(salesManagerId: number, params?: SalesManagerLeadsParams) {
    return request<SalesManagerLeadsResponse>({
      path: `/crm/sales-managers/${salesManagerId}/customers`,
      query: params as Record<string, string | number | boolean | undefined | null>,
    })
  },

  salesManagerCustomerStats(salesManagerId: number, params?: { include_archived?: boolean }) {
    return request<SalesManagerStatsResponse>({
      path: `/crm/sales-managers/${salesManagerId}/stats`,
      query: params,
    })
  },

  myCustomers(params?: SalesManagerLeadsParams) {
    return request<SalesManagerLeadsResponse>({
      path: '/crm/my-customers',
      query: params as Record<string, string | number | boolean | undefined | null>,
    })
  },

  myCustomerStats(params?: { include_archived?: boolean }) {
    return request<SalesManagerStatsResponse>({
      path: '/crm/my-customers/stats',
      query: params,
    })
  },
}

const outboundCrmBasePath = '/outbound-crm'
const outboundCrmCustomers = createCrmCustomerService(outboundCrmBasePath)

export const outboundCrmService = {
  ...outboundCrmCustomers,

  listStatuses() {
    return request<ManagementStatusRecord[]>({
      path: `${outboundCrmBasePath}/statuses`,
    })
  },

  // Outbound CRM has no /statuses/dynamic endpoint, so active statuses are mapped to the same shape.
  async dynamicStatuses(): Promise<DynamicStatusOption[]> {
    const statuses = await outboundCrmService.listStatuses()

    return statuses
      .filter((status) => status.is_active)
      .sort((left, right) => left.order - right.order)
      .map((status) => ({
        value: status.name,
        label: status.display_name || status.name,
        color: status.color || '#64748b',
        order: status.order,
      }))
  },

  createStatus(payload: ManagementStatusCreatePayload) {
    return request<ManagementStatusRecord>({
      path: `${outboundCrmBasePath}/statuses`,
      method: 'POST',
      body: payload,
    })
  },

  updateStatus(statusId: number, payload: Partial<ManagementStatusUpdatePayload>) {
    return request<ManagementStatusRecord>({
      path: `${outboundCrmBasePath}/statuses/${statusId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteStatus(statusId: number) {
    return request<SuccessResponse>({
      path: `${outboundCrmBasePath}/statuses/${statusId}`,
      method: 'DELETE',
    })
  },
}

export type CrmCustomerService = ReturnType<typeof createCrmCustomerService>
