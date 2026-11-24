import { useMemo, useState, type ReactNode } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { canReadManagedProjects } from '../../../shared/lib/permissions'
import { cn } from '../../../shared/lib/cn'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { ErrorStateBlock, EmptyStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { formatSeconds, isDoneColumn, loadTaskTiming, summarizeTiming, type TimingPeriod } from '../lib/taskTiming'

const PERIODS: TimingPeriod[] = [30, 90, 0]
const TASK_LIMIT = 60

function Section({ title, caption, children, action }: { title: string; caption?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</h2>
          {caption ? <span className="text-[12.5px] text-[var(--muted)]">{caption}</span> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function Tile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-[12px] font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-1.5 text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)]">{value}</p>
      {caption ? <p className="mt-1 text-[12px] text-[var(--muted)]">{caption}</p> : null}
    </div>
  )
}

/** /salary → "Task timing": how long each task sits in every stage, and how fast each developer gets tasks to Done. */
export function TaskTimingPage() {
  const { t } = useLocale()
  const { user } = useAuth()
  const isCeo = canReadManagedProjects(user)
  const [period, setPeriod] = useState<TimingPeriod>(30)
  const [developerId, setDeveloperId] = useState<string>(isCeo ? '' : String(user?.id ?? ''))
  const [search, setSearch] = useState('')

  const query = useAsyncData(() => loadTaskTiming(), [])
  const units = useMemo(() => ({
    d: t('kpi.timing.unit.d', 'd'),
    h: t('kpi.timing.unit.h', 'h'),
    m: t('kpi.timing.unit.m', 'm'),
  }), [t])
  const fmt = (seconds: number | null | undefined) => formatSeconds(seconds, units)

  const summary = useMemo(() => {
    if (!query.data) return null
    const scoped = developerId
      ? { ...query.data, tasks: query.data.tasks.filter((task) => task.assignees.some((assignee) => String(assignee.id) === developerId)) }
      : query.data
    return summarizeTiming(scoped, period)
  }, [query.data, period, developerId])

  const developerOptions = useMemo(() => {
    const seen = new Map<number, string>()
    for (const task of query.data?.tasks ?? []) for (const assignee of task.assignees) seen.set(assignee.id, `${assignee.name} ${assignee.surname}`.trim())
    const options = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => ({ value: String(id), label: name }))
    return isCeo ? [{ value: '', label: t('kpi.timing.all_developers', 'All developers') }, ...options] : options.filter((option) => option.value === String(user?.id))
  }, [query.data, isCeo, user?.id, t])

  const stageColumns = useMemo(() => (summary?.stages ?? []).map((stage) => stage.name), [summary])

  const visibleTasks = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (summary?.tasks ?? [])
      .filter((task) => !needle || `${task.title} ${task.projectName} ${task.column}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aOpen = a.completionSeconds === null ? 1 : 0
        const bOpen = b.completionSeconds === null ? 1 : 0
        if (aOpen !== bOpen) return bOpen - aOpen
        return aOpen ? (b.currentStatusSeconds ?? 0) - (a.currentStatusSeconds ?? 0) : (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
      })
  }, [summary, search])

  if (query.status === 'loading' || query.status === 'idle') {
    return <LoadingStateBlock eyebrow={t('kpi.timing.title', 'Task timing')} title={t('kpi.timing.loading', 'Reading every board…')} />
  }
  if (query.status === 'error' || !summary) {
    return <ErrorStateBlock eyebrow={t('kpi.timing.title', 'Task timing')} title={t('kpi.timing.error', 'Could not load tasks')} actionLabel={t('kpi.timing.retry', 'Try again')} onAction={() => void query.refetch()} />
  }

  const periodLabel = (value: TimingPeriod) => (value ? t('kpi.timing.days', '{{count}} days', { count: value }) : t('kpi.timing.all_time', 'All time'))
  const maxStage = Math.max(1, ...summary.stages.map((stage) => stage.avgSeconds))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">{t('kpi.timing.title', 'Task timing')}</h1>
          <p className="text-[13px] text-[var(--muted)]">{t('kpi.timing.subtitle', 'Time in each stage and time to Done, from the task status history')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {developerOptions.length > 1 || isCeo ? (
            <div className="w-56">
              <SelectField value={developerId} onValueChange={setDeveloperId} options={developerOptions} searchable className="min-h-9 rounded-[11px] px-3 text-[13px]" />
            </div>
          ) : null}
          <div role="radiogroup" aria-label={t('kpi.timing.period', 'Period')} className="flex gap-1 rounded-[12px] bg-[var(--surface)] p-1 ring-1 ring-[var(--border)]">
            {PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={period === value}
                onClick={() => setPeriod(value)}
                className={cn('min-h-8 rounded-[9px] px-3 text-[12.5px] font-medium transition-colors', period === value ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]')}
              >
                {periodLabel(value)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t('kpi.timing.tile.done', 'Tasks done')} value={String(summary.doneCount)} caption={periodLabel(period)} />
        <Tile label={t('kpi.timing.tile.avg_done', 'Average time to Done')} value={fmt(summary.avgDoneSeconds)} caption={t('kpi.timing.tile.avg_done_caption', 'from creation to the Done column')} />
        <Tile label={t('kpi.timing.tile.median_done', 'Median time to Done')} value={fmt(summary.medianDoneSeconds)} caption={t('kpi.timing.tile.median_caption', 'half of the tasks are faster')} />
        <Tile label={t('kpi.timing.tile.open', 'Open tasks')} value={String(summary.openCount)} caption={t('kpi.timing.tile.open_caption', 'not in Done yet')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Section title={t('kpi.timing.stages.title', 'Average time per stage')} caption={t('kpi.timing.stages.caption', 'all tasks of the period')}>
          {summary.stages.length === 0 ? (
            <EmptyStateBlock eyebrow={t('kpi.timing.title', 'Task timing')} title={t('kpi.timing.empty_history', 'No status history yet')} />
          ) : (
            <ul className="flex flex-col gap-3">
              {summary.stages.map((stage) => (
                <li key={stage.name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]">
                  <span className="truncate font-medium text-[var(--foreground)]" title={stage.name}>{stage.name}</span>
                  <span className="block h-2.5 overflow-hidden rounded-full bg-[var(--muted-surface)]">
                    <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(3, (stage.avgSeconds / maxStage) * 100)}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-[var(--muted-strong)]">
                    {fmt(stage.avgSeconds)}
                    <span className="ml-2 text-[11.5px] text-[var(--muted)]">{t('kpi.timing.stages.now', '{{count}} now', { count: stage.openNow })}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-[var(--muted)]">{t('kpi.timing.stages.footer', 'If a task returned to a stage, all its visits are added up. Median is shown in the developer table.')}</p>
        </Section>

        <Section title={t('kpi.timing.devs.title', 'Developers')} caption={t('kpi.timing.devs.caption', 'average time from creation to Done')}>
          {summary.developers.length === 0 ? (
            <EmptyStateBlock eyebrow={t('kpi.timing.title', 'Task timing')} title={t('kpi.timing.empty', 'No tasks in this period')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="text-right text-[11.5px] text-[var(--muted)]">
                    <th className="py-2 pr-3 text-left font-medium">{t('kpi.timing.devs.developer', 'Developer')}</th>
                    <th className="px-2 font-medium">{t('kpi.timing.devs.done', 'Done')}</th>
                    <th className="px-2 font-medium">{t('kpi.timing.devs.avg', 'Average')}</th>
                    <th className="px-2 font-medium">{t('kpi.timing.devs.median', 'Median')}</th>
                    <th className="px-2 font-medium">{t('kpi.timing.devs.open', 'Open')}</th>
                    <th className="pl-2 text-left font-medium">{t('kpi.timing.devs.stuck', 'Longest in one stage now')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {summary.developers.map((row) => (
                    <tr key={row.user.id} className="border-t border-[var(--border-subtle)] text-right">
                      <td className="py-2.5 pr-3 text-left font-semibold text-[var(--foreground)]">{`${row.user.name} ${row.user.surname}`.trim()}</td>
                      <td className="px-2">{row.done}</td>
                      <td className="px-2 font-semibold text-[var(--foreground)]">{fmt(row.avgDoneSeconds)}</td>
                      <td className="px-2">{fmt(row.medianDoneSeconds)}</td>
                      <td className="px-2">{row.open}</td>
                      <td className="max-w-[16rem] truncate pl-2 text-left text-[var(--muted-strong)]" title={row.stuck?.title}>
                        {row.stuck ? `${fmt(row.stuck.currentStatusSeconds)} · ${row.stuck.column} · ${row.stuck.title}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <Section
        title={t('kpi.timing.tasks.title', 'Each task by stage')}
        caption={t('kpi.timing.tasks.caption', '{{count}} tasks · open ones first, longest in the current stage on top', { count: visibleTasks.length })}
        action={<div className="w-64"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('kpi.timing.tasks.search', 'Search task or project')} /></div>}
      >
        {visibleTasks.length === 0 ? (
          <EmptyStateBlock eyebrow={t('kpi.timing.title', 'Task timing')} title={t('kpi.timing.empty', 'No tasks in this period')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ minWidth: `${560 + stageColumns.length * 96}px` }}>
              <thead>
                <tr className="text-right text-[11.5px] text-[var(--muted)]">
                  <th className="py-2 pr-3 text-left font-medium">{t('kpi.timing.tasks.task', 'Task')}</th>
                  <th className="px-2 text-left font-medium">{t('kpi.timing.tasks.now', 'Now')}</th>
                  {stageColumns.map((name) => <th key={name} className="px-2 font-medium">{name}</th>)}
                  <th className="pl-2 font-medium">{t('kpi.timing.tasks.total', 'To Done')}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {visibleTasks.slice(0, TASK_LIMIT).map((task) => {
                  const byStage = new Map(task.stages.map((stage) => [stage.name.trim().toLowerCase(), stage]))
                  const done = task.completionSeconds !== null
                  return (
                    <tr key={`${task.projectId}-${task.id}`} className="border-t border-[var(--border-subtle)] text-right align-top">
                      <td className="max-w-[20rem] py-2.5 pr-3 text-left">
                        <p className="truncate font-semibold text-[var(--foreground)]" title={task.title}>{task.title}</p>
                        <p className="truncate text-[11.5px] text-[var(--muted)]">
                          {task.projectName} · {task.assignees.map((assignee) => assignee.name).join(', ') || t('kpi.timing.tasks.no_assignee', 'no assignee')}
                        </p>
                      </td>
                      <td className="px-2 text-left">
                        <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium', done || isDoneColumn(task.column) ? 'bg-[var(--muted-surface)] text-[var(--muted-strong)]' : 'bg-[var(--accent-soft)] text-[var(--foreground)]')}>
                          {task.column}{!done && task.currentStatusSeconds !== null ? ` · ${fmt(task.currentStatusSeconds)}` : ''}
                        </span>
                      </td>
                      {stageColumns.map((name) => {
                        const stage = byStage.get(name.trim().toLowerCase())
                        return (
                          <td key={name} className={cn('px-2', stage?.open ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted-strong)]')}>
                            {stage ? fmt(stage.seconds) : <span className="text-[var(--muted)]">·</span>}
                          </td>
                        )
                      })}
                      <td className="pl-2 font-semibold text-[var(--foreground)]">{done ? fmt(task.completionSeconds) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {visibleTasks.length > TASK_LIMIT ? (
          <p className="text-[12px] text-[var(--muted)]">{t('kpi.timing.tasks.more', 'Showing {{shown}} of {{count}}. Narrow it down with the search or the developer filter.', { shown: TASK_LIMIT, count: visibleTasks.length })}</p>
        ) : null}
        {query.data && query.data.failedBoards > 0 ? (
          <p className="text-[12px] text-[var(--danger-text)]">{t('kpi.timing.failed_boards', '{{count}} boards could not be read and are not counted.', { count: query.data.failedBoards })}</p>
        ) : null}
      </Section>
    </div>
  )
}
