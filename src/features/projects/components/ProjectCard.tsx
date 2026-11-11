import { Link } from 'react-router-dom'
import { CalendarClock, LayoutGrid, Link2 } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { ActionsMenu, type ActionsMenuItem } from '../../../shared/ui/actions-menu'
import { Skeleton } from '../../../shared/ui/skeleton'
import { cn } from '../../../shared/lib/cn'
import type { ProjectRecord } from '../../../shared/api/services/projects.service'
import { AvatarGroup } from './Avatar'
import { formatProjectDateTime, formatRelativeDate, isDueDateOverdue, isDueDateSoon } from '../lib/format'
import { projectHue, projectInitial } from '../lib/projectLook'
import { resolveMediaUrl } from '../../../shared/lib/media-url'

type ProjectCardProps = {
  project: ProjectRecord
  onEdit: (project: ProjectRecord) => void
  onDelete: (project: ProjectRecord) => void
  /** RBAC projects.edit — shows "Edit project". */
  canEdit?: boolean
  /** RBAC projects.delete — shows "Delete project". */
  canDelete?: boolean
}

export function ProjectCard({ project, onEdit, onDelete, canEdit = true, canDelete = true }: ProjectCardProps) {
  const { t } = useLocale()
  const projectActions: ActionsMenuItem[] = [
    ...(canEdit ? [{ label: t('projects.edit_project_action', 'Edit project'), onSelect: () => onEdit(project) }] : []),
    ...(canDelete ? [{ label: t('projects.delete_project_action', 'Delete project'), tone: 'danger' as const, onSelect: () => onDelete(project) }] : []),
  ]
  const boardCount = project.boards_count ?? 0
  const members = project.members ?? []
  const overdue = project.deadline ? isDueDateOverdue(project.deadline) : false
  const soon = !overdue && project.deadline ? isDueDateSoon(project.deadline) : false
  const hue = projectHue(project.project_name)

  return (
    <div data-slot="card" className="group relative flex flex-col gap-3 rounded-[18px] bg-[var(--card)] p-4 ring-1 ring-[var(--border)] transition-shadow duration-150 hover:shadow-[var(--elev-md)]">
      <div className="flex items-start gap-3">
        {project.image ? (
          <img src={resolveMediaUrl(project.image) ?? project.image} alt="" className="h-11 w-11 shrink-0 rounded-[12px] object-cover" />
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[17px] font-bold" style={{ background: `hsl(${hue} 85% 94%)`, color: `hsl(${hue} 60% 38%)` }}>
            {projectInitial(project.project_name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link to={`/projects/${project.id}`} className="relative z-10 line-clamp-1 text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] hover:text-[var(--primary)]">
            {project.project_name}
          </Link>
          {project.project_description ? (
            <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[var(--muted)]">{project.project_description}</p>
          ) : typeof project.project_url === 'string' && project.project_url ? (
            <a href={project.project_url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="relative z-10 mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] text-[var(--blue-text)] hover:underline">
              <Link2 size={12} className="shrink-0" /><span className="truncate">{project.project_url.replace(/^https?:\/\//, '')}</span>
            </a>
          ) : null}
        </div>
        {projectActions.length > 0 ? (
          <div className="relative z-10 shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <ActionsMenu label={t('projects.project_actions', 'Project actions')} items={projectActions} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="inline-flex items-center gap-1 rounded-[7px] bg-[var(--muted-surface)] px-2 py-1 font-medium text-[var(--muted-strong)]">
          <LayoutGrid size={12} />
          {boardCount === 1
            ? t('projects.board_count_short', '{count} board', { count: boardCount })
            : t('projects.board_count_plural', '{count} boards', { count: boardCount })}
        </span>
        {project.team ? <span className="max-w-[150px] truncate rounded-[7px] bg-[var(--blue-dim)] px-2 py-1 font-medium text-[var(--blue-text)]">{project.team.name}</span> : null}
        {project.deadline ? (
          <span className={cn('inline-flex items-center gap-1 rounded-[7px] px-2 py-1 font-medium tabular-nums', overdue ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : soon ? 'bg-[var(--warning-dim)] text-[var(--warning-text)]' : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]')}>
            <CalendarClock size={12} />{formatProjectDateTime(project.deadline)}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
        {members.length > 0 ? <AvatarGroup users={members} max={4} size="xs" /> : <span />}
        <span className="text-[11.5px] text-[var(--caption)]">{project.updated_at ? formatRelativeDate(project.updated_at) : ''}</span>
      </div>

      <Link to={`/projects/${project.id}`} className="absolute inset-0" aria-label={t('projects.open_project', 'Open {name}', { name: project.project_name })} tabIndex={-1} />
    </div>
  )
}

/** Skeleton placeholder while loading */
export function ProjectCardSkeleton() {
  return (
    <div data-slot="card" className="flex flex-col overflow-hidden rounded-[18px] bg-[var(--card)] ring-1 ring-[var(--border)]">
      <div className="flex flex-col gap-3 p-4">
        <Skeleton rounded="xl" className="h-11 w-11" />
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
