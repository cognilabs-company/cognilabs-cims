import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../../app/hooks/useTheme'
import { projectsService, type ProjectRecord, type UserSummary } from '../../../shared/api/services/projects.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { StateBlock } from '../../../shared/ui/state-block'
import { useToast } from '../../../shared/toast/useToast'
import { useAuth } from '../../auth/hooks/useAuth'
import { Avatar } from '../components/Avatar'
import { ProjectCard, ProjectCardSkeleton } from '../components/ProjectCard'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { TeamManagementModal } from '../components/TeamManagementModal'
import { formatProjectDateTime, getPriorityConfig, isDueDateOverdue, isDueDateSoon } from '../lib/format'
import { buildMemberProjectOverview } from '../lib/memberOverview'
import { notifyProjectsNavigationChanged } from '../lib/navigationSync'

function parseMemberId(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function ProjectsListPage() {
  const { theme } = useTheme()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user } = useAuth()
  const lt = translateCurrentLiteral
  const [searchParams, setSearchParams] = useSearchParams()
  const isDark = theme === 'dark'

  const canManageProjects = Boolean(user)
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
  const projects = projectsQuery.data?.projects ?? []
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

  const selectedMemberProjects = selectedMemberProjectsQuery.data?.projects ?? []
  const selectedMemberCards = selectedMemberCardsQuery.data?.cards ?? []

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

  async function handleCreate(fd: FormData) {
    if (!canManageProjects) {
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
    if (!canManageProjects || !editProject) {
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
    if (!canManageProjects) {
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
    if (!canManageProjects || !user) {
      return
    }

    try {
      const detail = await projectsService.getReadableProjectDetail(project.id, user.id)
      setEditProject(detail)
    } catch {
      showToast({ title: lt('Failed to load project members'), tone: 'error' })
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 page-enter pt-4">
        <Card variant="glass" className="rounded-xl">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{lt('Members')}</h2>

              <div className="flex items-center gap-2">
                {selectedMemberId !== null ? (
                  <Button variant="ghost" size="sm" onClick={() => selectMember(null)}>
                    {lt('Clear member filter')}
                  </Button>
                ) : null}

                {canManageProjects ? (
                  <>
                    <Button variant="secondary" size="md" onClick={() => setIsTeamsOpen(true)}>
                      {lt('Teams')}
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setIsCreateOpen(true)}
                      leftIcon={(
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                        </svg>
                      )}
                    >
                      {lt('New project')}
                    </Button>
                  </>
                ) : undefined}
              </div>
            </div>

            {membersPanelLoading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted-surface)]"
                  />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--muted)]">
                {lt('Members are not available yet.')}
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => selectMember(null)}
                  className={cn(
                    'flex min-h-[84px] items-center justify-between gap-4 rounded-xl border px-4 py-4 text-left shadow-[0_8px_22px_rgba(148,163,184,0.10)] transition-all duration-150',
                    selectedMemberId === null
                      ? isDark
                        ? 'border-blue-500/45 bg-[linear-gradient(180deg,rgba(17,24,39,0.94),rgba(15,23,42,0.98))] text-blue-50 ring-1 ring-blue-400/20 shadow-[0_14px_28px_rgba(37,99,235,0.18)]'
                        : 'border-blue-300 bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(219,234,254,0.92))] text-[var(--foreground)] shadow-[0_14px_28px_rgba(37,99,235,0.12)]'
                      : 'border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--blue-border)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] dark:bg-[var(--surface)]',
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{lt('All members')}</p>
                  </div>
                  <Badge variant={selectedMemberId === null ? 'blue' : 'secondary'}>
                    {total}
                  </Badge>
                </button>

                {members.map((member) => {
                  const projectCount = memberProjectCounts.get(member.id) ?? 0
                  const isSelected = member.id === selectedMemberId

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => selectMember(member.id)}
                      className={cn(
                        'flex min-h-[84px] items-center justify-between gap-4 rounded-xl border px-4 py-4 text-left shadow-[0_8px_22px_rgba(148,163,184,0.10)] transition-all duration-150',
                        isSelected
                          ? isDark
                            ? 'border-blue-500/45 bg-[linear-gradient(180deg,rgba(17,24,39,0.94),rgba(15,23,42,0.98))] text-blue-50 ring-1 ring-blue-400/20 shadow-[0_14px_28px_rgba(37,99,235,0.18)]'
                            : 'border-blue-300 bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(219,234,254,0.92))] text-[var(--foreground)] shadow-[0_14px_28px_rgba(37,99,235,0.12)]'
                          : 'border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--blue-border)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] dark:bg-[var(--surface)]',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3.5">
                        <Avatar
                          name={member.name}
                          surname={member.surname}
                          imageUrl={member.profile_image}
                          size="md"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                            {member.name} {member.surname}
                          </p>
                        </div>
                      </div>

                      <Badge variant={isSelected ? 'blue' : 'secondary'}>
                        {projectCount}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {selectedMember ? (
          <Card variant="glass" className="rounded-xl">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar
                    name={selectedMember.name}
                    surname={selectedMember.surname}
                    imageUrl={selectedMember.profile_image}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold text-[var(--foreground)]">
                      {selectedMember.name} {selectedMember.surname}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="violet">{selectedMemberProjects.length} {lt('projects')}</Badge>
                  <Badge variant="secondary">{memberOverview?.boardCount ?? 0} {lt('boards')}</Badge>
                  <Badge variant={(memberOverview?.taskCount ?? 0) > 0 ? 'warning' : 'secondary'}>
                    {memberOverview?.taskCount ?? 0} {lt('tasks')}
                  </Badge>
                </div>
              </div>

              {isSelectedMemberOverviewLoading ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {Array.from({ length: Math.max(selectedMemberProjects.length, 2) }).map((_, index) => (
                    <div
                      key={index}
                      className="h-48 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted-surface)]"
                    />
                  ))}
                </div>
              ) : isSelectedMemberOverviewError ? (
                <StateBlock
                  tone="error"
                  eyebrow="Error"
                  title={lt('Failed to load member tasks')}
                  description={lt('There was an error loading the member overview. Please try again.')}
                  actionLabel={lt('Retry')}
                  onAction={refetchSelectedMemberData}
                />
              ) : memberOverview && memberOverview.projects.length > 0 ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {memberOverview.projects.map((project) => (
                    <div
                      key={project.projectId}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={`/projects/${project.projectId}`}
                            className="text-base font-semibold text-[var(--foreground)] transition hover:text-blue-400"
                          >
                            {project.projectName}
                          </Link>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{project.boardCount} {lt('boards')}</Badge>
                          <Badge variant={project.taskCount > 0 ? 'warning' : 'secondary'}>
                            {project.taskCount} {lt('tasks')}
                          </Badge>
                        </div>
                      </div>

                      {project.tasks.length === 0 ? (
                        <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] px-4 py-3 text-sm text-[var(--muted)]">
                          {lt('This member has no assigned tasks in active boards for this project.')}
                        </p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {project.tasks.map((task) => {
                            const priorityConfig = task.priority ? priorityConfigMap[task.priority] : null
                            const dueVariant = task.dueDate
                              ? isDueDateOverdue(task.dueDate)
                                ? 'danger'
                                : isDueDateSoon(task.dueDate)
                                  ? 'warning'
                                  : 'secondary'
                              : 'ghost'

                            return (
                              <Link
                                key={task.cardId}
                                to={`/projects/${task.projectId}?board=${task.boardId}`}
                                className="block rounded-xl border border-[var(--border)] bg-[var(--muted-surface)] px-4 py-3 transition hover:border-[var(--border-hover)] hover:bg-[var(--accent-soft)]"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                                      {task.title}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                                      {task.boardName} - {task.columnName}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {priorityConfig ? (
                                      <Badge variant={priorityConfig.badgeVariant}>
                                        {priorityConfig.label}
                                      </Badge>
                                    ) : null}
                                    <Badge variant={dueVariant}>
                                      {task.dueDate ? `${lt('Due')} ${formatProjectDateTime(task.dueDate)}` : lt('No due date')}
                                    </Badge>
                                  </div>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
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
          </Card>
        ) : null}

        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <svg
              viewBox="0 0 16 16"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="6.5" cy="6.5" r="3.5" />
              <path d="M9.5 9.5l3 3" strokeLinecap="round" />
            </svg>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={selectedMember ? lt('Search selected member projects...') : lt('Search projects...')}
              className="pl-9"
            />
          </div>
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              {lt('Clear')}
            </button>
          ) : null}
        </div>

        {projectsQuery.isLoading || isSelectedMemberProjectsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  : canManageProjects
                    ? lt('Create your first project to get started organizing your work.')
                    : lt('No projects are visible for this account yet.')
            }
            actionLabel={!search && !selectedMember && canManageProjects ? lt('Create project') : undefined}
            onAction={!search && !selectedMember && canManageProjects ? () => setIsCreateOpen(true) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={(nextProject) => void handleOpenEdit(nextProject)}
                onDelete={handleDelete}
                canManage={canManageProjects}
              />
            ))}
          </div>
        )}
      </div>

      {canManageProjects ? (
        <>
          <ProjectFormModal
            open={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onSubmit={handleCreate}
            title={lt('Create project')}
            submitLabel={lt('Create')}
            isSubmitting={isSubmitting}
          />

          <ProjectFormModal
            open={editProject !== null}
            onClose={() => setEditProject(null)}
            onSubmit={handleUpdate}
            initial={editProject}
            title={lt('Edit project')}
            submitLabel={lt('Save changes')}
            isSubmitting={isSubmitting}
          />

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
