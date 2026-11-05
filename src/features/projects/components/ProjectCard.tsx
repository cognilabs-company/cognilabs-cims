import { Link } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { Badge } from '../../../shared/ui/badge'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { Skeleton } from '../../../shared/ui/skeleton'
import { toneByIndex, tonePill } from '../../../shared/ui/tone'
import { cn } from '../../../shared/lib/cn'
import type { ProjectRecord } from '../../../shared/api/services/projects.service'
import { Avatar, AvatarGroup } from './Avatar'
import { formatProjectDateTime, formatRelativeDate, isDueDateOverdue } from '../lib/format'
import { resolveMediaUrl } from '../../../shared/lib/media-url'

type ProjectCardProps = {
  project: ProjectRecord
  onEdit: (project: ProjectRecord) => void
  onDelete: (project: ProjectRecord) => void
  canManage?: boolean
}

export function ProjectCard({ project, onEdit, onDelete, canManage = true }: ProjectCardProps) {
  const { t } = useLocale()
  const boardCount = project.boards_count ?? 0
  const memberCount = (project.members ?? []).length
  const isDeadlineOverdue = project.deadline ? isDueDateOverdue(project.deadline) : false
  const placeholderTone = toneByIndex(project.project_name.charCodeAt(0) || 0)

  return (
    <div data-slot="card" className="group relative flex flex-col overflow-hidden rounded-[24px] bg-[var(--card)] transition-shadow duration-150 hover:shadow-[var(--elev-md)]">
      {/* Image / placeholder */}
      <div className="relative h-36 w-full overflow-hidden bg-[var(--muted-surface)]">
        {project.image ? (
          <img
            src={resolveMediaUrl(project.image) ?? project.image}
            alt={project.project_name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className={cn(
                'grid h-16 w-16 place-items-center rounded-[18px] text-2xl font-bold tracking-[-0.02em]',
                tonePill(placeholderTone),
              )}
            >
              {project.project_name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Actions menu overlay */}
        {canManage ? (
          <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <ActionsMenu
              label={t('projects.project_actions', 'Project actions')}
              className="bg-[var(--surface)] shadow-[var(--elev-sm)]"
              items={[
                { label: t('projects.edit_project_action', 'Edit project'), onSelect: () => onEdit(project) },
                { label: t('projects.delete_project_action', 'Delete project'), tone: 'danger', onSelect: () => onDelete(project) },
              ]}
            />
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-[18px]">
        {/* Title */}
        <div>
          <Link
            to={`/projects/${project.id}`}
            className="line-clamp-1 text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] transition-colors hover:text-[var(--primary)]"
          >
            {project.project_name}
          </Link>
        </div>

        {/* URL badge */}
        {typeof project.project_url === 'string' && project.project_url && (
          <a
            href={project.project_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 truncate text-[11.5px] font-medium text-[var(--blue-text)] transition-colors hover:text-[var(--primary-hover)]"
            onClick={(e) => e.stopPropagation()}
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 8h6M8 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">{project.project_url.replace(/^https?:\/\//, '')}</span>
          </a>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" size="sm">
            {boardCount === 1
              ? t('projects.board_count_short', '{count} board', { count: boardCount })
              : t('projects.board_count_plural', '{count} boards', { count: boardCount })}
          </Badge>
          {memberCount > 0 && (
            <Badge variant="secondary" size="sm">
              {memberCount === 1
                ? t('projects.member_count_short', '{count} member', { count: memberCount })
                : t('projects.member_count_plural', '{count} members', { count: memberCount })}
            </Badge>
          )}
          {project.team ? <Badge variant="blue" size="sm">{project.team.name}</Badge> : null}
          {project.deadline ? (
            <Badge variant={isDeadlineOverdue ? 'danger' : 'secondary'} size="sm">
              {formatProjectDateTime(project.deadline)}
            </Badge>
          ) : null}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
          <div className="flex min-w-0 items-center gap-2">
            {project.created_by ? (
              <>
                <Avatar
                  name={project.created_by.name}
                  surname={project.created_by.surname}
                  imageUrl={project.created_by.profile_image}
                  size="xs"
                  title={t('projects.created_by_person', 'Created by {name}', {
                    name: `${project.created_by.name} ${project.created_by.surname}`,
                  })}
                />
                <span className="max-w-[100px] truncate text-[11.5px] text-[var(--muted)]">
                  {project.created_by.name}
                </span>
              </>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {(project.members ?? []).length > 0 && (
              <AvatarGroup users={project.members} max={3} size="xs" />
            )}
            <span className="text-[11.5px] text-[var(--caption)]">
              {project.updated_at ? formatRelativeDate(project.updated_at) : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Click-to-navigate overlay (behind content) */}
      <Link
        to={`/projects/${project.id}`}
        className="absolute inset-0"
        aria-label={t('projects.open_project', 'Open {name}', { name: project.project_name })}
        tabIndex={-1}
      />
    </div>
  )
}

/** Skeleton placeholder while loading */
export function ProjectCardSkeleton() {
  return (
    <div data-slot="card" className="flex flex-col overflow-hidden rounded-[24px] bg-[var(--card)]">
      <Skeleton className="h-36 rounded-none" />
      <div className="flex flex-col gap-3 p-[18px]">
        <Skeleton rounded="full" className="h-4 w-3/4" />
        <Skeleton rounded="full" className="h-3 w-full" />
        <Skeleton rounded="full" className="h-3 w-2/3" />
        <div className="mt-1 flex gap-2">
          <Skeleton rounded="full" className="h-5 w-16" />
          <Skeleton rounded="full" className="h-5 w-20" />
        </div>
      </div>
    </div>
  )
}
