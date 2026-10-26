import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { Card } from '../../../shared/ui/card'
import { Button } from '../../../shared/ui/button'
import { Badge } from '../../../shared/ui/badge'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { StateBlock } from '../../../shared/ui/state-block'
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
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { useAuth } from '../../auth/hooks/useAuth'
import { Avatar } from '../components/Avatar'
import { BoardFormModal } from '../components/BoardFormModal'
import { BoardWorkspace } from '../components/BoardWorkspace'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { ProjectAttachmentsModal } from '../components/ProjectAttachmentsModal'
import { formatProjectDate, formatProjectDateTime } from '../lib/format'
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
  const { user } = useAuth()
  const lt = translateCurrentLiteral
  const locale = getIntlLocale()
  const tr = (key: string, uzFallback: string, ruFallback: string) => {
    const value = lt(key)

    if (value !== key) {
      return value
    }

    if (locale.startsWith('ru')) {
      return ruFallback
    }

    if (locale.startsWith('en')) {
      return key
    }

    return uzFallback
  }

  const id = Number(projectId)
  const canManageProjects = Boolean(user)
  const canManageKpi = user?.role === 'CEO' || user?.role === 'Admin'

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
  const projectImage = resolveMediaUrl(project?.image) ?? project?.image ?? null

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
    if (!canManageProjects || !project) {
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
    if (!canManageProjects || !project) {
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
    if (!canManageProjects) return

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
    if (!canManageProjects || !project) {
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
    if (!canManageProjects || !editingBoard) return

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

  if (projectQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4 page-enter">
        <div className="h-48 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]"
            />
          ))}
        </div>
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
      <div className="relative flex flex-col gap-4 sm:gap-4 page-enter h-[calc(100vh-100px)] sm:h-[calc(100vh-120px)] overflow-hidden">
        {/* Background Project Header (Jira Style) - More compact on mobile */}
        <div className="relative shrink-0 overflow-hidden rounded-xl sm:rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 sm:p-6 shadow-sm">
          <div className="page-header-decor pointer-events-none absolute inset-x-0 top-0 h-32 sm:h-40 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_72%)]" />

          <div className="relative z-10 flex flex-col gap-4 sm:gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                {projectImage ? (
                  <img
                    src={projectImage}
                    alt={project.project_name}
                    className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl border border-[var(--border)] object-cover shadow-md"
                  />
                ) : (
                  <div
                    className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-lg sm:text-xl font-black"
                    style={{
                      background: `hsl(${project.project_name.charCodeAt(0) * 7 % 360}, 45%, 18%)`,
                      color: `hsl(${project.project_name.charCodeAt(0) * 7 % 360}, 65%, 65%)`,
                    }}
                  >
                    {project.project_name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--foreground)] truncate">
                    {project.project_name}
                  </h1>
                  {project.team || project.deadline || project.telegram_group_id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {project.team ? <Badge variant="blue">{project.team.name}</Badge> : null}
                      {project.deadline ? <Badge variant="outline">Deadline: {formatProjectDateTime(project.deadline)}</Badge> : null}
                      {project.telegram_group_id ? <Badge variant="outline">Telegram connected</Badge> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {canManageProjects ? (
                <div className="flex shrink-0 items-center gap-2 sm:mt-0">
                  <ActionsMenu
                    triggerVariant="button"
                    label={lt('Actions')}
                    items={[
                      {
                        label: lt('History'),
                        icon: (
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7.5 1.5C4.18629 1.5 1.5 4.18629 1.5 7.5C1.5 10.8137 4.18629 13.5 7.5 13.5C10.8137 13.5 13.5 10.8137 13.5 7.5C13.5 4.18629 10.8137 1.5 7.5 1.5ZM0.5 7.5C0.5 3.63401 3.63401 0.5 7.5 0.5C11.366 0.5 14.5 3.63401 14.5 7.5C14.5 11.366 11.366 14.5 7.5 14.5C3.63401 14.5 0.5 11.366 0.5 7.5ZM8 4C8 3.44772 7.55228 3 7 3C6.44772 3 6 3.44772 6 4V7.5C6 7.76522 6.10536 8.01957 6.29289 8.20711L8.29289 10.2071C8.68342 10.5976 9.31658 10.5976 9.70711 10.2071C10.0976 9.81658 10.0976 9.18342 9.70711 8.79289L8 6.88582V4Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                          </svg>
                        ),
                        onSelect: () => navigate(`/audit/logs?entity_type=Project&entity_id=${project.id}`),
                      },
                      {
                        label: lt('Attachments'),
                        icon: (
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7.81825 1.18196C8.61335 0.38687 9.69661 0 10.7 0C11.7034 0 12.7867 0.38687 13.5818 1.18196C14.3769 1.97706 14.7638 3.06033 14.7638 4.06373C14.7638 5.06714 14.3769 6.1504 13.5818 6.9455L7.67539 12.8519C7.06985 13.4575 6.2363 13.7606 5.40274 13.7606C4.56918 13.7606 3.73563 13.4575 3.13009 12.8519C2.52455 12.2464 2.22146 11.4128 2.22146 10.5793C2.22146 9.74571 2.52455 8.91216 3.13009 8.30662L8.99252 2.4442C9.30591 2.13082 9.74923 1.9519 10.2025 1.9519C10.6558 1.9519 11.0991 2.13082 11.4125 2.4442C11.7259 2.75759 11.9048 3.20091 11.9048 3.65423C11.9048 4.10754 11.7259 4.55086 11.4125 4.86425L5.88966 10.3871C5.74635 10.5304 5.55108 10.6119 5.34745 10.6119C5.14382 10.6119 4.94855 10.5304 4.80524 10.3871C4.66193 10.2438 4.58038 10.0485 4.58038 9.84487C4.58038 9.64124 4.66193 9.44597 4.80524 9.30266L10.0312 4.07663C10.1888 3.91908 10.1888 3.66102 10.0312 3.50347C9.87367 3.34592 9.61561 3.34592 9.45806 3.50347L4.23203 8.72949C3.93829 9.02323 3.77198 9.42532 3.77198 9.84487C3.77198 10.2644 3.93829 10.6665 4.23203 10.9602C4.52577 11.254 4.92787 11.4203 5.34745 11.4203C5.76703 11.4203 6.16912 11.254 6.46286 10.9602L11.9857 5.4374C12.4765 4.94659 12.7132 4.30054 12.7132 3.65423C12.7132 3.00791 12.4765 2.36186 11.9857 1.87105C11.4949 1.38023 10.8488 1.14352 10.2025 1.14352C9.55622 1.14352 8.91017 1.38023 8.41936 1.87105L2.55693 7.73347C1.79451 8.4959 1.41309 9.53756 1.41309 10.5793C1.41309 11.621 1.79451 12.6626 2.55693 13.4251C3.31935 14.1875 4.36101 14.569 5.40274 14.569C6.44447 14.569 7.48613 14.1875 8.24855 13.4251L14.1553 7.51845C14.3128 7.3609 14.3128 7.10284 14.1553 6.94529C13.9977 6.78774 13.7397 6.78774 13.5821 6.94529L7.67547 12.852C7.06993 13.4575 6.23638 13.7606 5.40282 13.7606C4.56926 13.7606 3.7357 13.4575 3.13016 12.852C2.52463 12.2464 2.22154 11.4129 2.22154 10.5793C2.22154 9.74571 2.52463 8.91216 3.13016 8.30663L8.99259 2.4442C9.30598 2.13082 9.7493 1.9519 10.2026 1.9519C10.6559 1.9519 11.0992 2.13082 11.4126 2.4442C11.726 2.75759 11.9049 3.20091 11.9049 3.65423C11.9049 4.10754 11.726 4.55086 11.4126 4.86425L5.88974 10.3871C5.74643 10.5304 5.55116 10.6119 5.34753 10.6119C5.1439 10.6119 4.94863 10.5304 4.80532 10.3871C4.66201 10.2438 4.58046 10.0485 4.58046 9.84487C4.58046 9.64124 4.66201 9.44597 4.80532 9.30266L10.0313 4.07663C10.1889 3.91908 10.1889 3.66102 10.0313 3.50347C9.87378 3.34592 9.61572 3.34592 9.45817 3.50347L4.23211 8.72949C3.93837 9.02323 3.77206 9.42532 3.77206 9.84487C3.77206 10.2644 3.93837 10.6665 4.23211 10.9602C4.52585 11.254 4.92795 11.4203 5.34753 11.4203C5.76711 11.4203 6.1692 11.254 6.46294 10.9602L11.9858 5.4374C12.4766 4.94659 12.7133 4.30054 12.7133 3.65423C12.7133 3.00791 12.4766 2.36186 11.9858 1.87105C11.495 1.38023 10.8489 1.14352 10.2026 1.14352C9.5563 1.14352 8.91025 1.38023 8.41944 1.87105L2.55701 7.73347C1.79459 8.4959 1.41317 9.53756 1.41317 10.5793C1.41317 11.621 1.79459 12.6626 2.55701 13.4251C3.31943 14.1875 4.36109 14.569 5.40282 14.569C6.44455 14.569 7.48621 14.1875 8.24863 13.4251L14.1554 7.51845C14.3129 7.3609 14.3129 7.10284 14.1554 6.94529L14.1553 6.94529Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                          </svg>
                        ),
                        onSelect: () => setIsAttachmentsOpen(true),
                      },
                      {
                        label: 'Project KPI',
                        icon: (
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 11L4.5 7L7 9L10.5 4L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ),
                        onSelect: () => setIsKpiOpen(true),
                      },
                      {
                        label: lt('Edit'),
                        icon: (
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.8536 1.14645C11.6583 0.951184 11.3417 0.951184 11.1464 1.14645L3.71457 8.57836C3.62459 8.66834 3.55263 8.77461 3.50251 8.89155L2.04044 12.303C1.9599 12.491 2.00189 12.709 2.14645 12.8536C2.29101 12.9981 2.50905 13.0401 2.69697 12.9596L6.10845 11.4975C6.22539 11.4474 6.33166 11.3754 6.42164 11.2854L13.8536 3.85355C14.0488 3.65829 14.0488 3.34171 13.8536 3.14645L11.8536 1.14645ZM4.42168 9.28547L10.5 3.20711L11.7929 4.5L5.71453 10.5784L4.21921 11.2192L4.42168 9.28547Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                          </svg>
                        ),
                        onSelect: () => setIsEditProjectOpen(true),
                      },
                      {
                        label: lt('Delete'),
                        tone: 'danger',
                        icon: (
                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.77614 10 1.5C10 1.22386 9.77614 1 -9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11V12C11 12.5523 10.5523 13 10 13H5C9.44772 13 9 12.5523 9 12V4L3.5 4C3.22386 4 3 3.77614 3 3.5ZM5 4V12H10V4H5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                          </svg>
                        ),
                        onSelect: handleDeleteProject,
                      },
                    ]}
                  />
                </div>
              ) : null}
            </div>

            {/* Stats row - Hidden/compact on mobile */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-4 border-t border-[var(--border)]/30 pt-3 sm:pt-2 sm:border-t-0 sm:mt-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <Avatar
                  name={project.created_by.name}
                  surname={project.created_by.surname}
                  imageUrl={project.created_by.profile_image}
                  size="xs"
                  className="ring-2 ring-[var(--border)]"
                />
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-[var(--foreground)]">
                    {project.created_by.name} {project.created_by.surname}
                  </p>
                </div>
                <div className="sm:hidden">
                  <span className="text-[10px] font-bold text-[var(--foreground)] truncate max-w-[100px] block">
                    {project.created_by.name}
                  </span>
                </div>
              </div>

              <div className="h-4 sm:h-4 w-px bg-[var(--border)] opacity-60" />

              <div>
                <p className="text-[10px] sm:text-xs font-bold text-[var(--foreground)]">
                  {formatProjectDate(project.created_at)}
                </p>
              </div>

              <div className="h-4 sm:h-4 w-px bg-[var(--border)] opacity-60" />

              <div>
                <p className="text-[10px] sm:text-xs font-bold text-[var(--foreground)]">
                  {project.boards_count} <span className="hidden sm:inline">{lt('boards')}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Boards Content Overlay Container - Scroll internally */}
        <div className="relative z-20 flex-1 -mt-2 sm:-mt-4 bg-[var(--background)] rounded-t-[28px] sm:rounded-t-[40px] px-0 sm:px-2 pt-1 sm:pt-2 min-h-0 flex flex-col">
           <Card noPadding className="flex-1 flex flex-col overflow-hidden rounded-t-[24px] sm:rounded-t-[32px] border-x border-t sm:border border-[var(--border)] shadow-xl bg-[var(--surface)] backdrop-blur-xl">
              {/* Board Header & Filters Area - Highly scrollable on mobile */}
              <div className="flex flex-col border-b border-[var(--border)] bg-[var(--blue-dim)]/30 px-4 sm:px-8 py-3 sm:py-4 backdrop-blur-md">
                 <div className="flex items-center justify-between gap-4 mb-3 sm:mb-0">
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden flex-1">
                       {/* Board Tabs - Horizontal Scroll on mobile */}
                       <div className="flex items-center gap-2.5 p-1 rounded-xl bg-black/20 dark:bg-white/5 border border-[var(--border)] overflow-x-auto custom-scrollbar-none scroll-smooth">
                         {activeBoards.map((board) => {
                           const isSelected = selectedBoard?.id === board.id
                           return (
                             <div key={board.id} className="group relative flex shrink-0 items-center">
                               <button
                               type="button"
                               onClick={() => selectBoard(board.id)}
                               className={cn(
                                 "whitespace-nowrap pl-5 sm:pl-6 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[11px] font-black uppercase tracking-widest transition-all",
                                 canManageProjects ? "pr-14" : "pr-5 sm:pr-6",
                                 isSelected
                                   ? "bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] scale-105"
                                   : "text-[var(--muted-strong)] hover:text-[var(--foreground)] hover:bg-white/5"
                               )}
                               >                                 {board.name}
                               </button>
                               {canManageProjects && (
                                 <div className="absolute right-1">
                                    <ActionsMenu
                                      label={lt('Board actions')}
                                      items={[
                                        { label: lt('Edit'), onSelect: () => {/* Add edit handler logic */} },
                                        { label: lt('Delete'), tone: 'danger', onSelect: () => void handleDeleteBoard(board.id, board.name) },
                                      ]}
                                    />
                                 </div>
                               )}
                             </div>
                           )
                         })}
                         {canManageProjects && (
                            <button
                               type="button"
                               onClick={() => setIsCreateBoardOpen(true)}
                               className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted-strong)] hover:bg-white/10 hover:text-[var(--foreground)] transition-all shrink-0"
                               title={lt('Add board')}
                            >
                               <svg viewBox="0 0 16 16" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                               </svg>
                            </button>
                         )}
                       </div>

                       <div className="hidden sm:block h-8 w-px bg-[var(--border)] shrink-0" />

                       {/* Members Selector (Desktop) */}
                       <div className="hidden sm:flex items-center gap-3 shrink-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">{lt('Members')}:</p>
                          <div className="flex items-center -space-x-2">
                             {projectMembers.map((member) => {
                               const isExpanded = member.id === expandedMemberId
                               return (
                                 <button
                                   key={member.id}
                                   type="button"
                                   onClick={() => selectMember(member.id)}
                                   className={cn(
                                     'relative transition-transform hover:scale-110 hover:z-10',
                                     isExpanded ? 'scale-110 z-10' : 'z-0'
                                   )}
                                 >
                                   <Avatar
                                     name={member.name}
                                     surname={member.surname}
                                     imageUrl={member.profile_image}
                                     size="sm"
                                     className={cn(
                                        "ring-2 ring-[var(--surface)] transition-all",
                                        isExpanded ? "ring-blue-500 shadow-glow-blue" : "ring-[var(--border)]"
                                     )}
                                   />
                                 </button>
                               )
                             })}
                          </div>
                       </div>
                    </div>

                    {/* Desktop Right Actions */}
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                       {canManageProjects && (
                          <Button
                             variant="secondary"
                             size="sm"
                             className="h-9 rounded-xl font-black uppercase tracking-widest bg-[var(--accent-soft)]"
                             onClick={() => setIsCreateBoardOpen(true)}
                          >
                            {tr('New list', 'Yangi list', 'Novyi spisok')}
                          </Button>
                       )}
                    </div>

                    {/* Mobile Create Button */}
                    <div className="sm:hidden flex items-center shrink-0">
                       {canManageProjects && (
                          <button
                             onClick={() => setIsCreateBoardOpen(true)}
                             className="h-9 w-9 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg"
                          >
                             <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                          </button>
                       )}
                    </div>
                 </div>

                 {/* Mobile Members Row */}
                 <div className="sm:hidden flex items-center gap-3 overflow-hidden">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] shrink-0">{lt('Team')}:</p>
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-none pb-1">
                       {projectMembers.map((member) => {
                         const isExpanded = member.id === expandedMemberId
                         return (
                           <button
                             key={member.id}
                             type="button"
                             onClick={() => selectMember(member.id)}
                             className="shrink-0"
                           >
                             <Avatar
                               name={member.name}
                               surname={member.surname}
                               imageUrl={member.profile_image}
                               size="sm"
                               className={cn(
                                  "h-7 w-7 ring-2 transition-all",
                                  isExpanded ? "ring-blue-500 shadow-glow-blue scale-110" : "ring-[var(--border)]"
                               )}
                             />
                           </button>
                         )
                       })}
                    </div>
                 </div>
              </div>

              {/* Scrollable Board Workspace */}
              <div className="flex flex-col flex-1 min-h-0">
                 {selectedBoard ? (
                    <BoardWorkspace
                      boardId={selectedBoard.id}
                      projectId={project.id}
                      mode="embedded"
                      onBoardsChanged={() => projectQuery.refetch()}
                    />
                 ) : (
                    <div className="flex h-full items-center justify-center p-8 sm:p-12">
                       <StateBlock
                         tone="empty"
                         eyebrow={lt('No boards')}
                         title={lt('Select or create a board')}
                         description={lt('Choose a board from the list above to start managing tasks.')}
                       />
                    </div>
                 )}
              </div>
           </Card>
        </div>

        {/* Member Tasks Panel (Centered Overlay with Backdrop) */}
        {expandedMember && expandedMemberId !== null && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
              {/* Backdrop */}
              <button 
                 className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default" 
                 onClick={() => setExpandedMemberId(null)}
              />
              
              {/* Center Modal */}
              <Card variant="glass" className="relative z-10 w-full max-w-5xl rounded-xl shadow-2xl border-[var(--blue-border)] overflow-hidden page-enter">
                 <div className="flex items-center justify-between p-6 sm:p-8 border-b border-[var(--border)] bg-[var(--blue-dim)]/20 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                       <Avatar name={expandedMember.name} surname={expandedMember.surname} imageUrl={expandedMember.profile_image} size="lg" className="ring-4 ring-blue-500/20" />
                       <div>
                          <p className="text-xl font-black text-[var(--foreground)] tracking-tight">{expandedMember.name} {expandedMember.surname}</p>
                          <p className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mt-1">{expandedMember.job_title || lt('Member')}</p>
                       </div>
                    </div>
                    <button onClick={() => setExpandedMemberId(null)} className="h-12 w-12 rounded-xl flex items-center justify-center bg-black/10 hover:bg-red-500/20 hover:text-red-400 transition-all text-[var(--muted-strong)]">
                       <svg viewBox="0 0 16 16" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/></svg>
                    </button>
                 </div>
                 
                 <div className="max-h-[70vh] overflow-y-auto p-6 sm:p-10 custom-scrollbar-visible bg-[var(--surface-elevated)] boards-section">
                    <div className="flex items-center justify-between mb-8">
                       <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">{lt('Active Tasks Assignment')}</h4>
                       <Badge variant="blue" className="px-3 py-1 rounded-full font-black">{expandedMemberTasks.length} {lt('Items')}</Badge>
                    </div>

                    {isExpandedMemberTasksLoading ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[1,2,3,4].map(i => <div key={i} className="h-32 animate-pulse rounded-3xl bg-white/5 border border-white/5" />)}
                       </div>
                    ) : expandedMemberTasks.length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-20 opacity-30">
                          <svg viewBox="0 0 24 24" className="h-16 w-16 mb-6" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M12 22c5.523 0 9-4.477 9-10S17.523 2 12 2 3 6.477 3 12s3.477 10 9 10z"/><path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round"/></svg>
                          <p className="text-base font-black tracking-widest text-[var(--muted)] uppercase">{lt('No active tasks')}</p>
                       </div>
                    ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {expandedMemberTasks.map(task => (
                             <Link 
                                key={task.id} 
                                to={`/projects/${project.id}?board=${task.board_id}`} 
                                onClick={() => setExpandedMemberId(null)}
                                className="group flex flex-col justify-between p-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] hover:border-blue-500/50 hover:bg-[var(--accent-soft)] transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1"
                             >
                                <div className="mb-5">
                                   <div className="flex items-center gap-2 mb-2 opacity-60">
                                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{task.board_name}</span>
                                      <span className="text-[var(--border)]">•</span>
                                      <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">{task.column_name}</span>
                                   </div>
                                   <p className="text-[17px] font-black leading-snug text-[var(--foreground)] group-hover:text-blue-400 transition-colors line-clamp-2">
                                      {task.title}
                                   </p>
                                </div>
                                <div className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--border)]/50">
                                   <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_var(--blue-glow)]" />
                                      <span className="text-[10px] font-black text-[var(--muted-strong)] uppercase tracking-tighter">{lt('Priority High')}</span>
                                   </div>
                                   <div className="flex flex-col items-end gap-1 text-[10px] font-bold text-[var(--muted)]">
                                      {task.due_date ? (
                                        <div className="flex items-center gap-1.5 text-[var(--foreground)]">
                                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                            <path d="M16 2v4" />
                                            <path d="M8 2v4" />
                                            <path d="M3 10h18" />
                                          </svg>
                                          {formatProjectDateTime(task.due_date)}
                                        </div>
                                      ) : null}
                                      <div className="flex items-center gap-1.5">
                                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
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
                 
                 <div className="p-6 border-t border-[var(--border)] bg-[var(--accent-soft)]/10 flex justify-end">
                    <Button variant="ghost" className="rounded-xl font-black uppercase tracking-widest text-[var(--muted-strong)]" onClick={() => setExpandedMemberId(null)}>
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
            onClick={() => setIsKpiOpen(false)}
          />
          <Card variant="glass" className="relative z-10 w-full max-w-5xl rounded-xl shadow-2xl border-[var(--blue-border)] overflow-hidden page-enter">
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-[var(--border)] bg-[var(--blue-dim)]/20 backdrop-blur-md">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Developer KPI</p>
                <p className="mt-1 text-xl font-black text-[var(--foreground)] tracking-tight">{project.project_name}</p>
              </div>
              <button onClick={() => setIsKpiOpen(false)} className="h-12 w-12 rounded-xl flex items-center justify-center bg-black/10 hover:bg-red-500/20 hover:text-red-400 transition-all text-[var(--muted-strong)]">
                <svg viewBox="0 0 16 16" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6 sm:p-8 space-y-6 bg-[var(--surface-elevated)]">
              {/* Features */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Features</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="blue">{kpiFeatures.length}</Badge>
                    {canManageKpi && (
                      <button
                        type="button"
                        onClick={() => setShowAddFeature((v) => !v)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--blue-border)] bg-[var(--blue-dim)] px-2.5 py-1 text-xs font-bold text-[var(--blue-text)] transition hover:bg-[var(--blue-soft)]"
                      >
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {showAddFeature && canManageKpi && (
                  <div className="mb-4 rounded-xl border border-[var(--blue-border)] bg-[var(--blue-dim)]/30 p-4 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--muted)]">New Feature</p>
                    <Input
                      placeholder="Title *"
                      value={featureForm.title}
                      onChange={(e) => setFeatureForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Owner *</p>
                        <SelectField
                          value={featureForm.ownerId}
                          options={projectMembers.map((m) => ({ value: String(m.id), label: `${m.name} ${m.surname}` }))}
                          onValueChange={(v) => setFeatureForm((f) => ({ ...f, ownerId: v }))}
                          placeholder="Select owner"
                          searchable
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Points</p>
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
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Status</p>
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
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Due Date</p>
                        <Input
                          type="date"
                          value={featureForm.dueDate}
                          onChange={(e) => setFeatureForm((f) => ({ ...f, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">FE %</p>
                        <Input
                          type="number"
                          min="0" max="100"
                          value={featureForm.fePct}
                          onChange={(e) => setFeatureForm((f) => ({ ...f, fePct: e.target.value }))}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">BE %</p>
                        <Input
                          type="number"
                          min="0" max="100"
                          value={featureForm.bePct}
                          onChange={(e) => setFeatureForm((f) => ({ ...f, bePct: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={featureForm.isMandatory}
                          onChange={(e) => setFeatureForm((f) => ({ ...f, isMandatory: e.target.checked }))}
                          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--blue-text)]"
                        />
                        Mandatory
                      </label>
                      <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={featureForm.lockNow}
                          onChange={(e) => setFeatureForm((f) => ({ ...f, lockNow: e.target.checked }))}
                          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--blue-text)]"
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
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />)}</div>
                ) : kpiFeatures.length === 0 ? (
                  <p className="text-sm text-[var(--muted-strong)]">No features for this project.</p>
                ) : (
                  <div className="space-y-2">
                    {kpiFeatures.map(f => (
                      <div key={f.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{f.title}</p>
                          <p className="text-xs text-[var(--muted-strong)]">{f.status}{f.due_date ? ` · due ${f.due_date.slice(0,10)}` : ''}</p>
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
                  <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Quality Events</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={kpiQualityEvents.length > 0 ? 'danger' : 'outline'}>{kpiQualityEvents.length}</Badge>
                    {canManageKpi && (
                      <button
                        type="button"
                        onClick={() => setShowAddQuality((v) => !v)}
                        className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20"
                      >
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {showAddQuality && canManageKpi && (
                  <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--muted)]">New Quality Event</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Employee *</p>
                        <SelectField
                          value={qualityForm.employeeId}
                          options={projectMembers.map((m) => ({ value: String(m.id), label: `${m.name} ${m.surname}` }))}
                          onValueChange={(v) => setQualityForm((f) => ({ ...f, employeeId: v }))}
                          placeholder="Select employee"
                          searchable
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Severity</p>
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
                      <p className="mb-1 text-xs text-[var(--muted-strong)]">Event Date *</p>
                      <Input
                        type="date"
                        value={qualityForm.eventDate}
                        onChange={(e) => setQualityForm((f) => ({ ...f, eventDate: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qualityForm.confirmed}
                          onChange={(e) => setQualityForm((f) => ({ ...f, confirmed: e.target.checked }))}
                          className="h-4 w-4 rounded border-[var(--border)] accent-rose-500"
                        />
                        Confirmed
                      </label>
                      <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qualityForm.externalCause}
                          onChange={(e) => setQualityForm((f) => ({ ...f, externalCause: e.target.checked }))}
                          className="h-4 w-4 rounded border-[var(--border)] accent-rose-500"
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
                  <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />)}</div>
                ) : kpiQualityEvents.length === 0 ? (
                  <p className="text-sm text-[var(--muted-strong)]">No quality events for this project.</p>
                ) : (
                  <div className="space-y-2">
                    {kpiQualityEvents.map(e => (
                      <div key={e.id} className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{e.title}</p>
                          <p className="text-xs text-[var(--muted-strong)]">{e.severity} · {e.event_date.slice(0,10)}</p>
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
                  <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Blocked Periods</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{kpiBlockedPeriods.length}</Badge>
                    {canManageKpi && (
                      <button
                        type="button"
                        onClick={() => setShowAddBlocked((v) => !v)}
                        className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20"
                      >
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {showAddBlocked && canManageKpi && (
                  <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--muted)]">New Blocked Period</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Employee *</p>
                        <SelectField
                          value={blockedForm.employeeId}
                          options={projectMembers.map((m) => ({ value: String(m.id), label: `${m.name} ${m.surname}` }))}
                          onValueChange={(v) => setBlockedForm((f) => ({ ...f, employeeId: v }))}
                          placeholder="Select employee"
                          searchable
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Feature (optional)</p>
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
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Started At *</p>
                        <Input
                          type="datetime-local"
                          value={blockedForm.startedAt}
                          onChange={(e) => setBlockedForm((f) => ({ ...f, startedAt: e.target.value }))}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-[var(--muted-strong)]">Ended At</p>
                        <Input
                          type="datetime-local"
                          value={blockedForm.endedAt}
                          onChange={(e) => setBlockedForm((f) => ({ ...f, endedAt: e.target.value }))}
                        />
                      </div>
                    </div>
                    <Input
                      placeholder="Dependency (e.g. Client, DevOps)"
                      value={blockedForm.dependency}
                      onChange={(e) => setBlockedForm((f) => ({ ...f, dependency: e.target.value }))}
                    />
                    <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={blockedForm.isExternal}
                        onChange={(e) => setBlockedForm((f) => ({ ...f, isExternal: e.target.checked }))}
                        className="h-4 w-4 rounded border-[var(--border)] accent-amber-500"
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
                  <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />)}</div>
                ) : kpiBlockedPeriods.length === 0 ? (
                  <p className="text-sm text-[var(--muted-strong)]">No blocked periods for this project.</p>
                ) : (
                  <div className="space-y-2">
                    {kpiBlockedPeriods.map(b => (
                      <div key={b.id} className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{b.reason}</p>
                          <p className="text-xs text-[var(--muted-strong)]">{b.started_at.slice(0,10)}{b.ended_at ? ` → ${b.ended_at.slice(0,10)}` : ' (ongoing)'}</p>
                        </div>
                        <Badge variant={b.approval_status === 'approved' ? 'success' : b.approval_status === 'rejected' ? 'danger' : 'warning'}>{b.approval_status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-[var(--border)] bg-[var(--accent-soft)]/10 flex justify-end">
              <Button variant="ghost" className="rounded-xl font-black uppercase tracking-widest text-[var(--muted-strong)]" onClick={() => setIsKpiOpen(false)}>
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
      />

      {canManageProjects ? (
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
            open={isCreateBoardOpen}
            onClose={() => setIsCreateBoardOpen(false)}
            onSubmit={handleCreateBoard}
            title={lt('Create board')}
            submitLabel={lt('Create')}
            isSubmitting={isBoardSubmitting}
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
    </>
  )
}
