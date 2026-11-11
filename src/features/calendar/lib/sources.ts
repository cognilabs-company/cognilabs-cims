import { crmService } from '../../../shared/api/services/crm.service'
import { projectsService } from '../../../shared/api/services/projects.service'
import { updateTrackingService } from '../../../shared/api/services/updateTracking.service'
import { getCustomerDisplayName } from '../../../shared/lib/customer-display'
import { joinDayTime } from './dates'
import { KIND_COLORS, type CalEvent, type PersonalEvent } from './types'

/** CRM customers with a callback time ("Qayta aloqa vaqti"). */
export async function loadCallbacks(): Promise<CalEvent[]> {
  const [dashboard, statuses] = await Promise.all([
    crmService.dashboardWithAllCustomers(),
    crmService.dynamicStatuses().catch(() => []),
  ])
  const labelOf = new Map(statuses.map((status) => [status.value, status.label]))
  return (dashboard.customers ?? [])
    .filter((customer) => customer.recall_time && !Number.isNaN(new Date(customer.recall_time).getTime()))
    .map((customer) => ({
      id: `callback:${customer.id}`,
      kind: 'callback' as const,
      title: getCustomerDisplayName(customer),
      start: customer.recall_time!,
      end: new Date(new Date(customer.recall_time!).getTime() + 30 * 60_000).toISOString(),
      allDay: false,
      color: KIND_COLORS.callback,
      customerId: customer.id,
      status: customer.status ? labelOf.get(customer.status) ?? customer.status : null,
      phone: customer.phone_number ?? null,
      note: (customer as { note?: string | null }).note ?? null,
    }))
}

/** The user's open project cards that have a deadline. */
export async function loadTasks(userId: number): Promise<CalEvent[]> {
  const { cards } = await projectsService.listUserOpenCards(userId)
  return cards
    .filter((card) => card.due_date && !card.completed_at && !Number.isNaN(new Date(card.due_date).getTime()))
    .map((card) => ({
      id: `task:${card.id}`,
      kind: 'task' as const,
      title: card.title,
      start: card.due_date!,
      end: null,
      allDay: false,
      color: KIND_COLORS.task,
      boardId: card.board_id,
      projectName: card.project_name,
      boardName: card.board_name,
      columnName: card.column_name,
      priority: card.priority ?? null,
    }))
}

/** Holidays and short working days in a date range (YYYY-MM-DD). */
export async function loadDayTypes(startDate: string, endDate: string, userId: number | null): Promise<CalEvent[]> {
  const items = await updateTrackingService.workdayOverrides({ startDate, endDate })
  return (Array.isArray(items) ? items : [])
    // Company-wide days, and personal ones only for the person they are for.
    .filter((item) => !item.member_id || item.member_id === userId || item.target_type === 'all')
    .map((item) => {
      const kind = item.day_type === 'holiday' ? 'holiday' as const : 'short_day' as const
      return {
        id: `${kind}:${item.id}`,
        kind,
        title: item.title,
        start: item.special_date.slice(0, 10),
        end: null,
        allDay: true,
        color: KIND_COLORS[kind],
        note: item.note ?? null,
        hours: item.workday_hours ?? null,
        member: item.member_name ?? null,
      }
    })
}

export function personalToEvent(item: PersonalEvent): CalEvent {
  return {
    id: `personal:${item.id}`,
    kind: 'personal',
    title: item.title,
    start: item.allDay ? item.date : joinDayTime(item.date, item.startTime),
    end: item.allDay ? null : joinDayTime(item.date, item.endTime || item.startTime),
    allDay: item.allDay,
    color: item.color || KIND_COLORS.personal,
    note: item.note || null,
    personalId: item.id,
  }
}
