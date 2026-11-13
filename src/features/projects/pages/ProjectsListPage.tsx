import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { projectsService, type ProjectRecord, type UserSummary } from '../../../shared/api/services/projects.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { StateBlock } from '../../../shared/ui/state-block'
import { useToast } from '../../../shared/toast/useToast'
import { useAuth } from '../../auth/hooks/useAuth'
import { ProjectCard, ProjectCardSkeleton } from '../components/ProjectCard'
import { Plus, Search, UsersRound, X } from 'lucide-react'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { TeamManagementModal } from '../components/TeamManagementModal'
import { formatProjectDateTime, getInitials, getPriorityConfig, isDueDateOverdue, isDueDateSoon } from '../lib/format'
import { buildMemberProjectOverview } from '../lib/memberOverview'
import { notifyProjectsNavigationChanged } from '../lib/navigationSync'

function parseMemberId(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5'
const chipClass = 'inline-flex h-10 shrink-0 items-center gap-2 rounded-full text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200'
const chipOn = 'bg-[var(--foreground)] text-[var(--background)]'
const chipOff = 'bg-[var(--card)] text-[var(--muted-strong)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)] hover:ring-[var(--border-hover)]'

/** A person's photo, or their initials in quiet grey (inverted on a selected chip). */
function Face({ user, size, inverted = false }: { user: UserSummary; size: number; inverted?: boolean }) {
  const image = resolveMediaUrl(user.profile_image) ?? user.profile_image ?? null
  const name = [user.name, user.surname].filter(Boolean).join(' ')
  if (image) return <img src={image} alt="" title={name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  return (
    <span
      title={name}
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold', inverted ? 'bg-white/15 text-current' : 'bg-[var(--input-surface)] text-[var(--muted-strong)]')}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {getInitials(user.name, user.surname)}
    </span>
  )
}

export function ProjectsListPage() {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user, can } = useAuth()
  const { t } = useLocale()
  const lt = translateCurrentLiteral
  const [searchParams, setSearchParams] = useSearchParams()

  const canManageProjects = Boolean(user)
  const canCreateProject = can('projects', 'create')
  const canEditProject = can('projects', 'edit')
  const canDeleteProject = can('projects', 'delete')
  const priorityConfigMap = getPriorityConfig()

  const projectsQuery = useAsyncData(
    async () => {
      if (!user) {
        throw new Error('User session is unavailable')
      }

      return projectsService.listReadableProjects(user.id)
    },
    [user?.id],
    { enabled: Boolean(user) },
  )

  const membersQuery = useAsyncData(
    () => projectsService.getAllUsers(),
    [],
    { enabled: canManageProjects },
  )

  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isTeamsOpen, setIsTeamsOpen] = useState(false)
  const [editProject, setEditProject] = useState<ProjectRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedMemberId = parseMemberId(searchParams.get('member'))
  const projects = useMemo(() => projectsQuery.data?.projects ?? [], [projectsQuery.data])
  const total = projectsQuery.data?.total_count ?? projects.length

  const selectedMemberProjectsQuery = useAsyncData(
    () => projectsService.listUserOpenProjects(selectedMemberId ?? 0),
    [selectedMemberId],
    { enabled: selectedMemberId !== null },
  )
  const selectedMemberCardsQuery = useAsyncData(
    () => projectsService.listUserOpenCards(selectedMemberId ?? 0),
    [selectedMemberId],
    { enabled: selectedMemberId !== null },
  )

  const selectedMemberProjects = useMemo(() => selectedMemberProjectsQuery.data?.projects ?? [], [selectedMemberProjectsQuery.data])
  const selectedMemberCards = useMemo(() => selectedMemberCardsQuery.data?.cards ?? [], [selectedMemberCardsQuery.data])

  const projectIdsKey = useMemo(
    () => projects.map((project) => project.id).sort((left, right) => left - right).join(','),
    [projects],
  )

  const projectDetailsQuery = useAsyncData(
    async () => {
      if (!user) {
        return []
      }

      const details = await Promise.allSettled(
        projects.map((project) => (
          projectsService.getReadableProjectDetail(project.id, user.id)
        )),
      )

      return details.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    },
    [projectIdsKey, user?.id],
    { enabled: projects.length > 0 && Boolean(user) },
  )

  const detailedProjectsMap = useMemo(
    () => new Map((projectDetailsQuery.data ?? []).map((project) => [project.id, project])),
    [projectDetailsQuery.data],
  )

  const detailedProjects = useMemo(
    () => projects.map((project) => detailedProjectsMap.get(project.id) ?? project),
    [detailedProjectsMap, projects],
  )

  const memberProjectCounts = useMemo(() => {
    const counts = new Map<number, number>()

    for (const project of detailedProjects) {
      const memberIds = new Set<number>()

      if (project.created_by.id > 0) {
        memberIds.add(project.created_by.id)
      }

      for (const member of project.members) {
        if (member.id > 0) {
          memberIds.add(member.id)
        }
      }

      for (const memberId of memberIds) {
        counts.set(memberId, (counts.get(memberId) ?? 0) + 1)
      }
    }

    return counts
  }, [detailedProjects])

  const derivedMembers = useMemo(() => {
    const entries = new Map<number, UserSummary>()

    for (const project of detailedProjects) {
      const participants = [project.created_by, ...project.members]

      for (const participant of participants) {
        if (participant.id > 0 && !entries.has(participant.id)) {
          entries.set(participant.id, participant)
        }
      }
    }

    return Array.from(entries.values())
  }, [detailedProjects])

  const members = useMemo(() => {
    const source = (() => {
      if (!canManageProjects) {
        return derivedMembers
      }

      const allUsers = membersQuery.data ?? []

      if (allUsers.length > 0) {
        return allUsers
      }

      return derivedMembers
    })()

    return [...source].sort((left, right) => {
      const leftCount = memberProjectCounts.get(left.id) ?? 0
      const rightCount = memberProjectCounts.get(right.id) ?? 0

      if (rightCount !== leftCount) {
        return rightCount - leftCount
      }

      return `${left.name} ${left.surname}`.localeCompare(`${right.name} ${right.surname}`)
    })
  }, [canManageProjects, derivedMembers, memberProjectCounts, membersQuery.data])

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  )

  const scopedProjects = selectedMemberId !== null ? selectedMemberProjects : detailedProjects
  const memberOverview = useMemo(
    () => (selectedMemberId !== null ? buildMemberProjectOverview(selectedMemberProjects, selectedMemberCards) : null),
    [selectedMemberCards, selectedMemberId, selectedMemberProjects],
  )

  const membersPanelLoading =
    projectsQuery.isLoading ||
    (projects.length > 0 && projectDetailsQuery.isLoading) ||
    (canManageProjects && membersQuery.isLoading)

  const isSelectedMemberProjectsLoading = selectedMemberId !== null && selectedMemberProjectsQuery.isLoading
  const isSelectedMemberProjectsError = selectedMemberId !== null && selectedMemberProjectsQuery.isError
  const isSelectedMemberOverviewLoading =
    selectedMemberId !== null && (selectedMemberProjectsQuery.isLoading || selectedMemberCardsQuery.isLoading)
  const isSelectedMemberOverviewError =
    selectedMemberId !== null && (selectedMemberProjectsQuery.isError || selectedMemberCardsQuery.isError)

  const filteredProjects = useMemo(() => {
    if (!search.trim()) {
      return scopedProjects
    }

    const query = search.toLowerCase()
    return scopedProjects.filter(
      (project) =>
        project.project_name.toLowerCase().includes(query) ||
        (project.project_description ?? '').toLowerCase().includes(query),
    )
  }, [scopedProjects, search])

  const peopleCount = useMemo(() => {
    const ids = new Set<number>()
    for (const project of filteredProjects) {
      for (const person of [project.created_by, ...(project.members ?? [])]) if (person && person.id > 0) ids.add(person.id)
    }
    return ids.size
  }, [filteredProjects])

  async function handleCreate(fd: FormData) {
    if (!canCreateProject) {
      return
    }

    setIsSubmitting(true)
    try {
      await projectsService.createProject(fd)
      showToast({ title: lt('Project created'), tone: 'success' })
      setIsCreateOpen(false)
      await projectsQuery.refetch()
      refetchSelectedMemberData()
      notifyProjectsNavigationChanged()
    } catch {
      showToast({ title: lt('Failed to create project'), tone: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdate(fd: FormData, telegramGroupId?: string | null) {
    if (!canEditProject || !editProject) {
      return
    }

    setIsSubmitting(true)
    try {
      await projectsService.updateProject(editProject.id, fd)
      if (telegramGroupId !== undefined) {
        await projectsService.updateProjectTelegramGroup(editProject.id, telegramGroupId)
      }
      showToast({ title: lt('Project updated'), tone: 'success' })
      setEditProject(null)
      await projectsQuery.refetch()
      await projectDetailsQuery.refetch()
      refetchSelectedMemberData()
      notifyProjectsNavigationChanged()
    } catch {
      showToast({ title: lt('Failed to update project'), tone: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(project: ProjectRecord) {
    if (!canDeleteProject) {
      return
    }

    const ok = await confirm({
      title: lt('Delete project?'),
      description: `"${project.project_name}" ${lt('and all its boards will be permanently deleted. This cannot be undone.')}`,
      tone: 'danger',
    })

    if (!ok) {
      return
    }

    try {
      await projectsService.deleteProject(project.id)
      showToast({ title: lt('Project deleted'), tone: 'success' })
      await projectsQuery.refetch()
      refetchSelectedMemberData()
      notifyProjectsNavigationChanged()
    } catch {
      showToast({ title: lt('Failed to delete project'), tone: 'error' })
    }
  }

  function selectMember(memberId: number | null) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)

      if (memberId === null) {
        next.delete('member')
      } else {
        next.set('member', String(memberId))
      }

      return next
    }, { replace: true })
  }

  function refetchSelectedMemberData() {
    if (selectedMemberId === null) {
      return
    }

    void Promise.allSettled([
      selectedMemberProjectsQuery.refetch(),
      selectedMemberCardsQuery.refetch(),
    ])
  }

  async function handleOpenEdit(project: ProjectRecord) {
    if (!canEditProject || !user) {
      return
    }

    try {
      const detail = await projectsService.getReadableProjectDetail(project.id, user.id)
      setEditProject(detail)
    } catch {
      showToast({ title: lt('Failed to load project members'), tone: 'error' })
    }
  }

  const summary = [
    t('projects.projects_n', '{{count}} projects', { count: filteredProjects.length }),
    t('projects.boards_n', '{{count}} boards', { count: filteredProjects.reduce((sum, project) => sum + (project.boards_count ?? 0), 0) }),
    t('projects.people_n', '{{count}} people', { count: peopleCount }),
  ].join(' · ')

  return (
    <>
      <div className="page-enter flex flex-col gap-6">
        {/* Header: title + a one-line summary; search, teams, new project */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.035em] text-[var(--foreground)]">{lt('Projects')}</h1>
            <p className="mt-1 text-[13px] text-[var(--muted)] tabular-nums">
              {projectsQuery.isLoading ? ' ' : summary}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative flex h-10 w-full min-w-0 items-center sm:w-[280px]">
              <Search size={16} className="pointer-events-none absolute left-3.5 text-[var(--muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={selectedMember ? lt('Search selected member projects...') : lt('Search projects...')}
                aria-label={lt('Search projects...')}
                className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--card)] pr-9 pl-10 text-[13.5px] text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)] hover:border-[var(--border-hover)] focus:border-[var(--foreground)] focus:outline-none"
              />
              {search ? (
                <button type="button" onClick={() => setSearch('')} aria-label={lt('Clear')} className="absolute right-2.5 grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--muted-surface)]">
                  <X size={14} />
                </button>
              ) : null}
            </label>
            {canManageProjects ? (
              <Button variant="secondary" className="rounded-full max-sm:flex-1" onClick={() => setIsTeamsOpen(true)} leftIcon={<UsersRound size={15} />}>{t('projects.teams_button', 'Teams')}</Button>
            ) : null}
            {canManageProjects && canCreateProject ? (
              <Button className="rounded-full max-sm:flex-1" onClick={() => setIsCreateOpen(true)} leftIcon={<Plus size={15} />}>{t('projects.new_project_button', 'New project')}</Button>
            ) : null}
          </div>
        </header>

        {/* People: one quiet row — pick a person to see their projects and tasks */}
        {membersPanelLoading ? (
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} rounded="full" className="h-10 w-36 shrink-0" />)}
          </div>
        ) : members.length > 0 ? (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5" role="toolbar" aria-label={lt('All members')}>
            <button
              type="button"
              onClick={() => selectMember(null)}
              aria-pressed={selectedMemberId === null}
              className={cn(chipClass, 'px-4', selectedMemberId === null ? chipOn : chipOff)}
            >
              {t('projects.filter_all', 'All')}
              <span className="text-[12px] tabular-nums opacity-55">{total}</span>
            </button>
            {members.map((member) => {
              const projectCount = memberProjectCounts.get(member.id) ?? 0
              const isSelected = member.id === selectedMemberId
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => selectMember(isSelected ? null : member.id)}
                  aria-pressed={isSelected}
                  className={cn(chipClass, 'pr-3.5 pl-1', isSelected ? chipOn : chipOff)}
                >
                  <Face user={member} size={32} inverted={isSelected} />
                  <span className="max-w-[150px] truncate">{member.name} {member.surname}</span>
                  <span className="text-[12px] tabular-nums opacity-55">{projectCount}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {selectedMember ? (
          <section className="rounded-[20px] bg-[var(--card)] p-5 ring-1 ring-[var(--border)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex min-w-0 items-center gap-3.5">
                <Face user={selectedMember} size={52} />
                <div className="min-w-0">
                  <h2 className="truncate text-[20px] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
                    {selectedMember.name} {selectedMember.surname}
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{t('projects.member_overview_hint', 'Assigned tasks in active boards')}</p>
                </div>
              </div>
              <dl className="flex gap-7">
                {([
                  [t('projects.member_stats_projects', 'Projects'), selectedMemberProjects.length],
                  [t('projects.member_stats_boards', 'Boards'), memberOverview?.boardCount ?? 0],
                  [t('projects.member_stats_tasks', 'Tasks'), memberOverview?.taskCount ?? 0],
                ] as const).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-medium tracking-[0.07em] text-[var(--muted)] uppercase">{label}</dt>
                    <dd className="mt-0.5 text-[24px] leading-7 font-semibold tracking-[-0.02em] text-[var(--foreground)] tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-6">
              {isSelectedMemberOverviewLoading ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {Array.from({ length: Math.max(selectedMemberProjects.length, 2) }).map((_, index) => (
                    <Skeleton key={index} rounded="xl" className="h-44" />
                  ))}
                </div>
              ) : isSelectedMemberOverviewError ? (
                <StateBlock
                  tone="error"
                  eyebrow={lt('Error')}
                  title={lt('Failed to load member tasks')}
                  description={lt('There was an error loading the member overview. Please try again.')}
                  actionLabel={lt('Retry')}
                  onAction={refetchSelectedMemberData}
                />
              ) : memberOverview && memberOverview.projects.length > 0 ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {memberOverview.projects.map((project) => (
                    <div key={project.projectId} className="rounded-[16px] bg-[var(--muted-surface)] p-4 sm:p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <Link
                          to={`/projects/${project.projectId}`}
                          className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] underline-offset-4 hover:underline"
                        >
                          {project.projectName}
                        </Link>
                        <span className="text-[12px] text-[var(--muted)] tabular-nums">
                          {t('projects.boards_n', '{{count}} boards', { count: project.boardCount })} · {t('projects.tasks_n', '{{count}} tasks', { count: project.taskCount })}
                        </span>
                      </div>

                      {project.tasks.length === 0 ? (
                        <p className="mt-3.5 rounded-[14px] bg-[var(--card)] px-4 py-3 text-[13px] text-[var(--muted)]">
                          {lt('This member has no assigned tasks in active boards for this project.')}
                        </p>
                      ) : (
                        <ul className="mt-3.5 space-y-2">
                          {project.tasks.map((task) => {
                            const priority = task.priority ? priorityConfigMap[task.priority] : null
                            const overdue = task.dueDate ? isDueDateOverdue(task.dueDate) : false
                            const soon = !overdue && task.dueDate ? isDueDateSoon(task.dueDate) : false
                            return (
                              <li key={task.cardId}>
                                <Link
                                  to={`/projects/${task.projectId}?board=${task.boardId}`}
                                  className="flex items-start justify-between gap-3 rounded-[14px] bg-[var(--card)] px-4 py-3 ring-1 ring-transparent transition-shadow hover:ring-[var(--border-hover)]"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]">{task.title}</span>
                                    <span className="mt-0.5 block truncate text-[12px] text-[var(--muted)]">{task.boardName} · {task.columnName}</span>
                                  </span>
                                  <span className="flex shrink-0 flex-col items-end gap-1 text-[12px]">
                                    {priority ? (
                                      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--muted-strong)]">
                                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: priority.color }} />
                                        {priority.label}
                                      </span>
                                    ) : null}
                                    <span className={cn('tabular-nums', overdue ? 'font-medium text-[var(--danger-text)]' : soon ? 'font-medium text-[var(--warning-text)]' : 'text-[var(--muted)]')}>
                                      {task.dueDate ? `${lt('Due')} ${formatProjectDateTime(task.dueDate)}` : lt('No due date')}
                                    </span>
                                  </span>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <StateBlock
                  tone="empty"
                  eyebrow={lt('No tasks')}
                  title={lt('No member activity found')}
                  description={lt('This member may be part of projects, but no assigned tasks were found in active boards.')}
                />
              )}
            </div>
          </section>
        ) : null}

        {projectsQuery.isLoading || isSelectedMemberProjectsLoading ? (
          <div className={gridClass}>
            {Array.from({ length: 8 }).map((_, index) => (
              <ProjectCardSkeleton key={index} />
            ))}
          </div>
        ) : projectsQuery.isError || isSelectedMemberProjectsError ? (
          <StateBlock
            tone="error"
            eyebrow={lt('Error')}
            title={lt('Failed to load projects')}
            description={lt('Something went wrong. Please try again.')}
            actionLabel={lt('Retry')}
            onAction={selectedMemberId !== null ? refetchSelectedMemberData : () => void projectsQuery.refetch()}
          />
        ) : filteredProjects.length === 0 ? (
          <StateBlock
            tone="empty"
            eyebrow={lt('No results')}
            title={
              search
                ? lt('No projects match your search')
                : selectedMember
                  ? lt('This member has no matching projects')
                  : lt('No projects yet')
            }
            description={
              search
                ? lt('Try a different search term.')
                : selectedMember
                  ? lt('Choose another member or clear the filter to see all projects.')
                  : canCreateProject
                    ? lt('Create your first project to get started organizing your work.')
                    : lt('No projects are visible for this account yet.')
            }
            actionLabel={!search && !selectedMember && canCreateProject ? lt('Create project') : undefined}
            onAction={!search && !selectedMember && canCreateProject ? () => setIsCreateOpen(true) : undefined}
          />
        ) : (
          <div className={gridClass}>
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={(nextProject) => void handleOpenEdit(nextProject)}
                onDelete={handleDelete}
                canEdit={canEditProject}
                canDelete={canDeleteProject}
              />
            ))}
          </div>
        )}
      </div>

      {canManageProjects ? (
        <>
          {canCreateProject ? (
            <ProjectFormModal
              open={isCreateOpen}
              onClose={() => setIsCreateOpen(false)}
              onSubmit={handleCreate}
              title={lt('Create project')}
              submitLabel={lt('Create')}
              isSubmitting={isSubmitting}
            />
          ) : null}

          {canEditProject ? (
            <ProjectFormModal
              open={editProject !== null}
              onClose={() => setEditProject(null)}
              onSubmit={handleUpdate}
              initial={editProject}
              title={lt('Edit project')}
              submitLabel={lt('Save changes')}
              isSubmitting={isSubmitting}
            />
          ) : null}

          <TeamManagementModal
            open={isTeamsOpen}
            onClose={() => setIsTeamsOpen(false)}
            onChanged={() => Promise.allSettled([projectsQuery.refetch(), projectDetailsQuery.refetch()])}
          />
        </>
      ) : null}
    </>
  )
}
