import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, CalendarClock, FolderKanban, LayoutGrid, Layers3, TriangleAlert, UsersRound } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import type { ProjectRecord } from '../../../shared/api/services/projects.service'
import { formatProjectDateTime, isDueDateOverdue, isDueDateSoon } from '../lib/format'
import { projectGradient, projectHue, projectInitial } from '../lib/projectLook'
import { AvatarGroup } from './Avatar'

type ProjectMap3DProps = {
  projects: ProjectRecord[]
  loading?: boolean
  actions?: ReactNode
}

/** Block height: a base plus boards and people, capped so big projects don't swallow the scene. */
function blockHeight(project: ProjectRecord) {
  const boards = Math.min(project.boards_count ?? 0, 8)
  const members = Math.min((project.members ?? []).length, 10)
  return 16 + boards * 11 + members * 4
}

/**
 * The projects as a small floating city: one isometric block per project.
 * Hover (or focus) a block to see its details on the right; click to open it.
 */
export function ProjectMap3D({ projects, loading, actions }: ProjectMap3DProps) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<number | null>(null)
  const active = projects.find((project) => project.id === activeId) ?? null

  const layout = useMemo(() => {
    const count = Math.max(projects.length, 1)
    const columns = Math.min(7, Math.max(2, Math.ceil(Math.sqrt(count))))
    const cell = count <= 9 ? 92 : count <= 20 ? 76 : 60
    return { columns, cell, gap: Math.round(cell * 0.18) }
  }, [projects.length])

  const stats = useMemo(() => {
    const boards = projects.reduce((sum, project) => sum + (project.boards_count ?? 0), 0)
    const people = new Set(projects.flatMap((project) => (project.members ?? []).map((member) => member.id))).size
    const overdue = projects.filter((project) => project.deadline && isDueDateOverdue(project.deadline)).length
    return { boards, people, overdue }
  }, [projects])

  return (
    <section className="pm-scene grid min-h-[360px] overflow-hidden rounded-[26px] text-white lg:grid-cols-[minmax(0,1fr)_330px]">
      {/* the city */}
      <div className="relative min-h-[340px]" onMouseLeave={() => setActiveId(null)}>
        <div className="absolute top-5 left-6 z-10">
          <p className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.12em] text-white/50 uppercase"><Layers3 size={14} />{t('projects.map.eyebrow', 'Project map')}</p>
          <h1 className="mt-1 text-[24px] leading-7 font-bold tracking-[-0.03em]">{t('projects.map.title', 'Projects')}</h1>
        </div>
        {loading && projects.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center text-[13px] text-white/50">{t('common.loading', 'Loading...')}</div>
        ) : projects.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center text-center text-[13px] text-white/55">
            <span><FolderKanban size={30} className="mx-auto mb-2 opacity-60" />{t('projects.map.empty', 'No projects yet')}</span>
          </div>
        ) : (
          <div
            className="pm-plane"
            style={{ gridTemplateColumns: `repeat(${layout.columns}, ${layout.cell}px)`, gridAutoRows: `${layout.cell}px`, gap: layout.gap }}
          >
            {projects.map((project, index) => {
              const hue = projectHue(project.project_name)
              const overdue = project.deadline ? isDueDateOverdue(project.deadline) : false
              const soon = !overdue && project.deadline ? isDueDateSoon(project.deadline) : false
              return (
                <div key={project.id} className="pm-cell">
                  <div
                    role="link"
                    tabIndex={0}
                    aria-label={project.project_name}
                    data-active={activeId === project.id}
                    className="pm-block"
                    style={{ '--pm-h': `${blockHeight(project)}px`, '--pm-hue': hue, animationDelay: `${index * 70}ms` } as CSSProperties}
                    onMouseEnter={() => setActiveId(project.id)}
                    onFocus={() => setActiveId(project.id)}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/projects/${project.id}`) }}
                  >
                    <span className="pm-face pm-shadow" aria-hidden="true" />
                    <span className="pm-face pm-west" aria-hidden="true" />
                    <span className="pm-face pm-south" aria-hidden="true" />
                    <span className="pm-face pm-top" aria-hidden="true">
                      <span style={{ transform: 'rotateZ(45deg)', fontSize: layout.cell * 0.3 }}>{projectInitial(project.project_name)}</span>
                      {overdue || soon ? <span className="pm-flag" style={{ background: overdue ? '#ef4444' : '#f59e0b' }} /> : null}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="absolute bottom-4 left-6 z-10 hidden text-[11.5px] text-white/40 sm:block">{t('projects.map.hint', 'Taller block — more boards and people. Hover to see, click to open.')}</p>
      </div>

      {/* details of the hovered project, or the overview */}
      <aside className="relative flex flex-col gap-4 border-t border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm lg:border-t-0 lg:border-l">
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        {active ? (
          <div key={active.id} className="kb-in flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[20px] font-bold" style={{ background: projectGradient(projectHue(active.project_name)) }}>
                {projectInitial(active.project_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[17px] font-bold tracking-[-0.02em]">{active.project_name}</p>
                {active.team ? <p className="truncate text-[12.5px] text-white/55">{active.team.name}</p> : null}
              </div>
            </div>
            {active.project_description ? <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-white/70">{active.project_description}</p> : null}
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[12px] bg-white/[0.06] px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-[11.5px] text-white/50"><LayoutGrid size={12} />{t('projects.map.boards', 'Boards')}</dt>
                <dd className="mt-0.5 text-[18px] font-bold tabular-nums">{active.boards_count ?? 0}</dd>
              </div>
              <div className="rounded-[12px] bg-white/[0.06] px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-[11.5px] text-white/50"><UsersRound size={12} />{t('projects.map.people', 'People')}</dt>
                <dd className="mt-0.5 text-[18px] font-bold tabular-nums">{(active.members ?? []).length}</dd>
              </div>
            </dl>
            {active.deadline ? (
              <p className={cn('mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold', isDueDateOverdue(active.deadline) ? 'bg-[#ef4444]/20 text-[#fca5a5]' : 'bg-white/[0.08] text-white/75')}>
                <CalendarClock size={12} />{formatProjectDateTime(active.deadline)}
              </p>
            ) : null}
            {(active.members ?? []).length ? <AvatarGroup users={active.members} max={6} size="sm" className="mt-3" /> : null}
            <Link to={`/projects/${active.id}`} className="mt-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[#b8f15a] text-[13.5px] font-semibold text-[#0e1525] transition hover:brightness-105">
              {t('projects.map.open', 'Open project')} <ArrowUpRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <p className="text-[12.5px] text-white/55">{t('projects.map.overview', 'Overview')}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              {[
                { key: 'projects', label: t('projects.map.projects', 'Projects'), value: projects.length, icon: FolderKanban },
                { key: 'boards', label: t('projects.map.boards', 'Boards'), value: stats.boards, icon: LayoutGrid },
                { key: 'people', label: t('projects.map.people', 'People'), value: stats.people, icon: UsersRound },
                { key: 'overdue', label: t('projects.map.overdue', 'Overdue'), value: stats.overdue, icon: TriangleAlert },
              ].map(({ key, label, value, icon: Icon }) => (
                <div key={key} className="rounded-[14px] bg-white/[0.06] px-3 py-3 ring-1 ring-white/[0.06]">
                  <dt className="flex items-center gap-1.5 text-[11.5px] text-white/50"><Icon size={12} />{label}</dt>
                  <dd className={cn('mt-1 text-[22px] leading-none font-bold tabular-nums', key === 'overdue' && value > 0 && 'text-[#fca5a5]')}>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-auto pt-4 text-[12px] leading-relaxed text-white/45">{t('projects.map.tip', 'A red dot means the deadline has passed, amber — it is close.')}</p>
          </div>
        )}
      </aside>
    </section>
  )
}
