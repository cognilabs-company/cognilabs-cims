import { useEffect, useMemo, useState, useCallback } from 'react'
import { CalendarDays, ChartLine, ChevronLeft, Columns3, History, Paperclip, Pencil, Plus, Send, Trash2, UsersRound } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { Card } from '../../../shared/ui/card'
import { Button } from '../../../shared/ui/button'
import { Badge } from '../../../shared/ui/badge'
import { Input } from '../../../shared/ui/input'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { SelectField } from '../../../shared/ui/select-field'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { StateBlock } from '../../../shared/ui/state-block'
import { Skeleton } from '../../../shared/ui/skeleton'
import { IconButton } from '../../../shared/ui/icon-button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import {
  projectsService,
  type ProjectRecord,
  type BoardRecord,
  type UserSummary,
  type UserOpenCardRecord,
} from '../../../shared/api/services/projects.service'
import { useAuth } from '../../auth/hooks/useAuth'
import { Avatar } from '../components/Avatar'
import { BoardFormModal } from '../components/BoardFormModal'
import { BoardWorkspace } from '../components/BoardWorkspace'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { ProjectAttachmentsModal } from '../components/ProjectAttachmentsModal'
import { formatProjectDate, formatProjectDateTime, isDueDateOverdue } from '../lib/format'
import { KanbanMenu } from '../components/KanbanCard'
import { MembersPicker } from '../components/MembersPicker'
import { ProjectMark } from '../components/ProjectMark'
import { notifyProjectsNavigationChanged } from '../lib/navigationSync'
import { cn } from '../../../shared/lib/cn'
import {
  developerKpiService,
  type Feature,
  type QualityEvent,
  type BlockedPeriod,
  type FeatureStatus,
  type QualityEventSeverity,
  FEATURE_POINTS,
  QUALITY_SEVERITY_OPTIONS,
} from '../../../shared/api/services/developer-kpi.service'

