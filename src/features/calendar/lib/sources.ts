import { calendarService, type CalendarApiEvent } from '../../../shared/api/services/calendar.service'
import { crmService } from '../../../shared/api/services/crm.service'
import { getCustomerDisplayName } from '../../../shared/lib/customer-display'
import { projectsService } from '../../../shared/api/services/projects.service'
import { updateTrackingService } from '../../../shared/api/services/updateTracking.service'
import { dayOf } from './dates'
import { KIND_COLORS, type CalEvent } from './types'

/** Manual events and CRM recalls / meetings from the backend calendar, in a day range. */
export async function loadCalendarEvents(params: { dateFrom: string; dateTo: string; userId: number | null; search: string }): Promise<CalEvent[]> {
  const items = await calendarService.events({ dateFrom: params.dateFrom, dateTo: params.dateTo, userId: params.userId, search: params.search })
  return items.map(apiToEvent)
}

export function apiToEvent(item: CalendarApiEvent): CalEvent {
  const kind = item.source === 'crm' ? (item.eventType === 'meeting' ? 'meeting' : 'recall') : 'manual'
  return {
    id: `${kind}:${item.occurrenceId ?? `${item.id}:${item.startAt}`}`,
    kind,
    title: item.title,
    start: item.allDay ? dayOf(item.startAt) : item.startAt,
    end: item.allDay ? null : item.endAt,
    allDay: item.allDay,
    color: KIND_COLORS[kind],
    note: item.description,
    customerId: item.customerId ?? undefined,
    status: item.status,
    phone: item.phone,
    assignedName: item.assignedName,
    baseId: item.id,
    recurrence: item.recurrence,
    recurrenceUntil: item.recurrenceUntil,
    reminder: item.reminderEnabled,
    participantIds: item.participantIds,
    participantNames: item.participantNames,
    createdById: item.createdById,
    createdByName: item.createdByName,
  }
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

let customerNames: Promise<Map<number, string>> | null = null

/** CRM customer id → readable name (loaded once per visit; the calendar API may send names encrypted). */
export function loadCustomerNames() {
  if (!customerNames) {
    customerNames = crmService.dashboardWithAllCustomers()
      .then((dashboard) => new Map((dashboard.customers ?? []).map((customer) => [customer.id, getCustomerDisplayName(customer, '')])))
      .catch(() => {
        customerNames = null
        return new Map<number, string>()
      })
  }
  return customerNames
}
