import { projectsService, type CardRecord, type UserSummary } from '../../../shared/api/services/projects.service'

/* "Tasklar har bir etapda qancha turgani": built only from what the backend already returns per card
   (status_history[], completed_at, completion_duration_seconds, current_status_duration_seconds).
   No extra endpoint — every board of every visible project is read once and grouped here. */

export type TimedTask = {
  id: number
  title: string
  projectId: number
  projectName: string
  boardName: string
  column: string
  assignees: UserSummary[]
  createdAt: string | null
  completedAt: string | null
  /** Seconds from creation to Done; null while the task is open. */
  completionSeconds: number | null
  currentStatusSeconds: number | null
  /** Seconds spent per stage (column name), summed over every visit. */
  stages: Array<{ name: string; seconds: number; open: boolean }>
}

export type DeveloperTiming = {
  user: UserSummary
  done: number
  open: number
  avgDoneSeconds: number | null
  medianDoneSeconds: number | null
  /** Average seconds this developer's tasks spend in each stage. */
  stageAvg: Record<string, number>
  /** The open task that has been sitting in its current stage the longest. */
  stuck: TimedTask | null
}

export type StageTiming = { name: string; order: number; avgSeconds: number; medianSeconds: number; tasks: number; openNow: number }

const DONE_RE = /\b(done|completed?|finished|closed)\b|bajarildi|tugadi|tayyor|yakunlan|готово|выполнен|заверш/i

export function isDoneColumn(name: string | null | undefined) {
  return Boolean(name && DONE_RE.test(name))
}

const stageKey = (name: string) => name.trim().toLowerCase()

/** Backend timestamps are UTC without a zone ("2026-11-20T05:00:00"); read those as UTC, not browser-local. */
export function parseUtc(value: string | null | undefined) {
  if (!value) return Number.NaN
  return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) || !value.includes('T') ? value : `${value}Z`)
}

function secondsBetween(from: string | null, to: string | null, now: number) {
  if (!from) return null
  const start = parseUtc(from)
  const end = to ? parseUtc(to) : now
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 1000) : null
}

export function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null)

function toTimedTask(card: CardRecord, column: string, projectId: number, projectName: string, boardName: string, now: number): TimedTask {
  const stageMap = new Map<string, { name: string; seconds: number; open: boolean }>()
  for (const entry of card.status_history) {
    const name = entry.column_name?.trim()
    if (!name) continue
    const seconds = entry.duration_seconds ?? secondsBetween(entry.started_at, entry.ended_at, now) ?? 0
    const key = stageKey(name)
    const current = stageMap.get(key) ?? { name, seconds: 0, open: false }
    current.seconds += Math.max(0, seconds)
    current.open = current.open || !entry.ended_at
    stageMap.set(key, current)
  }
  const done = isDoneColumn(column) || Boolean(card.completed_at)
  const completedAt = card.completed_at ?? null
  const completionSeconds = done
    ? card.completion_duration_seconds ?? secondsBetween(card.created_at || null, completedAt, now)
    : null
  const assignees = card.assignees.length > 0 ? card.assignees : card.assignee ? [card.assignee] : []
  return {
    id: card.id,
    title: card.title,
    projectId,
    projectName,
    boardName,
    column,
    assignees,
    createdAt: card.created_at || null,
    completedAt,
    completionSeconds: completionSeconds !== null && completionSeconds >= 0 ? completionSeconds : null,
    currentStatusSeconds: card.current_status_duration_seconds ?? [...stageMap.values()].find((stage) => stage.open)?.seconds ?? null,
    stages: [...stageMap.values()],
  }
}

/** Runs `worker` over `items` with at most `limit` requests in flight. */
async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = []
  let next = 0
  async function lane() {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  return results
}

export type TaskTimingData = { tasks: TimedTask[]; stageOrder: string[]; failedBoards: number }

export async function loadTaskTiming(): Promise<TaskTimingData> {
  const now = Date.now()
  const { projects } = await projectsService.listProjects()
  const boardRefs = (await pool(projects, 4, async (project) => {
    try {
      const { boards } = await projectsService.listBoards(project.id)
      return (boards ?? []).filter((board) => !board.is_archived).map((board) => ({ board, project }))
    } catch {
      return []
    }
  })).flat()

  let failedBoards = 0
  const orderVotes = new Map<string, { name: string; orders: number[] }>()
  const tasks = (await pool(boardRefs, 4, async ({ board, project }) => {
    try {
      const detail = await projectsService.getBoard(board.id)
      return detail.columns.flatMap((column) => {
        const key = stageKey(column.name)
        const vote = orderVotes.get(key) ?? { name: column.name, orders: [] }
        vote.orders.push(column.order)
        orderVotes.set(key, vote)
        return column.cards.map((card) => toTimedTask(card, column.name, project.id, project.project_name, board.name, now))
      })
    } catch {
      failedBoards += 1
      return []
    }
  })).flat()

  const stageOrder = [...orderVotes.values()]
    .map((vote) => ({ name: vote.name, order: average(vote.orders) ?? 0 }))
    .sort((a, b) => a.order - b.order)
    .map((stage) => stage.name)

  return { tasks, stageOrder, failedBoards }
}