function parseBoardId(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user, can } = useAuth()
  const lt = translateCurrentLiteral
  const { t } = useLocale()
  const id = Number(projectId)
  const canManageProjects = Boolean(user)
  const canCreateProjects = can('projects', 'create')
  const canEditProjects = can('projects', 'edit')
  const canDeleteProjects = can('projects', 'delete')
  // KPI "Add" buttons below only create records (features, quality events, blocked periods).
  const canManageKpi = (user?.role === 'CEO' || user?.role === 'Admin') && can('developer_kpi', 'create')

  const projectQuery = useAsyncData(
    async () => {
      if (!user) {
        throw new Error('User session is unavailable')
      }

      return projectsService.getReadableProjectDetail(id, user.id)
    },
    [id, user?.id],
    { enabled: !Number.isNaN(id) && Boolean(user) },
  )

  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false)
  const [isEditBoardOpen, setIsEditBoardOpen] = useState(false)
  const [editingBoard, setEditingBoard] = useState<BoardRecord | null>(null)
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false)
  const [isProjectSubmitting, setIsProjectSubmitting] = useState(false)
  const [isBoardSubmitting, setIsBoardSubmitting] = useState(false)
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null)
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false)
  const [isKpiOpen, setIsKpiOpen] = useState(false)

  // KPI create form state
  const [showAddFeature, setShowAddFeature] = useState(false)
  const [featureForm, setFeatureForm] = useState({
    title: '', points: '5', ownerId: '', dueDate: '',
    status: 'planned' as FeatureStatus, isMandatory: false, lockNow: false,
    fePct: '0', bePct: '100',
  })
  const [featureSubmitting, setFeatureSubmitting] = useState(false)

  const [showAddQuality, setShowAddQuality] = useState(false)
  const [qualityForm, setQualityForm] = useState({
    employeeId: '', severity: 'functional' as QualityEventSeverity,
    title: '', eventDate: '', confirmed: true, externalCause: false, description: '',
  })
  const [qualitySubmitting, setQualitySubmitting] = useState(false)

  const [showAddBlocked, setShowAddBlocked] = useState(false)
  const [blockedForm, setBlockedForm] = useState({
    employeeId: '', featureId: '', startedAt: '', endedAt: '',
    reason: '', isExternal: false, dependency: '',
  })
  const [blockedSubmitting, setBlockedSubmitting] = useState(false)

  const project = projectQuery.data

  const selectedBoardId = parseBoardId(searchParams.get('board'))
  const selectedBoardParam = searchParams.get('board')
  const activeBoards = project?.boards.filter((board) => !board.is_archived) ?? []
  const allBoards = project?.boards ?? []
  const selectedBoard =
    allBoards.find((board) => board.id === selectedBoardId) ??
    activeBoards[0] ??
    allBoards[0] ??
    null

  const projectMembers = useMemo(() => {
    if (!project) {
      return []
    }

    const membersById = new Map<number, UserSummary>()

    for (const member of project.members) {
      if (member.id > 0 && !membersById.has(member.id)) {
        membersById.set(member.id, member)
      }
    }

    return Array.from(membersById.values())
  }, [project])

  const expandedMember = useMemo(
    () => projectMembers.find((member) => member.id === expandedMemberId) ?? null,
    [expandedMemberId, projectMembers],
  )

  const expandedMemberTasksQuery = useAsyncData(
    async () => {
      if (expandedMemberId === null) {
        return [] as UserOpenCardRecord[]
      }

      const response = await projectsService.listUserOpenCards(expandedMemberId, id)
      return response.cards
    },
    [expandedMemberId, id],
    { enabled: expandedMemberId !== null && !Number.isNaN(id) },
  )

  const kpiFeaturesQuery = useAsyncData(
    async () => developerKpiService.listFeatures({ project_id: id }),
    [id, isKpiOpen],
    { enabled: isKpiOpen && !Number.isNaN(id) },
  )
  const kpiFeatures: Feature[] = Array.isArray(kpiFeaturesQuery.data) ? kpiFeaturesQuery.data : []

  const kpiQualityQuery = useAsyncData(
    async () => developerKpiService.listQualityEvents({ project_id: id }),
    [id, isKpiOpen],
    { enabled: isKpiOpen && !Number.isNaN(id) },
  )
  const kpiQualityEvents: QualityEvent[] = Array.isArray(kpiQualityQuery.data) ? kpiQualityQuery.data : []

  const kpiBlockedQuery = useAsyncData(
    async () => developerKpiService.listBlockedPeriods({ project_id: id }),
    [id, isKpiOpen],
    { enabled: isKpiOpen && !Number.isNaN(id) },
  )
  const kpiBlockedPeriods: BlockedPeriod[] = Array.isArray(kpiBlockedQuery.data) ? kpiBlockedQuery.data : []

  const expandedMemberTasks = useMemo(() => {
    if (expandedMemberId === null) {
      return []
    }

    const cards = expandedMemberTasksQuery.data ?? []

    return [...cards]
      .filter((card) => card.project_id === id)
      .sort((left, right) => {
        if (left.due_date && right.due_date) {
          return left.due_date.localeCompare(right.due_date)
        }

        if (left.due_date) {
          return -1
        }

        if (right.due_date) {
          return 1
        }

        return right.updated_at.localeCompare(left.updated_at)
      })
  }, [expandedMemberId, expandedMemberTasksQuery.data, id])

  const isExpandedMemberTasksLoading = expandedMemberId !== null && expandedMemberTasksQuery.isLoading

  useEffect(() => {
    if (!project) {
      return
    }

    const nextBoardParam = selectedBoard ? String(selectedBoard.id) : null

    if ((selectedBoardParam ?? null) === nextBoardParam) {
      return
    }

    setSearchParams((current) => {
      const nextSearchParams = new URLSearchParams(current)

      if (nextBoardParam === null) {
        nextSearchParams.delete('board')
      } else {
        nextSearchParams.set('board', nextBoardParam)
      }

      return nextSearchParams
    }, { replace: true })
  }, [project, selectedBoard, selectedBoardParam, setSearchParams])

  useEffect(() => {
    if (projectMembers.length === 0) {
      if (expandedMemberId !== null) {
        setExpandedMemberId(null)
      }
      return
    }
  }, [expandedMemberId, projectMembers])

  function selectBoard(boardIdToSelect: number | null) {
    const nextBoardParam = boardIdToSelect === null ? null : String(boardIdToSelect)

    if ((selectedBoardParam ?? null) === nextBoardParam) {
      return
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current)

      if (boardIdToSelect === null) {
        next.delete('board')
      } else {
        next.set('board', String(boardIdToSelect))
      }

      return next
    }, { replace: true })
  }

  function selectMember(memberId: number) {
    setExpandedMemberId((prev) => prev === memberId ? null : memberId)
  }

  async function handleUpdateProject(fd: FormData, telegramGroupId?: string | null) {
    if (!canEditProjects || !project) {
      return
    }

    setIsProjectSubmitting(true)
    try {
      await projectsService.updateProject(project.id, fd)
      if (telegramGroupId !== undefined) {
        await projectsService.updateProjectTelegramGroup(project.id, telegramGroupId)
      }
      showToast({ title: lt('Project updated'), tone: 'success' })
      setIsEditProjectOpen(false)
      await projectQuery.refetch()
      notifyProjectsNavigationChanged()
    } catch {
      showToast({ title: lt('Failed to update project'), tone: 'error' })
    } finally {
      setIsProjectSubmitting(false)
    }
  }

  async function handleDeleteProject() {
    if (!canDeleteProjects || !project) {
      return
    }

    const ok = await confirm({
      title: lt('Delete project?'),
      description: `"${project.project_name}" ${lt('and all its boards will be permanently deleted.')}`,
      tone: 'danger',
    })

    if (!ok) {
      return
    }

    try {
      await projectsService.deleteProject(project.id)
      showToast({ title: lt('Project deleted'), tone: 'success' })
      notifyProjectsNavigationChanged()
      navigate('/projects')
    } catch {
      showToast({ title: lt('Failed to delete project'), tone: 'error' })
    }
  }

  async function handleDeleteBoard(boardId: number, boardName: string) {
    if (!canDeleteProjects) return

    const ok = await confirm({
      title: lt('Delete board?'),
      description: `"${boardName}" ${lt('will be permanently deleted.')}`,
      tone: 'danger',
    })

    if (!ok) return

    try {
      if (selectedBoard?.id === boardId) {
        const otherBoard = activeBoards.find((b) => b.id !== boardId)
        selectBoard(otherBoard?.id ?? null)
      }
      await projectsService.deleteBoard(boardId)
      showToast({ title: lt('Board deleted'), tone: 'success' })
      await projectQuery.refetch()
      notifyProjectsNavigationChanged()
    } catch {
      showToast({ title: lt('Failed to delete board'), tone: 'error' })
    }
  }

  async function handleCreateBoard(values: { name: string; description?: string }) {
    if (!canCreateProjects || !project) {
      return
    }

    setIsBoardSubmitting(true)
    try {
      const createdBoard = await projectsService.createBoard(project.id, values)
      showToast({ title: lt('Board created'), tone: 'success' })
      setIsCreateBoardOpen(false)
      await projectQuery.refetch()
      selectBoard(createdBoard.id)
      notifyProjectsNavigationChanged()
    } catch {
      showToast({ title: lt('Failed to create board'), tone: 'error' })
    } finally {
      setIsBoardSubmitting(false)
    }
  }

  async function handleUpdateBoard(values: { name: string; description?: string }) {
    if (!canEditProjects || !editingBoard) return

    setIsBoardSubmitting(true)
    try {
      await projectsService.updateBoard(editingBoard.id, values)
      showToast({ title: lt('Board updated'), tone: 'success' })
      setIsEditBoardOpen(false)
      setEditingBoard(null)
      await projectQuery.refetch()
      notifyProjectsNavigationChanged()
    } catch {
      showToast({ title: lt('Failed to update board'), tone: 'error' })
    } finally {
      setIsBoardSubmitting(false)
    }
  }

  const handleAddFeature = useCallback(async () => {
    if (!featureForm.title || !featureForm.ownerId) return
    setFeatureSubmitting(true)
    try {
      await developerKpiService.createFeature({
        project_id: id,
        title: featureForm.title,
        points: Number(featureForm.points),
        owner_id: Number(featureForm.ownerId),
        due_date: featureForm.dueDate || undefined,
        status: featureForm.status,
        is_mandatory: featureForm.isMandatory,
        lock_now: featureForm.lockNow,
        frontend_percent: Number(featureForm.fePct),
        backend_percent: Number(featureForm.bePct),
      })
      showToast({ tone: 'success', title: 'Feature added' })
      setShowAddFeature(false)
      setFeatureForm({ title: '', points: '5', ownerId: '', dueDate: '', status: 'planned', isMandatory: false, lockNow: false, fePct: '0', bePct: '100' })
      await kpiFeaturesQuery.refetch()
    } catch {
      showToast({ tone: 'error', title: 'Failed to add feature' })
    } finally {
      setFeatureSubmitting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureForm, id])

  const handleAddQuality = useCallback(async () => {
    if (!qualityForm.employeeId || !qualityForm.title || !qualityForm.eventDate) return
    setQualitySubmitting(true)
    try {
      await developerKpiService.createQualityEvent({
        project_id: id,
        employee_id: Number(qualityForm.employeeId),
        severity: qualityForm.severity,
        title: qualityForm.title,
        event_date: qualityForm.eventDate,
        confirmed: qualityForm.confirmed,
        external_cause: qualityForm.externalCause,
        description: qualityForm.description || undefined,
      })
      showToast({ tone: 'success', title: 'Quality event added' })
      setShowAddQuality(false)
      setQualityForm({ employeeId: '', severity: 'functional', title: '', eventDate: '', confirmed: true, externalCause: false, description: '' })
      await kpiQualityQuery.refetch()
    } catch {
      showToast({ tone: 'error', title: 'Failed to add quality event' })
    } finally {
      setQualitySubmitting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityForm, id])

  const handleAddBlocked = useCallback(async () => {
    if (!blockedForm.employeeId || !blockedForm.startedAt || !blockedForm.reason) return
    setBlockedSubmitting(true)
    try {
      await developerKpiService.createBlockedPeriod({
        project_id: id,
        employee_id: Number(blockedForm.employeeId),
        feature_id: blockedForm.featureId ? Number(blockedForm.featureId) : undefined,
        started_at: blockedForm.startedAt,
        ended_at: blockedForm.endedAt || undefined,
        reason: blockedForm.reason,
        is_external: blockedForm.isExternal,
        dependency: blockedForm.dependency || undefined,
      })
      showToast({ tone: 'success', title: 'Blocked period added' })
      setShowAddBlocked(false)
      setBlockedForm({ employeeId: '', featureId: '', startedAt: '', endedAt: '', reason: '', isExternal: false, dependency: '' })
      await kpiBlockedQuery.refetch()
    } catch {
      showToast({ tone: 'error', title: 'Failed to add blocked period' })
    } finally {
      setBlockedSubmitting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockedForm, id])

  const tabBoards = selectedBoard?.is_archived ? [...activeBoards, selectedBoard] : activeBoards
  const deadlineOverdue = project?.deadline ? isDueDateOverdue(project.deadline) : false

  /** The project's boards as underlined tabs; the selected one carries its menu, "+" adds a board. */
  const boardTabs = (
    <div className="no-scrollbar flex h-[52px] items-stretch gap-0.5 overflow-x-auto" role="tablist" aria-label={lt('Boards')}>
      {tabBoards.map((board) => {
        const isSelected = selectedBoard?.id === board.id
        const boardActions = [
          ...(canEditProjects ? [{ label: lt('Edit'), onSelect: () => { setEditingBoard(board); setIsEditBoardOpen(true) } }] : []),
          ...(canDeleteProjects ? [{ label: lt('Delete'), tone: 'danger' as const, onSelect: () => void handleDeleteBoard(board.id, board.name) }] : []),
        ]
        return (
          <div key={board.id} className="relative flex shrink-0 items-center">
            <button
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => selectBoard(board.id)}
              className={cn(
                'flex h-9 items-center gap-2 rounded-[9px] px-3 text-[13px] whitespace-nowrap transition-colors',
                isSelected
                  ? 'font-semibold text-[var(--foreground)]'
                  : 'font-medium text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
              )}
            >
              {board.name}
              {board.is_archived ? <span className="text-[11px] font-medium text-[var(--caption)]">{lt('Archived')}</span> : null}
            </button>
            {isSelected && boardActions.length > 0 ? (
              <KanbanMenu label={lt('Board actions')} items={boardActions} className="-ml-2 h-7 w-7 rounded-[8px]" />
            ) : null}
            {isSelected ? <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--foreground)]" /> : null}
          </div>
        )
      })}
      {canCreateProjects ? (
        <IconButton label={t('projects.add_board', 'Add board')} size="sm" onClick={() => setIsCreateBoardOpen(true)} className="ml-0.5 self-center">
          <Plus size={16} strokeWidth={2} />
        </IconButton>
      ) : null}
    </div>
  )

  if (projectQuery.isLoading) {
    return (
      <div className="flex h-[calc(100dvh-132px)] flex-col gap-4 lg:h-[var(--page-h)]">
        <Skeleton rounded="full" className="h-3.5 w-24" />
        <div className="flex items-center gap-3.5">
          <Skeleton rounded="lg" className="h-12 w-12" />
          <div className="flex-1">
            <Skeleton rounded="full" className="h-6 w-64 max-w-full" />
            <Skeleton rounded="full" className="mt-2 h-3.5 w-48" />
          </div>
        </div>
        <Skeleton rounded="xl" className="min-h-0 flex-1 rounded-[20px]" />
      </div>
    )
  }

  if (projectQuery.isError || !project) {
    return (
      <StateBlock
        tone="error"
        eyebrow={lt('Error')}
        title={lt('Failed to load project')}
        description={lt('The project could not be found or loaded.')}
        actionLabel={lt('Back to projects')}
        onAction={() => navigate('/projects')}
      />
    )
  }

  return (
    <>
      <div className="relative flex h-[calc(100dvh-132px)] flex-col gap-4 lg:h-[var(--page-h)]">
        {/* Header: back link, the project's mark, name and facts; people, files and the menu on the right */}
        <header className="flex shrink-0 flex-col gap-3">
          <Link
            to="/projects"
            className="inline-flex w-fit items-center gap-0.5 text-[12.5px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            <ChevronLeft size={15} strokeWidth={2} />
            {lt('Projects')}
          </Link>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <ProjectMark projectId={project.id} name={project.project_name} image={project.image} size={52} />
              <div className="min-w-0">
                <h1 title={project.project_name} className="truncate text-[22px] leading-7 font-semibold tracking-[-0.025em] text-[var(--foreground)] sm:text-[24px] sm:leading-8">
                  {project.project_name}
                </h1>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-[var(--muted)]">
                  {project.team ? (
                    <span className="inline-flex items-center gap-1.5">
                      <UsersRound size={13} strokeWidth={2} />
                      {project.team.name}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Columns3 size={13} strokeWidth={2} />
                    {t('projects.boards_n', '{{count}} boards', { count: activeBoards.length })}
                  </span>
                  {project.deadline ? (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <CalendarDays size={13} strokeWidth={2} />
                      {deadlineOverdue
                        ? t('projects.overdue_on', 'Overdue · {{date}}', { date: formatProjectDate(project.deadline) })
                        : t('projects.due_on', 'Due {{date}}', { date: formatProjectDate(project.deadline) })}
                    </span>
                  ) : null}
                  {project.telegram_group_id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Send size={13} strokeWidth={2} />
                      {t('projects.telegram_connected', 'Telegram connected')}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {canManageProjects ? (
              <div className="flex shrink-0 items-center gap-2">
                {projectMembers.length > 0 ? (
                  <MembersPicker
                    members={projectMembers}
                    label={t('projects.members_label', 'Members')}
                    fallbackRole={t('projects.member_role', 'Member')}
                    onSelect={selectMember}
                  />
                ) : null}
                <Button variant="secondary" size="sm" className="h-9" onClick={() => setIsAttachmentsOpen(true)} leftIcon={<Paperclip size={14} strokeWidth={2} />}>
                  {lt('Attachments')}
                </Button>
                <ActionsMenu
                  label={t('projects.actions', 'Actions')}
                  className="border border-[var(--border-hover)] bg-[var(--surface)]"
                  items={[
                    { label: t('projects.project_kpi', 'Project KPI'), icon: <ChartLine size={15} strokeWidth={2} />, onSelect: () => setIsKpiOpen(true) },
                    { label: t('projects.history', 'History'), icon: <History size={15} strokeWidth={2} />, onSelect: () => navigate(`/audit/logs?entity_type=Project&entity_id=${project.id}`) },
                    ...(canEditProjects ? [{ label: lt('Edit'), icon: <Pencil size={15} strokeWidth={2} />, onSelect: () => setIsEditProjectOpen(true) }] : []),
                    ...(canDeleteProjects ? [{ label: lt('Delete'), tone: 'danger' as const, icon: <Trash2 size={15} strokeWidth={2} />, onSelect: handleDeleteProject }] : []),
                  ]}
                />
              </div>
            ) : null}
          </div>
        </header>

        {/* The board: tabs + toolbar, then the kanban */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-[var(--card)] ring-1 ring-[var(--border)]">
          {selectedBoard ? (
            <BoardWorkspace
              boardId={selectedBoard.id}
              projectId={project.id}
              mode="embedded"
              onBoardsChanged={() => projectQuery.refetch()}
              toolbarStart={boardTabs}
            />
          ) : (
            <>
              <div className="flex h-[52px] shrink-0 items-center border-b border-[var(--border)] pr-3 pl-1.5 sm:pl-2.5">{boardTabs}</div>
              <div className="grid min-h-0 flex-1 place-items-center p-8 sm:p-12">
                <StateBlock
                  tone="empty"
                  eyebrow={lt('No boards')}
                  title={lt('Select or create a board')}
                  description={lt('Choose a board from the list above to start managing tasks.')}
                  actionLabel={canCreateProjects ? t('projects.add_board', 'Add board') : undefined}
                  onAction={canCreateProjects ? () => setIsCreateBoardOpen(true) : undefined}
                />
              </div>
            </>
          )}
        </section>

        {/* Member Tasks Panel (Centered Overlay with Backdrop) */}
        {expandedMember && expandedMemberId !== null && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
              {/* Backdrop */}
              <button
                 className="dialog-backdrop absolute inset-0 cursor-default"
                 onClick={() => setExpandedMemberId(null)}
              />

              {/* Center Modal */}
              <Card noPadding className="modal-pop relative z-10 w-full max-w-[760px] overflow-hidden rounded-[20px] shadow-[var(--elev-xl)] ring-1 ring-[var(--border)]">
                 <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
                    <div className="flex items-center gap-4">
                       <Avatar name={expandedMember.name} surname={expandedMember.surname} imageUrl={expandedMember.profile_image} size="md" className="ring-2 ring-[var(--blue-dim)]" />
                       <div>
                          <p className="text-[16px] font-semibold tracking-[-0.015em] text-[var(--foreground)]">{expandedMember.name} {expandedMember.surname}</p>
                          <p className="mt-1 text-[12.5px] font-medium text-[var(--muted)]">{expandedMember.job_title || lt('Member')}</p>
                       </div>
                    </div>
                    <IconButton size="md" label={lt('Close Dashboard')} onClick={() => setExpandedMemberId(null)}>
                       <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/></svg>
                    </IconButton>
                 </div>

                 <div className="max-h-[70vh] overflow-y-auto p-5 custom-scrollbar-visible boards-section">
                    <div className="mb-[18px] flex items-center justify-between">
                       <h4 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{lt('Active Tasks Assignment')}</h4>
                       <Badge variant="blue">{expandedMemberTasks.length} {lt('Items')}</Badge>
                    </div>

                    {isExpandedMemberTasksLoading ? (
                       <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
                          {[1,2,3,4].map(i => <Skeleton key={i} rounded="xl" className="h-32" />)}
                       </div>
                    ) : expandedMemberTasks.length === 0 ? (
                       <div className="flex flex-col items-center justify-center rounded-[18px] bg-[var(--muted-surface)] py-16">
                          <svg viewBox="0 0 24 24" className="mb-5 h-14 w-14 text-[var(--control-border)]" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M12 22c5.523 0 9-4.477 9-10S17.523 2 12 2 3 6.477 3 12s3.477 10 9 10z"/><path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round"/></svg>
                          <p className="text-sm font-medium text-[var(--muted)]">{lt('No active tasks')}</p>
                       </div>
                    ) : (
                       <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
                          {expandedMemberTasks.map(task => (
                             <Link
                                key={task.id}
                                to={`/projects/${project.id}?board=${task.board_id}`}
                                onClick={() => setExpandedMemberId(null)}
                                className="group flex flex-col justify-between rounded-[18px] bg-[var(--accent-soft)] p-[18px] transition-colors hover:bg-[var(--blue-dim)]"
                             >
                                <div className="mb-4">
                                   <div className="mb-2 flex items-center gap-2">
                                      <span className="text-[12.5px] font-medium text-[var(--blue-text)]">{task.board_name}</span>
                                      <span className="text-[var(--border-hover)]">•</span>
                                      <span className="text-[12.5px] font-medium text-[var(--muted)]">{task.column_name}</span>
                                   </div>
                                   <p className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-[var(--foreground)]">
                                      {task.title}
                                   </p>
                                </div>
                                <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                                   <Badge variant="blue" size="sm" dot>{lt('Priority High')}</Badge>
                                   <div className="flex flex-col items-end gap-1 text-[11.5px] font-medium text-[var(--muted)]">
                                      {task.due_date ? (
                                        <div className="flex items-center gap-1.5 text-[var(--muted-strong)]">
                                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                            <path d="M16 2v4" />
                                            <path d="M8 2v4" />
                                            <path d="M3 10h18" />
                                          </svg>
                                          {formatProjectDateTime(task.due_date)}
                                        </div>
                                      ) : null}
                                      <div className="flex items-center gap-1.5">
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                          <circle cx="12" cy="12" r="10" />
                                          <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        {formatProjectDate(task.updated_at)}
                                      </div>
                                   </div>
                                </div>
                             </Link>
                          ))}
                       </div>
                    )}
                 </div>
                 
                 <div className="flex justify-end border-t border-[var(--border)] p-[22px]">
                    <Button variant="secondary" onClick={() => setExpandedMemberId(null)}>
                       {lt('Close Dashboard')}
                    </Button>
                 </div>
              </Card>
           </div>
        )}
      </div>

      {/* Project KPI Modal */}
      {isKpiOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
          <button
            className="dialog-backdrop absolute inset-0 cursor-default"
            onClick={() => setIsKpiOpen(false)}
          />
          <Card noPadding className="modal-pop relative z-10 w-full max-w-[760px] overflow-hidden rounded-[20px] shadow-[var(--elev-xl)] ring-1 ring-[var(--border)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">Developer KPI</p>
                <p className="mt-0.5 text-[16px] font-semibold tracking-[-0.015em] text-[var(--foreground)]">{project.project_name}</p>
              </div>
              <IconButton size="md" label="Close" onClick={() => setIsKpiOpen(false)}>
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/></svg>
              </IconButton>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-5 space-y-4">
              {/* Features */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="ui-section-title text-[var(--foreground)]">Features</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="blue">{kpiFeatures.length}</Badge>
                    {canManageKpi && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowAddFeature((v) => !v)}
                        leftIcon={<svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                </div>

                {showAddFeature && canManageKpi && (
                  <div className="mb-[18px] rounded-[18px] bg-[var(--accent-soft)] p-[18px] space-y-3">
                    <p className="ui-eyebrow">New Feature</p>
                    <Input
                      placeholder="Title *"
                      value={featureForm.title}
                      onChange={(e) => setFeatureForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Owner *</p>
                        <SelectField
                          value={featureForm.ownerId}
                          options={projectMembers.map((m) => ({ value: String(m.id), label: `${m.name} ${m.surname}` }))}
                          onValueChange={(v) => setFeatureForm((f) => ({ ...f, ownerId: v }))}
                          placeholder="Select owner"
                          searchable
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Points</p>
                        <SelectField
                          value={featureForm.points}
                          options={FEATURE_POINTS.map((p) => ({ value: String(p), label: String(p) }))}
                          onValueChange={(v) => setFeatureForm((f) => ({ ...f, points: v }))}
                          placeholder="Points"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Status</p>
                        <SelectField
                          value={featureForm.status}
                          options={[
                            { value: 'planned', label: 'Planned' },
                            { value: 'in_progress', label: 'In Progress' },
                            { value: 'completed', label: 'Completed' },
                          ]}
                          onValueChange={(v) => setFeatureForm((f) => ({ ...f, status: v as FeatureStatus }))}
                          placeholder="Status"
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Due Date</p>
                        <CalendarField value={featureForm.dueDate} onValueChange={(value) => setFeatureForm((f) => ({ ...f, dueDate: value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">FE %</p>
                        <Input
                          type="number"
                          min="0" max="100"
                          value={featureForm.fePct}
                          onChange={(e) => setFeatureForm((f) => ({ ...f, fePct: e.target.value }))}
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">BE %</p>
                        <Input
                          type="number"
                          min="0" max="100"
                          value={featureForm.bePct}
                          onChange={(e) => setFeatureForm((f) => ({ ...f, bePct: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                        <Checkbox
                          size="sm"
                          checked={featureForm.isMandatory}
                          onChange={(e) => setFeatureForm((f) => ({ ...f, isMandatory: e.target.checked }))}
                        />
                        Mandatory
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                        <Checkbox
                          size="sm"
                          checked={featureForm.lockNow}
                          onChange={(e) => setFeatureForm((f) => ({ ...f, lockNow: e.target.checked }))}
                        />
                        Lock now
                      </label>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!featureForm.title || !featureForm.ownerId || featureSubmitting}
                        onClick={handleAddFeature}
                      >
                        {featureSubmitting ? 'Saving…' : 'Save Feature'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddFeature(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {kpiFeaturesQuery.isLoading || kpiFeaturesQuery.status === 'idle' ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} rounded="lg" className="h-12" />)}</div>
                ) : kpiFeatures.length === 0 ? (
                  <p className="rounded-[18px] bg-[var(--muted-surface)] px-4 py-3 text-sm text-[var(--muted)]">No features for this project.</p>
                ) : (
                  <div className="space-y-2">
                    {kpiFeatures.map(f => (
                      <div key={f.id} className="flex items-center justify-between rounded-[14px] bg-[var(--muted-surface)] px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{f.title}</p>
                          <p className="text-[12.5px] text-[var(--muted)]">{f.status}{f.due_date ? ` · due ${f.due_date.slice(0,10)}` : ''}</p>
                        </div>
                        <div className="ml-4 flex shrink-0 items-center gap-2">
                          <Badge variant={f.status === 'accepted' ? 'success' : f.status === 'completed' ? 'blue' : 'outline'}>{f.points}pts</Badge>
                          {f.is_mandatory ? <Badge variant="warning">mandatory</Badge> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quality Events */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="ui-section-title text-[var(--foreground)]">Quality Events</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={kpiQualityEvents.length > 0 ? 'danger' : 'outline'}>{kpiQualityEvents.length}</Badge>
                    {canManageKpi && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setShowAddQuality((v) => !v)}
                        leftIcon={<svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                </div>

                {showAddQuality && canManageKpi && (
                  <div className="mb-[18px] rounded-[18px] bg-[var(--danger-dim)] p-[18px] space-y-3">
                    <p className="ui-eyebrow">New Quality Event</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Employee *</p>
                        <SelectField
                          value={qualityForm.employeeId}
                          options={projectMembers.map((m) => ({ value: String(m.id), label: `${m.name} ${m.surname}` }))}
                          onValueChange={(v) => setQualityForm((f) => ({ ...f, employeeId: v }))}
                          placeholder="Select employee"
                          searchable
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Severity</p>
                        <SelectField
                          value={qualityForm.severity}
                          options={QUALITY_SEVERITY_OPTIONS}
                          onValueChange={(v) => setQualityForm((f) => ({ ...f, severity: v as QualityEventSeverity }))}
                          placeholder="Severity"
                        />
                      </div>
                    </div>
                    <Input
                      placeholder="Title *"
                      value={qualityForm.title}
                      onChange={(e) => setQualityForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <div>
                      <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Event Date *</p>
                      <CalendarField value={qualityForm.eventDate} required onValueChange={(value) => setQualityForm((f) => ({ ...f, eventDate: value }))} />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                        <Checkbox
                          size="sm"
                          checked={qualityForm.confirmed}
                          onChange={(e) => setQualityForm((f) => ({ ...f, confirmed: e.target.checked }))}
                        />
                        Confirmed
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                        <Checkbox
                          size="sm"
                          checked={qualityForm.externalCause}
                          onChange={(e) => setQualityForm((f) => ({ ...f, externalCause: e.target.checked }))}
                        />
                        External cause
                      </label>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!qualityForm.employeeId || !qualityForm.title || !qualityForm.eventDate || qualitySubmitting}
                        onClick={handleAddQuality}
                      >
                        {qualitySubmitting ? 'Saving…' : 'Save Event'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddQuality(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {kpiQualityQuery.isLoading || kpiQualityQuery.status === 'idle' ? (
                  <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} rounded="lg" className="h-12" />)}</div>
                ) : kpiQualityEvents.length === 0 ? (
                  <p className="rounded-[18px] bg-[var(--muted-surface)] px-4 py-3 text-sm text-[var(--muted)]">No quality events for this project.</p>
                ) : (
                  <div className="space-y-2">
                    {kpiQualityEvents.map(e => (
                      <div key={e.id} className="flex items-center justify-between rounded-[14px] bg-[var(--danger-dim)] px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{e.title}</p>
                          <p className="text-[12.5px] text-[var(--muted)]">{e.severity} · {e.event_date.slice(0,10)}</p>
                        </div>
                        <Badge variant={e.confirmed ? 'danger' : 'outline'}>{e.confirmed ? 'confirmed' : 'pending'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Blocked Periods */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="ui-section-title text-[var(--foreground)]">Blocked Periods</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{kpiBlockedPeriods.length}</Badge>
                    {canManageKpi && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowAddBlocked((v) => !v)}
                        leftIcon={<svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                </div>

                {showAddBlocked && canManageKpi && (
                  <div className="mb-[18px] rounded-[18px] bg-[var(--warning-dim)] p-[18px] space-y-3">
                    <p className="ui-eyebrow">New Blocked Period</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Employee *</p>
                        <SelectField
                          value={blockedForm.employeeId}
                          options={projectMembers.map((m) => ({ value: String(m.id), label: `${m.name} ${m.surname}` }))}
                          onValueChange={(v) => setBlockedForm((f) => ({ ...f, employeeId: v }))}
                          placeholder="Select employee"
                          searchable
                        />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Feature (optional)</p>
                        <SelectField
                          value={blockedForm.featureId}
                          options={[{ value: '', label: 'None' }, ...kpiFeatures.map((feat) => ({ value: String(feat.id), label: feat.title }))]}
                          onValueChange={(v) => setBlockedForm((f) => ({ ...f, featureId: v }))}
                          placeholder="No feature"
                          searchable
                        />
                      </div>
                    </div>
                    <Input
                      placeholder="Reason *"
                      value={blockedForm.reason}
                      onChange={(e) => setBlockedForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Started At *</p>
                        <CalendarField mode="datetime" value={blockedForm.startedAt} required onValueChange={(value) => setBlockedForm((f) => ({ ...f, startedAt: value }))} />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[13px] font-medium text-[var(--muted-strong)]">Ended At</p>
                        <CalendarField mode="datetime" value={blockedForm.endedAt} onValueChange={(value) => setBlockedForm((f) => ({ ...f, endedAt: value }))} />
                      </div>
                    </div>
                    <Input
                      placeholder="Dependency (e.g. Client, DevOps)"
                      value={blockedForm.dependency}
                      onChange={(e) => setBlockedForm((f) => ({ ...f, dependency: e.target.value }))}
                    />
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                      <Checkbox
                        size="sm"
                        checked={blockedForm.isExternal}
                        onChange={(e) => setBlockedForm((f) => ({ ...f, isExternal: e.target.checked }))}
                      />
                      External blocker
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!blockedForm.employeeId || !blockedForm.startedAt || !blockedForm.reason || blockedSubmitting}
                        onClick={handleAddBlocked}
                      >
                        {blockedSubmitting ? 'Saving…' : 'Save Period'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddBlocked(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {kpiBlockedQuery.isLoading || kpiBlockedQuery.status === 'idle' ? (
                  <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} rounded="lg" className="h-12" />)}</div>
                ) : kpiBlockedPeriods.length === 0 ? (
                  <p className="rounded-[18px] bg-[var(--muted-surface)] px-4 py-3 text-sm text-[var(--muted)]">No blocked periods for this project.</p>
                ) : (
                  <div className="space-y-2">
                    {kpiBlockedPeriods.map(b => (
                      <div key={b.id} className="flex items-center justify-between rounded-[14px] bg-[var(--warning-dim)] px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{b.reason}</p>
                          <p className="text-[12.5px] text-[var(--muted)]">{b.started_at.slice(0,10)}{b.ended_at ? ` → ${b.ended_at.slice(0,10)}` : ' (ongoing)'}</p>
                        </div>
                        <Badge variant={b.approval_status === 'approved' ? 'success' : b.approval_status === 'rejected' ? 'danger' : 'warning'}>{b.approval_status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-[var(--border)] p-[22px]">
              <Button variant="secondary" onClick={() => setIsKpiOpen(false)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ProjectAttachmentsModal
        open={isAttachmentsOpen}
        onClose={() => setIsAttachmentsOpen(false)}
        projectId={project.id}
        canUpload={canCreateProjects}
        canDelete={canDeleteProjects}
      />

      {canEditProjects ? (
        <>
          <ProjectFormModal
            open={isEditProjectOpen}
            onClose={() => setIsEditProjectOpen(false)}
            onSubmit={handleUpdateProject}
            initial={project as ProjectRecord}
            title={lt('Edit project')}
            submitLabel={lt('Save changes')}
            isSubmitting={isProjectSubmitting}
          />
          <BoardFormModal
            open={isEditBoardOpen}
            onClose={() => setIsEditBoardOpen(false)}
            onSubmit={handleUpdateBoard}
            initial={editingBoard}
            title={lt('Edit board')}
            submitLabel={lt('Save changes')}
            isSubmitting={isBoardSubmitting}
          />
        </>
      ) : null}

      {canCreateProjects ? (
        <BoardFormModal
          open={isCreateBoardOpen}
          onClose={() => setIsCreateBoardOpen(false)}
          onSubmit={handleCreateBoard}
          title={lt('Create board')}
          submitLabel={lt('Create')}
          isSubmitting={isBoardSubmitting}
        />
      ) : null}
    </>
  )
}
