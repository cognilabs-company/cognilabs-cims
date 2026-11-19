import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { CalendarUser } from '../../../shared/api/services/calendar.service'
import { cn } from '../../../shared/lib/cn'
import { MemberAvatar } from '../../../shared/ui/member-avatar'

/** Search + checklist of employees: who may open this access. */
export function PeoplePicker({ people, selected, onChange, loading }: {
  people: CalendarUser[]
  selected: number[]
  onChange: (next: number[]) => void
  loading?: boolean
}) {
  const { t } = useLocale()
  const [query, setQuery] = useState('')
  const chosen = useMemo(() => new Set(selected), [selected])
  const needle = query.trim().toLowerCase()
  const list = people
    .filter((person) => !needle || person.name.toLowerCase().includes(needle) || (person.detail ?? '').toLowerCase().includes(needle))
    // People with access first, then by name.
    .sort((a, b) => Number(chosen.has(b.id)) - Number(chosen.has(a.id)) || a.name.localeCompare(b.name))

  function toggle(id: number) {
    onChange(chosen.has(id) ? selected.filter((value) => value !== id) : [...selected, id])
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--border)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
        <Search size={14} className="shrink-0 text-[var(--caption)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('vault.people.search', 'Search people')}
          aria-label={t('vault.people.search', 'Search people')}
          className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-[var(--foreground)] placeholder:text-[var(--caption)] focus:outline-none"
        />
        <span className="shrink-0 text-[11.5px] font-semibold text-[var(--muted)] tabular-nums">{t('vault.people.selected', '{{count}} selected', { count: selected.length })}</span>
      </div>
      <ul className="max-h-[232px] overflow-y-auto p-1">
        {loading && !people.length ? (
          <li className="px-3 py-3 text-[12.5px] text-[var(--muted)]">{t('common.loading', 'Loading...')}</li>
        ) : !list.length ? (
          <li className="px-3 py-3 text-[12.5px] text-[var(--muted)]">{t('vault.people.none', 'Nobody found')}</li>
        ) : list.map((person) => {
          const on = chosen.has(person.id)
          return (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => toggle(person.id)}
                aria-pressed={on}
                className={cn('flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left transition-colors', on ? 'bg-[var(--blue-dim)]' : 'hover:bg-[var(--muted-surface)]')}
              >
                <MemberAvatar name={person.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[var(--foreground)]">{person.name}</span>
                  {person.detail ? <span className="block truncate text-[11.5px] text-[var(--muted)]">{person.detail}</span> : null}
                </span>
                <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition-colors', on ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--control-border)] bg-[var(--surface)]')}>
                  {on ? <Check size={13} strokeWidth={3} /> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
