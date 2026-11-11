import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarClock, LayoutGrid, Link2 } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { ActionsMenu, type ActionsMenuItem } from '../../../shared/ui/actions-menu'
import { Skeleton } from '../../../shared/ui/skeleton'
import { cn } from '../../../shared/lib/cn'
import type { ProjectRecord } from '../../../shared/api/services/projects.service'
import { AvatarGroup } from './Avatar'
import { formatProjectDateTime, formatRelativeDate, isDueDateOverdue, isDueDateSoon } from '../lib/format'
import { projectGradient, projectHue, projectInitial } from '../lib/projectLook'
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

  // Gentle 3D tilt that follows the pointer (CSS variables only — no re-render).
  function tilt(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width - 0.5
    const y = (event.clientY - box.top) / box.height - 0.5
    event.currentTarget.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`)
    event.currentTarget.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`)
  }
  function untilt(event: MouseEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty('--rx', '0deg')
    event.currentTarget.style.setProperty('--ry', '0deg')
  }

  return (
    <div
      data-slot="card"
      onMouseMove={tilt}
      onMouseLeave={untilt}
      className="pc-tilt kb-in group relative flex flex-col overflow-hidden rounded-[22px] bg-[var(--card)] ring-1 ring-[var(--border)]"
    >
      {/* Cover: the project image, or its colour with a soft isometric pattern and monogram */}
      <div className="relative h-[118px] w-full overflow-hidden" style={{ background: projectGradient(hue) }}>
        {project.image ? (
          <img
            src={resolveMediaUrl(project.image) ?? project.image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-0 opacity-30 transition-transform duration-700 group-hover:scale-110"
              style={{ background: 'repeating-linear-gradient(60deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 22px), repeating-linear-gradient(-60deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 22px)' }}
            />
            <span className="absolute bottom-3 left-4 grid h-12 w-12 place-items-center rounded-[14px] bg-white/20 text-[22px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-white/30 backdrop-blur-md transition-transform duration-500 group-hover:-translate-y-1">
              {projectInitial(project.project_name)}
            </span>
          </>
        )}
        {overdue || soon ? (
          <span className={cn('absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow', overdue ? 'bg-[#ef4444]' : 'bg-[#f59e0b]')}>
            <CalendarClock size={11} />{overdue ? t('projects.card.overdue', 'Overdue') : t('projects.card.soon', 'Due soon')}
          </span>
        ) : null}
        {projectActions.length > 0 ? (
          <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <ActionsMenu label={t('projects.project_actions', 'Project actions')} className="bg-[var(--surface)] shadow-[var(--elev-sm)]" items={projectActions} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="min-w-0">
          <Link to={`/projects/${project.id}`} className="relative z-10 line-clamp-1 text-[15.5px] font-bold tracking-[-0.02em] text-[var(--foreground)] transition-colors hover:text-[var(--primary)]">
            {project.project_name}
          </Link>
          {project.project_description ? (
            <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[var(--muted)]">{project.project_description}</p>
          ) : typeof project.project_url === 'string' && project.project_url ? (
            <a href={project.project_url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="relative z-10 mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-[var(--blue-text)] hover:underline">
              <Link2 size={12} className="shrink-0" /><span className="truncate">{project.project_url.replace(/^https?:\/\//, '')}</span>
            </a>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[var(--input-surface)] px-2 text-[11.5px] font-semibold text-[var(--muted-strong)]">
            <LayoutGrid size={12} />
            {boardCount === 1
              ? t('projects.board_count_short', '{count} board', { count: boardCount })
              : t('projects.board_count_plural', '{count} boards', { count: boardCount })}
          </span>
          {project.team ? <span className="inline-flex h-6 max-w-[150px] items-center truncate rounded-full bg-[var(--blue-dim)] px-2 text-[11.5px] font-semibold text-[var(--blue-text)]">{project.team.name}</span> : null}
          {project.deadline ? (
            <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold tabular-nums', overdue ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : soon ? 'bg-[var(--warning-dim)] text-[var(--warning-text)]' : 'bg-[var(--input-surface)] text-[var(--muted-strong)]')}>
              <CalendarClock size={12} />{formatProjectDateTime(project.deadline)}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
          {members.length > 0 ? <AvatarGroup users={members} max={4} size="xs" /> : <span className="text-[11.5px] text-[var(--caption)]">{t('projects.card.no_members', 'No members yet')}</span>}
          <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--caption)]">
            {project.updated_at ? formatRelativeDate(project.updated_at) : ''}
            <ArrowUpRight size={13} className="text-[var(--muted)] opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          </span>
        </div>
      </div>

      <Link to={`/projects/${project.id}`} className="absolute inset-0" aria-label={t('projects.open_project', 'Open {name}', { name: project.project_name })} tabIndex={-1} />
    </div>
  )
}

/** Skeleton placeholder while loading */
export function ProjectCardSkeleton() {
  return (
    <div data-slot="card" className="flex flex-col overflow-hidden rounded-[22px] bg-[var(--card)] ring-1 ring-[var(--border)]">
      <Skeleton className="h-[118px] rounded-none" />
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
