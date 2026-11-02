import { useState, useMemo } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { Input } from '../../../shared/ui/input'
import { IconButton } from '../../../shared/ui/icon-button'
import type { UserSummary } from '../../../shared/api/services/projects.service'
import { Avatar } from './Avatar'

type MemberSelectorProps = {
  allUsers: UserSummary[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

export function MemberSelector({ allUsers, selectedIds, onChange, disabled }: MemberSelectorProps) {
  const { t } = useLocale()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return allUsers
    return allUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.surname.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
  }, [allUsers, search])

  const selectedUsers = useMemo(
    () => allUsers.filter((u) => selectedIds.includes(u.id)),
    [allUsers, selectedIds],
  )

  function toggle(userId: number) {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId))
    } else {
      onChange([...selectedIds, userId])
    }
  }

  function remove(userId: number) {
    onChange(selectedIds.filter((id) => id !== userId))
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Selected chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] py-1 pr-2 pl-1.5 text-[11.5px] font-semibold text-[var(--foreground)]"
            >
              <Avatar name={user.name} surname={user.surname} imageUrl={user.profile_image} size="xs" />
              {user.name} {user.surname}
              {!disabled && (
                <IconButton
                  label={t('projects.remove_member', 'Remove {name}', { name: user.name })}
                  onClick={() => remove(user.id)}
                  className="h-5 w-5 rounded-full"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </IconButton>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('projects.search_members', 'Search members...')}
        disabled={disabled}
      />

      {/* User list */}
      <div className="max-h-48 overflow-y-auto rounded-[18px] bg-[var(--muted-surface)] p-1.5">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">
            {t('projects.no_users_found', 'No users found')}
          </p>
        ) : (
          filtered.map((user) => {
            const selected = selectedIds.includes(user.id)
            return (
              <button
                key={user.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(user.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--surface)]',
                  selected && 'bg-[var(--blue-dim)] hover:bg-[var(--blue-dim)]',
                )}
              >
                <Avatar name={user.name} surname={user.surname} imageUrl={user.profile_image} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--foreground)]">
                    {user.name} {user.surname}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
                </div>
                {selected && (
                  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-current text-[var(--primary)]" aria-hidden="true">
                    <path d="M6.6 11.2 3.4 8a.75.75 0 1 0-1.06 1.06l3.73 3.73a.75.75 0 0 0 1.06 0l6.53-6.53A.75.75 0 1 0 12.64 5.2L6.6 11.2Z" />
                  </svg>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
