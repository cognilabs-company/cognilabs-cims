import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { projectsService, type ProjectRecord, type UserSummary } from '../../../shared/api/services/projects.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { Skeleton } from '../../../shared/ui/skeleton'
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
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user, can } = useAuth()
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

  return (
    <>
      <div className="page-enter flex flex-col gap-[18px]">
        <Card>
          <div className="flex flex-col gap-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="ui-section-title text-[var(--foreground)]">{lt('Members')}</h2>

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
                    {canCreateProject ? (
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
                    ) : null}
                  </>
                ) : undefined}
              </div>
            </div>

            {membersPanelLoading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} rounded="xl" className="h-[84px]" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="rounded-[18px] bg-[var(--muted-surface)] px-4 py-5 text-sm text-[var(--muted)]">
                {lt('Members are not available yet.')}
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => selectMember(null)}
                  className={cn(
                    'flex min-h-[84px] items-center justify-between gap-4 rounded-[18px] px-4 py-4 text-left transition-colors duration-150',
                    selectedMemberId === null
                      ? 'bg-[var(--blue-dim)]'
                      : 'bg-[var(--accent-soft)] hover:bg-[var(--input-surface-hover)]',
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{lt('All members')}</p>
                  </div>
                  <span
                    data-ui-number="true"
                    className={cn(
                      'shrink-0 text-[17px] font-bold tabular-nums',
                      selectedMemberId === null ? 'text-[var(--primary)]' : 'text-[var(--muted-strong)]',
                    )}
                  >
                    {total}
                  </span>
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
                        'flex min-h-[84px] items-center justify-between gap-4 rounded-[18px] px-4 py-4 text-left transition-colors duration-150',
                        isSelected
                          ? 'bg-[var(--blue-dim)]'
                          : 'bg-[var(--accent-soft)] hover:bg-[var(--input-surface-hover)]',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
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

                      <span
                        data-ui-number="true"
                        className={cn(
                          'shrink-0 text-[17px] font-bold tabular-nums',
                          isSelected ? 'text-[var(--primary)]' : 'text-[var(--muted-strong)]',
                        )}
                      >
                        {projectCount}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {selectedMember ? (
          <Card>
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <Avatar
                    name={selectedMember.name}
                    surname={selectedMember.surname}
                    imageUrl={selectedMember.profile_image}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-[20px] font-bold tracking-[-0.02em] text-[var(--foreground)]">
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
                <div className="grid gap-[18px] xl:grid-cols-2">
                  {Array.from({ length: Math.max(selectedMemberProjects.length, 2) }).map((_, index) => (
                    <Skeleton key={index} rounded="xl" className="h-48" />
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
                <div className="grid gap-[18px] xl:grid-cols-2">
                  {memberOverview.projects.map((project) => (
                    <div
                      key={project.projectId}
                      className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={`/projects/${project.projectId}`}
                            className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)] transition-colors hover:text-[var(--primary)]"
                          >
                            {project.projectName}
                          </Link>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" size="sm">{project.boardCount} {lt('boards')}</Badge>
                          <Badge variant={project.taskCount > 0 ? 'warning' : 'secondary'} size="sm">
                            {project.taskCount} {lt('tasks')}
                          </Badge>
                        </div>
                      </div>

                      {project.tasks.length === 0 ? (
                        <p className="mt-4 rounded-[14px] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
                          {lt('This member has no assigned tasks in active boards for this project.')}
                        </p>
                      ) : (
                        <div className="mt-4 space-y-2.5">
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
                                className="block rounded-[14px] bg-[var(--surface)] px-4 py-3 transition-colors hover:bg-[var(--blue-dim)]"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                                      {task.title}
                                    </p>
                                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                                      {task.boardName} - {task.columnName}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {priorityConfig ? (
                                      <Badge variant={priorityConfig.badgeVariant} size="sm">
                                        {priorityConfig.label}
                                      </Badge>
                                    ) : null}
                                    <Badge variant={dueVariant} size="sm">
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
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
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
              className="bg-[var(--surface)] pl-10 hover:bg-[var(--surface)]"
            />
          </div>
          {search ? (
            <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
              {lt('Clear')}
            </Button>
          ) : null}
        </div>

        {projectsQuery.isLoading || isSelectedMemberProjectsLoading ? (
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
