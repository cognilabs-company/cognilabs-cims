import type { PersonalEvent } from './types'

/**
 * Personal events. The backend has no calendar API yet, so they are kept in this browser
 * (per user) behind an async interface — when the API appears, only this file changes.
 */
export type PersonalEventStore = {
  list(): Promise<PersonalEvent[]>
  save(event: PersonalEvent): Promise<PersonalEvent>
  remove(id: string): Promise<void>
}

export function createLocalEventStore(userId: number | string): PersonalEventStore {
  const key = `cims.calendar.v1.${userId}.events`
  const read = (): PersonalEvent[] => {
    try { return JSON.parse(localStorage.getItem(key) ?? '[]') as PersonalEvent[] } catch { return [] }
  }
  const write = (items: PersonalEvent[]) => localStorage.setItem(key, JSON.stringify(items))
  return {
    async list() { return read() },
    async save(event) {
      write([event, ...read().filter((item) => item.id !== event.id)])
      return event
    },
    async remove(id) { write(read().filter((item) => item.id !== id)) },
  }
}