export type TimingPeriod = 30 | 90 | 0

/** Done tasks are counted by `completed_at` inside the period (0 = all time); open tasks are always current. */
export function summarizeTiming(data: TaskTimingData, period: TimingPeriod, now = Date.now()) {
  const from = period ? now - period * 86_400_000 : 0
  const inPeriod = (task: TimedTask) => {
    if (task.completionSeconds === null) return true
    const at = parseUtc(task.completedAt)
    return !period || (Number.isFinite(at) && at >= from)
  }
  const tasks = data.tasks.filter(inPeriod)

  const stageBuckets = new Map<string, { name: string; values: number[]; openNow: number }>()
  for (const task of tasks) {
    for (const stage of task.stages) {
      const key = stageKey(stage.name)
      const bucket = stageBuckets.get(key) ?? { name: stage.name, values: [], openNow: 0 }
      if (!isDoneColumn(stage.name)) bucket.values.push(stage.seconds)
      if (stage.open) bucket.openNow += 1
      stageBuckets.set(key, bucket)
    }
  }
  const orderOf = (name: string) => {
    const index = data.stageOrder.findIndex((stage) => stageKey(stage) === stageKey(name))
    return index === -1 ? 999 : index
  }
  const stages: StageTiming[] = [...stageBuckets.values()]
    .filter((bucket) => !isDoneColumn(bucket.name))
    .map((bucket) => ({
      name: bucket.name,
      order: orderOf(bucket.name),
      avgSeconds: average(bucket.values) ?? 0,
      medianSeconds: median(bucket.values) ?? 0,
      tasks: bucket.values.length,
      openNow: bucket.openNow,
    }))
    .sort((a, b) => a.order - b.order)

  const developers = new Map<number, { user: UserSummary; done: number[]; open: TimedTask[]; stages: Map<string, number[]> }>()
  for (const task of tasks) {
    for (const user of task.assignees) {
      const row = developers.get(user.id) ?? { user, done: [] as number[], open: [] as TimedTask[], stages: new Map<string, number[]>() }
      if (task.completionSeconds !== null) row.done.push(task.completionSeconds)
      else row.open.push(task)
      for (const stage of task.stages) {
        if (isDoneColumn(stage.name)) continue
        const list = row.stages.get(stage.name) ?? []
        list.push(stage.seconds)
        row.stages.set(stage.name, list)
      }
      developers.set(user.id, row)
    }
  }
  const developerRows: DeveloperTiming[] = [...developers.values()]
    .map((row) => ({
      user: row.user,
      done: row.done.length,
      open: row.open.length,
      avgDoneSeconds: average(row.done),
      medianDoneSeconds: median(row.done),
      stageAvg: Object.fromEntries([...row.stages.entries()].map(([name, values]) => [name, average(values) ?? 0])),
      stuck: row.open.reduce<TimedTask | null>((worst, task) => ((task.currentStatusSeconds ?? 0) > (worst?.currentStatusSeconds ?? -1) ? task : worst), null),
    }))
    .sort((a, b) => b.done - a.done || (a.avgDoneSeconds ?? Infinity) - (b.avgDoneSeconds ?? Infinity))

  const done = tasks.filter((task) => task.completionSeconds !== null)
  return {
    tasks,
    stages,
    developers: developerRows,
    doneCount: done.length,
    openCount: tasks.length - done.length,
    avgDoneSeconds: average(done.map((task) => task.completionSeconds as number)),
    medianDoneSeconds: median(done.map((task) => task.completionSeconds as number)),
  }
}

export function formatSeconds(seconds: number | null | undefined, units: { d: string; h: string; m: string }) {
  if (seconds === null || seconds === undefined || seconds < 0) return '—'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days) return hours ? `${days}${units.d} ${hours}${units.h}` : `${days}${units.d}`
  if (hours) return minutes ? `${hours}${units.h} ${minutes}${units.m}` : `${hours}${units.h}`
  return `${minutes}${units.m}`
}
