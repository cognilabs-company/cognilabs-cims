import { request } from '../http'

export type AuditLogItem = {
  id: number
  created_at: string
  actor_user_id: number | null
  actor_email: string | null
  actor_name: string | null
  module: string | null
  table_name: string | null
  entity_type: string | null
  entity_id: string | null
  action: string | null
  summary: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  changed_fields: string[] | null
  request_id: string | null
  ip_address: string | null
  user_agent: string | null
  is_system_action: boolean
}

export type AuditLogListResponse = {
  items: AuditLogItem[]
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

export type AuditLogsParams = {
  module?: string
  table_name?: string
  entity_type?: string
  entity_id?: string
  action?: string
  actor_user_id?: number
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export const auditService = {
  list(params?: AuditLogsParams) {
    return request<AuditLogListResponse>({
      path: '/audit/logs',
      query: params,
    })
  },

  detail(logId: number) {
    return request<AuditLogItem>({
      path: `/audit/logs/${logId}`,
    })
  },

  byEntity(entityType: string, entityId: string, page = 1, pageSize = 50) {
    return request<AuditLogListResponse>({
      path: `/audit/logs/entity/${entityType}/${entityId}`,
      query: { page, page_size: pageSize },
    })
  },

  byUser(userId: number, page = 1, pageSize = 50) {
    return request<AuditLogListResponse>({
      path: `/audit/logs/user/${userId}`,
      query: { page, page_size: pageSize },
    })
  },
}
