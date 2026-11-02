import { Link } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
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
    <div data-slot="card" className="group relative flex flex-col gap-[18px] overflow-hidden rounded-[24px] bg-[var(--surface)] p-[22px] transition-colors hover:bg-[var(--card-hover)]">
      <div className="relative z-10 flex items-start justify-between gap-3">
        {/* Board icon + info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--blue-dim)] text-[var(--blue-text)]">
            <LayoutDashboard strokeWidth={1.8} className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            {board.is_archived ? (
              <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--muted)]">{board.name}</p>
            ) : (
              <Link
                to={boardUrl}
                className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] transition-colors hover:text-[var(--primary)]"
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
      <div className="relative z-10 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-[18px]">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            name={board.created_by.name}
            surname={board.created_by.surname}
            imageUrl={board.created_by.profile_image}
            size="xs"
          />
          <span className="truncate text-[12.5px] text-[var(--muted)]">
            {board.created_by.name} {board.created_by.surname}
          </span>
        </div>
        <span className="shrink-0 text-[12.5px] text-[var(--caption)]">
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
