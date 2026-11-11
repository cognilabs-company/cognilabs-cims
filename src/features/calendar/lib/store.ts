import { calendarService } from '../../../shared/api/services/calendar.service'
import { joinDayTime } from './dates'

/** Own events kept in this browser before the calendar API existed. */
type LocalEvent = {
  id: string
  title: string
  date: string
  allDay: boolean
  startTime: string
  endTime: string
  note: string
}

const keyOf = (userId: number | string) => `cims.calendar.v1.${userId}.events`

function readLocal(userId: number | string): LocalEvent[] {
  try {
    const items = JSON.parse(localStorage.getItem(keyOf(userId)) ?? '[]') as LocalEvent[]
    return Array.isArray(items) ? items.filter((item) => item && item.title && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) : []
  } catch {
    return []
  }
}

export function hasLocalEvents(userId: number | string) {
  return readLocal(userId).length > 0
}

/**
 * Moves the user's old browser-only events to the server (once). Each one is removed locally only
 * after the server has it, so nothing is lost if the connection drops halfway.
 */
export async function migrateLocalEvents(userId: number | string) {
  let moved = 0
  let failed = 0
  for (const item of readLocal(userId)) {
    try {
      await calendarService.create({
        title: item.title.slice(0, 300),
        description: item.note?.trim() || null,
        start_at: joinDayTime(item.date, item.allDay ? '00:00' : item.startTime),
        end_at: item.allDay ? null : joinDayTime(item.date, item.endTime || item.startTime),
        all_day: item.allDay,
        reminder_enabled: false,
        recurrence: 'none',
        recurrence_until: null,
        participant_ids: [],
      })
      moved += 1
      try {
        const rest = readLocal(userId).filter((entry) => entry.id !== item.id)
        if (rest.length) localStorage.setItem(keyOf(userId), JSON.stringify(rest))
        else localStorage.removeItem(keyOf(userId))
      } catch { /* storage blocked — the server copy is what counts */ }
    } catch (error) {
      if ((error as { status?: number } | null)?.status === 403) break
      failed += 1
    }
  }
  return { moved, failed }
}
