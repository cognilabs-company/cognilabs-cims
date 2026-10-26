import { Link } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { Badge } from '../../../shared/ui/badge'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
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

  return (
    <div data-slot="card" className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_2px_8px_rgba(0,0,0,0.14)] transition-shadow hover:shadow-[0_8px_28px_rgba(0,0,0,0.24)] hover:border-[var(--border-hover)]">
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
              className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold"
              style={{
                background: `hsl(${project.project_name.charCodeAt(0) * 7 % 360}, 45%, 18%)`,
                color: `hsl(${project.project_name.charCodeAt(0) * 7 % 360}, 65%, 65%)`,
              }}
            >
              {project.project_name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--surface-elevated)]/60 to-transparent" />

        {/* Actions menu overlay */}
        {canManage ? (
          <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
            <ActionsMenu
              label={t('projects.project_actions', 'Project actions')}
              items={[
                { label: t('projects.edit_project_action', 'Edit project'), onSelect: () => onEdit(project) },
                { label: t('projects.delete_project_action', 'Delete project'), tone: 'danger', onSelect: () => onDelete(project) },
              ]}
            />
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Title */}
        <div>
          <Link
            to={`/projects/${project.id}`}
            className="text-sm font-semibold text-[var(--foreground)] hover:text-white transition-colors line-clamp-1"
          >
            {project.project_name}
          </Link>
        </div>

        {/* URL badge */}
        {project.project_url && (
          <a
            href={project.project_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 8h6M8 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">{project.project_url.replace(/^https?:\/\//, '')}</span>
          </a>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" size="sm">
            {boardCount === 1
              ? t('projects.board_count_short', '{count} board', { count: boardCount })
              : t('projects.board_count_plural', '{count} boards', { count: boardCount })}
          </Badge>
          {memberCount > 0 && (
            <Badge variant="outline" size="sm">
              {memberCount === 1
                ? t('projects.member_count_short', '{count} member', { count: memberCount })
                : t('projects.member_count_plural', '{count} members', { count: memberCount })}
            </Badge>
          )}
          {project.team ? <Badge variant="blue" size="sm">{project.team.name}</Badge> : null}
          {project.deadline ? (
            <Badge variant={isDeadlineOverdue ? 'danger' : 'outline'} size="sm">
              {formatProjectDateTime(project.deadline)}
            </Badge>
          ) : null}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
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
                <span className="text-[10px] text-[var(--muted)] truncate max-w-[100px]">
                  {project.created_by.name}
                </span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {(project.members ?? []).length > 0 && (
              <AvatarGroup users={project.members} max={3} size="xs" />
            )}
            <span className="text-[10px] text-[var(--muted)]">
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
    <div data-slot="card" className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
      <div className="h-36 animate-pulse bg-[var(--muted-surface)]" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded-lg bg-[var(--muted-surface)]" />
        <div className="h-3 w-full animate-pulse rounded-lg bg-[var(--muted-surface)]" />
        <div className="h-3 w-2/3 animate-pulse rounded-lg bg-[var(--muted-surface)]" />
        <div className="flex gap-2 mt-1">
          <div className="h-5 w-16 animate-pulse rounded-lg bg-[var(--muted-surface)]" />
          <div className="h-5 w-20 animate-pulse rounded-lg bg-[var(--muted-surface)]" />
        </div>
      </div>
    </div>
  )
}
