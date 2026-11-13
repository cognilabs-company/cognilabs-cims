import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { ActionsMenu, type ActionsMenuItem } from '../../../shared/ui/actions-menu'
import { Skeleton } from '../../../shared/ui/skeleton'
import { cn } from '../../../shared/lib/cn'
import type { ProjectRecord, UserSummary } from '../../../shared/api/services/projects.service'
import { formatProjectDate, getInitials, isDueDateOverdue, isDueDateSoon } from '../lib/format'
import { projectArt, splitProjectName, type ProjectTone } from '../lib/projectArt'
import { projectInitial } from '../lib/projectLook'
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

/** A fine grain over the coloured tiles (like printed paper), so large colour fields never look flat. */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`

type ToneLook = {
  /** Card surface (classes) and its background (inline: gradients). */
  card: string
  background?: string
  title: string
  subtitle: string
  meta: string
  cta: string
  ctaIcon: string
  menu: string
  /** Ring around stacked avatars: the card colour. */
  avatarRing: string
  /** Fallback monogram fill. */
  monogram: string
  coloured: boolean
}

const TONES: Record<ProjectTone, ToneLook> = {
  light: {
    card: 'bg-[var(--card)] ring-1 ring-[var(--border)]',
    title: 'text-[var(--foreground)]',
    subtitle: 'text-[var(--caption)]',
    meta: 'text-[var(--muted)]',
    cta: 'text-[var(--foreground)]',
    ctaIcon: 'bg-[var(--foreground)] text-[var(--card)]',
    menu: 'text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
    avatarRing: 'var(--card)',
    monogram: 'linear-gradient(155deg, color-mix(in srgb, var(--muted) 14%, var(--card)) 10%, color-mix(in srgb, var(--muted) 34%, var(--card)) 90%)',
    coloured: false,
  },
  brand: {
    card: 'text-white',
    background: 'radial-gradient(120% 140% at 88% 18%, #6A8CFF 0%, #2B59FF 46%, #1E44E3 100%)',
    title: 'text-white',
    subtitle: 'text-white/55',
    meta: 'text-white/70',
    cta: 'text-white',
    ctaIcon: 'bg-white text-[#2B59FF]',
    menu: 'text-white/75 hover:bg-white/15 hover:text-white',
    avatarRing: '#2B59FF',
    monogram: 'linear-gradient(155deg, rgba(255,255,255,0.34) 10%, rgba(255,255,255,0.06) 90%)',
    coloured: true,
  },
  ink: {
    card: 'text-white',
    background: 'radial-gradient(120% 140% at 88% 15%, #2C3852 0%, #141C2D 52%, #0B111D 100%)',
    title: 'text-white',
    subtitle: 'text-white/45',
    meta: 'text-white/60',
    cta: 'text-white',
    ctaIcon: 'bg-white text-[#0E1525]',
    menu: 'text-white/70 hover:bg-white/10 hover:text-white',
    avatarRing: '#141C2D',
    monogram: 'linear-gradient(155deg, rgba(255,255,255,0.22) 10%, rgba(255,255,255,0.03) 90%)',
    coloured: true,
  },
  coral: {
    card: 'text-white',
    background: 'radial-gradient(120% 140% at 88% 18%, #FF8A92 0%, #EF4654 48%, #DA3443 100%)',
    title: 'text-white',
    subtitle: 'text-white/60',
    meta: 'text-white/75',
    cta: 'text-white',
    ctaIcon: 'bg-white text-[#E23B49]',
    menu: 'text-white/75 hover:bg-white/15 hover:text-white',
    avatarRing: '#EF4654',
    monogram: 'linear-gradient(155deg, rgba(255,255,255,0.36) 10%, rgba(255,255,255,0.06) 90%)',
    coloured: true,
  },
}

/** Up to four faces, then "+N" — photos as they are, initials in neutral grey (no rainbow). */
function People({ users, ring, coloured }: { users: UserSummary[]; ring: string; coloured: boolean }) {
  const visible = users.slice(0, 4)
  const extra = users.length - visible.length
  return (
    <span className="flex items-center">
      {visible.map((user, index) => {
        const image = resolveMediaUrl(user.profile_image) ?? user.profile_image ?? null
        const name = [user.name, user.surname].filter(Boolean).join(' ')
        const style: CSSProperties = { boxShadow: `0 0 0 2px ${ring}`, marginLeft: index ? -6 : 0, zIndex: visible.length - index }
        return image ? (
          <img key={user.id} src={image} alt="" title={name} className="relative h-6 w-6 rounded-full object-cover" style={style} />
        ) : (
          <span
            key={user.id}
            title={name}
            className={cn('relative grid h-6 w-6 place-items-center rounded-full text-[10.5px] font-semibold', coloured ? 'bg-[color-mix(in_srgb,currentColor_22%,transparent)] text-white' : 'bg-[var(--input-surface)] text-[var(--muted-strong)]')}
            style={style}
          >
            {getInitials(user.name, user.surname).charAt(0)}
          </span>
        )
      })}
      {extra > 0 ? (
        <span
          className={cn('relative grid h-6 min-w-6 place-items-center rounded-full pr-1.5 pl-[9px] text-[10px] font-semibold tabular-nums', coloured ? 'bg-[color-mix(in_srgb,currentColor_22%,transparent)] text-white' : 'bg-[var(--input-surface)] text-[var(--muted-strong)]')}
          style={{ boxShadow: `0 0 0 2px ${ring}`, marginLeft: -6 }}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  )
}

/**
 * A project tile: the name on two lines (dark + muted), a few facts, "Open project" and a 3D illustration on the
 * right that bleeds off the edge. Without an illustration: the project's own picture on a tilted tile, or its
 * initial as a soft embossed letter.
 */
export function ProjectCard({ project, onEdit, onDelete, canEdit = true, canDelete = true }: ProjectCardProps) {
  const { t } = useLocale()
  const actions: ActionsMenuItem[] = [
    ...(canEdit ? [{ label: t('projects.edit_project_action', 'Edit project'), onSelect: () => onEdit(project) }] : []),
    ...(canDelete ? [{ label: t('projects.delete_project_action', 'Delete project'), tone: 'danger' as const, onSelect: () => onDelete(project) }] : []),
  ]
  const art = projectArt(project.id)
  const tone = TONES[art?.tone ?? 'light']
  const [first, second] = splitProjectName(project.project_name)
  const longest = Math.max(first.length, second.length)
  const titleSize = longest <= 13 ? 'text-[23px] sm:text-[27px]' : longest <= 19 ? 'text-[21px] sm:text-[23px]' : 'text-[19px] sm:text-[20px]'
  const boards = project.boards_count ?? 0
  const people = (() => {
    const seen = new Set<number>()
    return [project.created_by, ...(project.members ?? [])].filter((user) => user && user.id > 0 && !seen.has(user.id) && Boolean(seen.add(user.id)))
  })()
  const overdue = project.deadline ? isDueDateOverdue(project.deadline) : false
  const soon = !overdue && project.deadline ? isDueDateSoon(project.deadline) : false
  const logo = !art && project.image ? resolveMediaUrl(project.image) ?? project.image : null
  const openLabel = t('projects.open_project_named', 'Open {{name}}', { name: project.project_name })

  return (
    <article
      data-slot="card"
      className={cn(
        'group @container relative isolate min-h-[228px] overflow-hidden rounded-[26px] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(14,21,37,0.35)] sm:h-[244px]',
        tone.card,
      )}
      style={tone.background ? { background: tone.background } : undefined}
    >
      {tone.coloured ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: GRAIN }} /> : null}

      {/* Picture on the right */}
      {art ? (
        <>
          {/* A soft light behind dark objects on the dark theme's light tile */}
          {!tone.coloured ? <span aria-hidden="true" className="pointer-events-none absolute right-[-6%] bottom-[-14%] -z-10 hidden h-[110%] w-[58%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.13),transparent)] dark:block" /> : null}
          <img
            src={art.src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="pointer-events-none absolute right-[-3%] bottom-[-9%] -z-10 h-[118%] w-auto max-w-[42%] object-contain object-right-bottom @min-[480px]:max-w-[56%] transition-transform duration-500 ease-out select-none group-hover:scale-[1.035]"
          />
        </>
      ) : logo ? (
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-[7%] -z-10 -translate-y-1/2 rotate-[-9deg] transition-transform duration-500 ease-out group-hover:rotate-[-5deg]">
          <span className="block rounded-[30px] bg-[var(--card)] p-2 shadow-[0_26px_44px_-18px_rgba(14,21,37,0.45),0_2px_6px_rgba(14,21,37,0.08)] ring-1 ring-black/5">
            <img src={logo} alt="" loading="lazy" decoding="async" className="h-[96px] w-[96px] rounded-[24px] object-cover sm:h-[112px] sm:w-[112px]" />
          </span>
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-[-0.04em] bottom-[-0.24em] -z-10 text-[190px] leading-none font-bold tracking-[-0.06em] select-none sm:text-[220px]"
          style={{ backgroundImage: tone.monogram, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 18px 22px rgba(14,21,37,0.10))' }}
        >
          {projectInitial(project.project_name)}
        </span>
      )}

      <div className="relative flex h-full min-h-[228px] max-w-[64%] flex-col p-6 sm:min-h-0 sm:max-w-[58%] sm:p-7">
        <h3 title={project.project_name} className={cn('leading-[1.12] font-semibold tracking-[-0.03em]', titleSize)}>
          <span className={cn('block truncate', tone.title)}>{first}</span>
          {second ? <span className={cn('block truncate', tone.subtitle)}>{second}</span> : null}
        </h3>
        {!second && project.project_description ? (
          <p className={cn('mt-1.5 line-clamp-2 text-[12.5px] leading-snug', tone.meta)}>{project.project_description}</p>
        ) : null}

        <div className={cn('mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px] font-medium', tone.meta)}>
          {people.length ? <People users={people} ring={tone.avatarRing} coloured={tone.coloured} /> : null}
          <span className="tabular-nums">{t('projects.boards_n', '{{count}} boards', { count: boards })}</span>
          {project.deadline ? (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', overdue ? 'bg-[var(--danger)]' : soon ? 'bg-[var(--warning)]' : tone.coloured ? 'bg-white/50' : 'bg-[var(--border-hover)]')} />
              {overdue
                ? t('projects.overdue_on', 'Overdue · {{date}}', { date: formatProjectDate(project.deadline) })
                : t('projects.due_on', 'Due {{date}}', { date: formatProjectDate(project.deadline) })}
            </span>
          ) : null}
        </div>

        <span className={cn('mt-auto inline-flex items-center gap-3 pt-4 text-[12.5px] font-medium tracking-[0.06em] whitespace-nowrap uppercase', tone.cta)}>
          <span className={cn('grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-45', tone.ctaIcon)}>
            <ArrowUpRight size={15} strokeWidth={2.2} />
          </span>
          {t('projects.open_cta', 'Open project')}
        </span>
      </div>

      {/* The whole tile opens the project */}
      <Link to={`/projects/${project.id}`} className="absolute inset-0 z-10 rounded-[26px] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none" aria-label={openLabel} />

      {actions.length > 0 ? (
        <div className="absolute top-3 right-3 z-20 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
          <ActionsMenu label={t('projects.project_actions', 'Project actions')} items={actions} className={tone.menu} />
        </div>
      ) : null}
    </article>
  )
}

/** Placeholder with the same shape while projects load. */
export function ProjectCardSkeleton() {
  return (
    <div data-slot="card" className="relative h-[228px] overflow-hidden rounded-[26px] bg-[var(--card)] ring-1 ring-[var(--border)] sm:h-[244px]">
      <div className="flex h-full max-w-[58%] flex-col p-6 sm:p-7">
        <Skeleton rounded="full" className="h-6 w-3/4" />
        <Skeleton rounded="full" className="mt-2.5 h-6 w-1/2" />
        <Skeleton rounded="full" className="mt-4 h-4 w-2/3" />
        <div className="mt-auto flex items-center gap-3">
          <Skeleton rounded="full" className="h-[34px] w-[34px]" />
          <Skeleton rounded="full" className="h-3.5 w-28" />
        </div>
      </div>
      <Skeleton rounded="full" className="absolute top-1/2 right-[8%] h-32 w-32 -translate-y-1/2" />
    </div>
  )
}
