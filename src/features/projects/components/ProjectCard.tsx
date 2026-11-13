import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { ActionsMenu, type ActionsMenuItem } from '../../../shared/ui/actions-menu'
import { Skeleton } from '../../../shared/ui/skeleton'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import type { ProjectRecord } from '../../../shared/api/services/projects.service'
import { formatProjectDueShort } from '../lib/format'
import { projectArt, splitProjectName } from '../lib/projectArt'
import { projectInitial } from '../lib/projectLook'

type ProjectCardProps = {
  project: ProjectRecord
  onEdit: (project: ProjectRecord) => void
  onDelete: (project: ProjectRecord) => void
  /** RBAC projects.edit — shows "Edit project". */
  canEdit?: boolean
  /** RBAC projects.delete — shows "Delete project". */
  canDelete?: boolean
}

/**
 * A small project tile in the spirit of Iconly's cards: the name on two lines (dark, then grey), one
 * quiet line of facts, "Open project" — and the project's 3D object on the right, shown whole.
 * Only neutral colours: the picture brings the colour. The whole tile opens the project.
 */
export function ProjectCard({ project, onEdit, onDelete, canEdit = true, canDelete = true }: ProjectCardProps) {
  const { t } = useLocale()
  const actions: ActionsMenuItem[] = [
    ...(canEdit ? [{ label: t('projects.edit_project_action', 'Edit project'), onSelect: () => onEdit(project) }] : []),
    ...(canDelete ? [{ label: t('projects.delete_project_action', 'Delete project'), tone: 'danger' as const, onSelect: () => onDelete(project) }] : []),
  ]
  const art = projectArt(project.id)
  const logo = art ? null : resolveMediaUrl(project.image) ?? project.image ?? null
  const [first, second] = splitProjectName(project.project_name)
  const secondLine = second || project.team?.name || ''
  const facts = [
    t('projects.boards_n', '{{count}} boards', { count: project.boards_count ?? 0 }),
    project.deadline ? formatProjectDueShort(project.deadline, false) : null,
  ].filter(Boolean).join(' · ')

  return (
    <article
      data-slot="card"
      className="group relative isolate flex h-[148px] overflow-hidden rounded-[20px] bg-[var(--card)] ring-1 ring-[var(--border)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_1px_2px_rgba(14,21,37,0.04),0_14px_30px_-18px_rgba(14,21,37,0.3)] dark:hover:shadow-[0_16px_34px_-18px_rgba(0,0,0,0.75)]"
    >
      <div className="flex min-w-0 flex-1 flex-col py-[18px] pr-1 pl-5">
        <h3 title={project.project_name} className="text-[17px] leading-[21px] font-semibold tracking-[-0.025em]">
          <span className="block truncate text-[var(--foreground)]">{first}</span>
          {secondLine ? <span className="block truncate text-[var(--caption)]">{secondLine}</span> : null}
        </h3>
        <p className="mt-1.5 truncate text-[12px] text-[var(--muted)] tabular-nums">{facts}</p>
        <span className="mt-auto inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.07em] whitespace-nowrap text-[var(--foreground)] uppercase">
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[var(--foreground)] text-[var(--card)] transition-transform duration-300 group-hover:rotate-45">
            <ArrowUpRight size={13} strokeWidth={2.4} />
          </span>
          {t('projects.open_short', 'Open')}
        </span>
      </div>

      {/* The project's object, whole — never cropped */}
      <div className="flex w-[46%] max-w-[156px] shrink-0 items-center justify-center py-3 pr-3">
        {art ? (
          <img
            src={art.src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="max-h-full max-w-full object-contain transition-transform duration-500 ease-out select-none group-hover:scale-[1.05] group-hover:-rotate-2"
          />
        ) : logo ? (
          <img src={logo} alt="" loading="lazy" decoding="async" className="h-[76px] w-[76px] rounded-[20px] object-cover ring-1 ring-[var(--border)]" />
        ) : (
          <span
            aria-hidden="true"
            className="text-[88px] leading-none font-bold tracking-[-0.06em] select-none"
            style={{ backgroundImage: 'linear-gradient(160deg, color-mix(in srgb, var(--muted) 30%, transparent), color-mix(in srgb, var(--muted) 8%, transparent))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
          >
            {projectInitial(project.project_name)}
          </span>
        )}
      </div>

      {/* The whole tile opens the project */}
      <Link
        to={`/projects/${project.id}`}
        className="absolute inset-0 z-10 rounded-[20px] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none"
        aria-label={t('projects.open_project_named', 'Open {{name}}', { name: project.project_name })}
      />

      {actions.length > 0 ? (
        <div className="absolute top-2.5 right-2.5 z-20 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
          <ActionsMenu
            label={t('projects.project_actions', 'Project actions')}
            items={actions}
            className="h-8 w-8 bg-[color-mix(in_srgb,var(--card)_82%,transparent)] backdrop-blur-sm"
          />
        </div>
      ) : null}
    </article>
  )
}

/** Placeholder with the same shape while projects load. */
export function ProjectCardSkeleton() {
  return (
    <div data-slot="card" className="flex h-[148px] rounded-[20px] bg-[var(--card)] ring-1 ring-[var(--border)]">
      <div className="flex flex-1 flex-col py-[18px] pl-5">
        <Skeleton rounded="full" className="h-4 w-3/4" />
        <Skeleton rounded="full" className="mt-2 h-4 w-1/2" />
        <Skeleton rounded="full" className="mt-3 h-3 w-1/3" />
        <div className="mt-auto flex items-center gap-2">
          <Skeleton rounded="full" className="h-[26px] w-[26px]" />
          <Skeleton rounded="full" className="h-3 w-24" />
        </div>
      </div>
      <div className="flex w-[46%] max-w-[156px] items-center justify-center pr-3">
        <Skeleton rounded="xl" className="h-[96px] w-[96px]" />
      </div>
    </div>
  )
}
