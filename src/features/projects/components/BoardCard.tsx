import { Link } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { Badge } from '../../../shared/ui/badge'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import type { BoardRecord } from '../../../shared/api/services/projects.service'
import { Avatar } from './Avatar'
import { formatRelativeDate } from '../lib/format'

type BoardCardProps = {
  board: BoardRecord
  onEdit: (board: BoardRecord) => void
  onArchive: (board: BoardRecord) => void
  canManage?: boolean
}

export function BoardCard({ board, onEdit, onArchive, canManage = true }: BoardCardProps) {
  const { t } = useLocale()
  const boardUrl = `/projects/${board.project_id}?board=${board.id}`

  return (
    <div data-slot="card" className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition hover:border-[var(--border-hover)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
      {/* Gradient accent top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_72%)]" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        {/* Board icon + info */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--blue-dim)] text-blue-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="9" rx="2" />
              <rect x="14" y="3" width="7" height="5" rx="2" />
              <rect x="14" y="12" width="7" height="9" rx="2" />
              <rect x="3" y="16" width="7" height="5" rx="2" />
            </svg>
          </div>
          <div className="min-w-0">
            {board.is_archived ? (
              <p className="truncate text-sm font-semibold text-[var(--muted)]">{board.name}</p>
            ) : (
              <Link
                to={boardUrl}
                className="block truncate text-sm font-semibold text-[var(--foreground)] hover:text-white transition-colors"
              >
                {board.name}
              </Link>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          {board.is_archived && (
            <Badge variant="secondary" size="sm" dot>
              {t('projects.archived', 'Archived')}
            </Badge>
          )}
          {canManage ? (
            <ActionsMenu
              label={t('projects.board_actions', 'Board actions')}
              items={[
                ...(board.is_archived ? [] : [{ label: t('projects.edit_board_action', 'Edit board'), onSelect: () => onEdit(board) }]),
                {
                  label: board.is_archived
                    ? t('projects.already_archived', 'Already archived')
                    : t('projects.archive_board_action', 'Archive board'),
                  tone: 'danger' as const,
                  onSelect: () => !board.is_archived && onArchive(board),
                },
              ]}
            />
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <div className="flex items-center gap-2">
          <Avatar
            name={board.created_by.name}
            surname={board.created_by.surname}
            imageUrl={board.created_by.profile_image}
            size="xs"
          />
          <span className="text-[10px] text-[var(--muted)]">
            {board.created_by.name} {board.created_by.surname}
          </span>
        </div>
        <span className="text-[10px] text-[var(--muted)]">
          {formatRelativeDate(board.updated_at)}
        </span>
      </div>

      {/* Navigate overlay for non-archived */}
      {!board.is_archived && (
        <Link
          to={boardUrl}
          className="absolute inset-0"
          aria-label={t('projects.open_board', 'Open {name}', { name: board.name })}
          tabIndex={-1}
        />
      )}
    </div>
  )
}
