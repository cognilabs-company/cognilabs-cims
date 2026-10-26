import { request } from '../http'
import type { CreateResponse, SuccessResponse } from '../types'

export type AttachmentType = 'tz' | 'kp' | 'contracts'

export type ProjectAttachment = {
  id: number
  project_id: number
  attachment_type: AttachmentType
  file_name: string
  url_path: string
  mime_type: string
  file_size: number
  description: string | null
  created_by: number
  created_at: string
  updated_at: string
  created_by_user: {
    id: number
    name: string
    surname: string
    email: string
  }
}

// ─── Shared domain types ─────────────────────────────────────────────────────

export type UserSummary = {
  id: number
  name: string
  surname: string
  email: string
  job_title?: string | null
  profile_image?: string | null
}

export type CardImage = {
  id: number
  url: string
  url_path?: string
  filename: string
}

export type CardPriority = 'low' | 'medium' | 'high' | 'urgent'

function normalizeCardPriority(priority?: string | null): CardPriority | null {
  if (!priority) {
    return null
  }

  if (priority === 'urgent') {
    return 'high'
  }

  if (priority === 'low' || priority === 'medium' || priority === 'high') {
    return priority
  }

  return null
}

// ─── Project types ────────────────────────────────────────────────────────────

export type ProjectRecord = {
  id: number
  project_name: string
  project_description: string | null
  project_url: string | null
  image: string | null
  team_id: number | null
  team: ProjectTeamRecord | null
  deadline: string | null
  telegram_group_id: string | null
  created_by: UserSummary
  members: UserSummary[]
  boards_count: number
  created_at: string
  updated_at: string
}

export type ProjectTeamRecord = {
  id: number
  name: string
  description: string | null
  members: UserSummary[]
  created_at: string
  updated_at: string
}

export type ProjectDetail = ProjectRecord & {
  boards: BoardRecord[]
}

export type ProjectListResponse = {
  projects: ProjectRecord[]
  total_count: number
}

export type UserOpenProjectListResponse = ProjectListResponse

// ─── Board types ──────────────────────────────────────────────────────────────

export type BoardRecord = {
  id: number
  name: string
  description: string | null
  project_id: number
  created_by: UserSummary
  is_archived: boolean
  created_at: string
  updated_at: string
}

export type BoardDetail = BoardRecord & {
  columns: ColumnRecord[]
  files: FileRecord[]
}

export type BoardListResponse = {
  boards: BoardRecord[]
  total_count: number
}

// ─── Column types ─────────────────────────────────────────────────────────────

export type ColumnRecord = {
  id: number
  name: string
  color: string | null
  order: number
  board_id: number
  cards: CardRecord[]
}

// ─── Card types ───────────────────────────────────────────────────────────────

export type CardRecord = {
  id: number
  title: string
  description: string | null
  order: number
  priority: CardPriority | null
  assignee: UserSummary | null
  assignees: UserSummary[]
  assignee_id: number | null
  assignee_ids: number[]
  due_date: string | null
  completed_at: string | null
  completion_duration_seconds: number | null
  current_status_duration_seconds: number | null
  status_history: CardStatusHistoryRecord[]
  telegram_source_chat_id: string | null
  telegram_source_message_id: string | null
  telegram_source_command: string | null
  telegram_source_kind: string | null
  column_id: number
  created_by: UserSummary
  created_at: string
  updated_at: string
  images: CardImage[]
  files?: CardImage[]
}

export type CardStatusHistoryRecord = {
  id: number | null
  column_id: number | null
  column_name: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
}

export type UserOpenCardRecord = CardRecord & {
  board_id: number
  project_id: number
  project_name: string
  board_name: string
  column_name: string
}

export type UserOpenCardListResponse = {
  cards: UserOpenCardRecord[]
  total_count: number
}

// ─── File types ───────────────────────────────────────────────────────────────

export type FileRecord = {
  id: number
  url: string
  url_path?: string
  filename: string
  created_at: string
}

type ApiCardImage = {
  id?: number
  url?: string | null
  url_path?: string | null
  filename?: string | null
  created_at?: string
}

type ApiCardRecord = Omit<Partial<CardRecord>, 'images' | 'files' | 'created_by' | 'assignee' | 'assignees' | 'assignee_id' | 'assignee_ids' | 'telegram_source_chat_id' | 'telegram_source_message_id'> & {
  created_by?: ApiUserSummary | number | null
  created_by_user?: ApiUserSummary
  assignee?: ApiUserSummary | number | null
  assignee_user?: ApiUserSummary
  assignees?: ApiUserSummary[] | null
  assignee_users?: ApiUserSummary[] | null
  assignee_id?: number | null
  assignee_ids?: number[] | null
  member_ids?: number[] | null
  images?: ApiCardImage[] | null
  files?: ApiCardImage[] | null
  board_id?: number
  project_id?: number
  project_name?: string | null
  board_name?: string | null
  column_name?: string | null
  status_history?: ApiCardStatusHistoryRecord[] | null
  telegram_source_chat_id?: string | number | null
  telegram_source_message_id?: string | number | null
}

type ApiCardStatusHistoryRecord = Partial<CardStatusHistoryRecord> & {
  status_id?: number | null
  status_name?: string | null
  started_on?: string | null
  ended_on?: string | null
  duration?: number | null
}

type ApiColumnRecord = Omit<Partial<ColumnRecord>, 'cards'> & {
  cards?: ApiCardRecord[] | null
}

type ApiBoardRecord = Omit<Partial<BoardRecord>, 'created_by'> & {
  created_by?: ApiUserSummary | number | null
  created_by_user?: ApiUserSummary
}

type ApiBoardDetail = Omit<ApiBoardRecord, 'columns'> & {
  columns?: ApiColumnRecord[] | null
  files?: ApiCardImage[] | null
}

type ApiUserSummary = Partial<UserSummary> | null | undefined

type ApiProjectRecord = Omit<Partial<ProjectRecord>, 'created_by' | 'members' | 'boards_count' | 'team'> & {
  boards_count?: number | null
  image_url?: string | null
  image_path?: string | null
  project_image?: string | null
  thumbnail?: string | null
  board_count?: number | null
  member_count?: number | null
  created_by?: ApiUserSummary | number | null
  created_by_user?: ApiUserSummary
  members?: ApiUserSummary[] | null
  team?: ApiProjectTeamRecord | null
}

type ApiProjectTeamRecord = Partial<ProjectTeamRecord> & {
  team_name?: string | null
  users?: ApiUserSummary[] | null
  member_ids?: number[] | null
}

type ApiProjectTeamListResponse = ApiProjectTeamRecord[] | {
  teams?: ApiProjectTeamRecord[]
  items?: ApiProjectTeamRecord[]
  total_count?: number
}

type ApiProjectDetail = Omit<ApiProjectRecord, 'boards'> & {
  boards?: Array<ApiBoardRecord | null> | null
}

function normalizeUserSummary(user: ApiUserSummary): UserSummary {
  return {
    id: user?.id ?? 0,
    name: user?.name ?? '',
    surname: user?.surname ?? '',
    email: user?.email ?? '',
    job_title: user?.job_title ?? null,
    profile_image: user?.profile_image ?? null,
  }
}

function resolveUserReference(primary?: ApiUserSummary | number | null, fallback?: ApiUserSummary) {
  if (fallback) {
    return fallback
  }

  return typeof primary === 'object' ? primary : null
}

function normalizeUserSummaryList(users?: Array<ApiUserSummary | null | undefined> | null) {
  return Array.isArray(users)
    ? users.filter(Boolean).map((user) => normalizeUserSummary(user))
    : []
}

function getCardAssignees(card: Pick<CardRecord, 'assignee' | 'assignees'>) {
  if (Array.isArray(card.assignees) && card.assignees.length > 0) {
    return card.assignees
  }

  return card.assignee ? [card.assignee] : []
}

function normalizeProjectTeam(team?: ApiProjectTeamRecord | null): ProjectTeamRecord | null {
  if (!team || !team.id) {
    return null
  }

  return {
    id: team.id,
    name: team.name ?? team.team_name ?? '',
    description: team.description ?? null,
    members: normalizeUserSummaryList(team.members ?? team.users),
    created_at: team.created_at ?? '',
    updated_at: team.updated_at ?? '',
  }
}

function normalizeCardStatusHistory(history?: ApiCardStatusHistoryRecord[] | null): CardStatusHistoryRecord[] {
  if (!Array.isArray(history)) {
    return []
  }

  return history.map((entry) => ({
    id: entry.id ?? null,
    column_id: entry.column_id ?? entry.status_id ?? null,
    column_name: entry.column_name ?? entry.status_name ?? null,
    started_at: entry.started_at ?? entry.started_on ?? null,
    ended_at: entry.ended_at ?? entry.ended_on ?? null,
    duration_seconds: entry.duration_seconds ?? entry.duration ?? null,
  }))
}

function resolveProjectImage(project: ApiProjectRecord) {
  return project.image ?? project.image_url ?? project.image_path ?? project.project_image ?? project.thumbnail ?? null
}

function normalizeProject(project: ApiProjectRecord): ProjectRecord {
  return {
    id: project.id ?? 0,
    project_name: project.project_name ?? '',
    project_description: project.project_description ?? null,
    project_url: project.project_url ?? null,
    image: resolveProjectImage(project),
    team_id: project.team_id ?? project.team?.id ?? null,
    team: normalizeProjectTeam(project.team),
    deadline: project.deadline ?? null,
    telegram_group_id: project.telegram_group_id ?? null,
    created_by: normalizeUserSummary(resolveUserReference(project.created_by, project.created_by_user)),
    members: Array.isArray(project.members) ? project.members.map(normalizeUserSummary) : [],
    boards_count: project.boards_count ?? project.board_count ?? 0,
    created_at: project.created_at ?? '',
    updated_at: project.updated_at ?? '',
  }
}

function normalizeBoardRecord(board: ApiBoardRecord | null | undefined, fallbackProjectId = 0): BoardRecord {
  return {
    id: board?.id ?? 0,
    name: board?.name ?? '',
    description: board?.description ?? null,
    project_id: board?.project_id ?? fallbackProjectId,
    created_by: normalizeUserSummary(resolveUserReference(board?.created_by, board?.created_by_user)),
    is_archived: Boolean(board?.is_archived),
    created_at: board?.created_at ?? '',
    updated_at: board?.updated_at ?? '',
  }
}

function normalizeProjectDetail(project: ApiProjectDetail): ProjectDetail {
  return {
    ...normalizeProject(project),
    boards: Array.isArray(project.boards)
      ? project.boards.map((board) => normalizeBoardRecord(board, project.id ?? 0))
      : [],
  }
}

function normalizeCardImage(image: ApiCardImage): CardImage {
  const url = image.url ?? image.url_path ?? ''
  const fallbackFilename = url.split('/').filter(Boolean).at(-1) ?? 'Attachment'

  return {
    id: image.id ?? 0,
    url,
    url_path: image.url_path ?? undefined,
    filename: image.filename ?? fallbackFilename,
  }
}

function normalizeCard(card: ApiCardRecord): CardRecord {
  const images = Array.isArray(card.images)
    ? card.images
    : Array.isArray(card.files)
      ? card.files
      : []
  const assignees = normalizeUserSummaryList(card.assignees ?? card.assignee_users)
  const fallbackAssignee = normalizeUserSummary(resolveUserReference(card.assignee, card.assignee_user))
  const normalizedAssignees = assignees.length > 0
    ? assignees
    : fallbackAssignee.id > 0
      ? [fallbackAssignee]
      : []
  const primaryAssignee = normalizedAssignees[0] ?? null
  const assigneeIds = Array.from(new Set([
    ...(Array.isArray(card.assignee_ids) ? card.assignee_ids : []),
    ...(Array.isArray(card.member_ids) ? card.member_ids : []),
    ...(primaryAssignee?.id ? [primaryAssignee.id] : []),
  ])).filter((value) => Number.isFinite(value) && value > 0)

  return {
    id: card.id ?? 0,
    title: card.title ?? '',
    description: card.description ?? null,
    order: card.order ?? 0,
    priority: normalizeCardPriority(card.priority),
    assignee: primaryAssignee,
    assignees: normalizedAssignees,
    assignee_id: card.assignee_id ?? primaryAssignee?.id ?? null,
    assignee_ids: assigneeIds,
    due_date: card.due_date ?? null,
    completed_at: card.completed_at ?? null,
    completion_duration_seconds: card.completion_duration_seconds ?? null,
    current_status_duration_seconds: card.current_status_duration_seconds ?? null,
    status_history: normalizeCardStatusHistory(card.status_history),
    telegram_source_chat_id: card.telegram_source_chat_id === null || card.telegram_source_chat_id === undefined ? null : String(card.telegram_source_chat_id),
    telegram_source_message_id: card.telegram_source_message_id === null || card.telegram_source_message_id === undefined ? null : String(card.telegram_source_message_id),
    telegram_source_command: card.telegram_source_command ?? null,
    telegram_source_kind: card.telegram_source_kind ?? null,
    column_id: card.column_id ?? 0,
    created_by: normalizeUserSummary(resolveUserReference(card.created_by, card.created_by_user)),
    created_at: card.created_at ?? '',
    updated_at: card.updated_at ?? '',
    images: images.map(normalizeCardImage),
    files: Array.isArray(card.files) ? card.files.map(normalizeCardImage) : undefined,
  }
}

function normalizeOpenCard(card: ApiCardRecord): UserOpenCardRecord {
  const normalizedCard = normalizeCard(card)

  return {
    ...normalizedCard,
    board_id: card.board_id ?? 0,
    project_id: card.project_id ?? 0,
    project_name: card.project_name ?? '',
    board_name: card.board_name ?? '',
    column_name: card.column_name ?? '',
  }
}

function normalizeBoardFiles(files?: ApiCardImage[] | null) {
  return Array.isArray(files)
    ? files.map((file) => ({
        id: file.id ?? 0,
        url: file.url ?? file.url_path ?? '',
        url_path: file.url_path ?? undefined,
        filename: file.filename ?? ((file.url ?? file.url_path ?? '').split('/').filter(Boolean).at(-1) ?? 'Attachment'),
        created_at: file.created_at ?? '',
      }))
    : []
}

function normalizeBoardDetail(board: ApiBoardDetail): BoardDetail {
  const normalizedBoard = normalizeBoardRecord(board, board.project_id ?? 0)

  return {
    ...normalizedBoard,
    columns: Array.isArray(board.columns)
      ? board.columns.map((column) => ({
          id: column.id ?? 0,
          name: column.name ?? '',
          color: column.color ?? null,
          order: column.order ?? 0,
          board_id: column.board_id ?? 0,
          cards: Array.isArray(column.cards) ? column.cards.map(normalizeCard) : [],
        }))
      : [],
    files: normalizeBoardFiles(board.files),
  }
}

function pickString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return ''
}

function pickNullableString(...values: Array<string | null | undefined>) {
  const picked = pickString(...values)
  return picked || null
}

function mergeUserSummary(left?: UserSummary | null, right?: UserSummary | null): UserSummary {
  return {
    id: right?.id ?? left?.id ?? 0,
    name: pickString(right?.name, left?.name),
    surname: pickString(right?.surname, left?.surname),
    email: pickString(right?.email, left?.email),
    job_title: pickNullableString(right?.job_title, left?.job_title),
    profile_image: pickNullableString(right?.profile_image, left?.profile_image),
  }
}

function mergeUserSummaryLists(...groups: Array<UserSummary[] | null | undefined>) {
  const users = new Map<number, UserSummary>()

  for (const group of groups) {
    for (const user of group ?? []) {
      if (user.id <= 0) {
        continue
      }

      const current = users.get(user.id)
      users.set(user.id, current ? mergeUserSummary(current, user) : user)
    }
  }

  return Array.from(users.values()).sort((left, right) =>
    `${left.name} ${left.surname}`.localeCompare(`${right.name} ${right.surname}`),
  )
}

function mergeCardImages(...groups: Array<CardImage[] | null | undefined>) {
  const images = new Map<string, CardImage>()

  for (const group of groups) {
    for (const image of group ?? []) {
      const key = image.id > 0 ? `id:${image.id}` : `url:${image.url}`
      const current = images.get(key)

      images.set(key, current
        ? {
            id: image.id || current.id,
            url: pickString(image.url, current.url),
            url_path: pickNullableString(image.url_path, current.url_path) ?? undefined,
            filename: pickString(image.filename, current.filename),
          }
        : image)
    }
  }

  return Array.from(images.values())
}

function mergeCardRecord(left: CardRecord, right: CardRecord): CardRecord {
  const assignees = mergeUserSummaryLists(getCardAssignees(left), getCardAssignees(right))
  const primaryAssignee = assignees[0] ?? null
  const assigneeIds = Array.from(new Set([
    ...(Array.isArray(left.assignee_ids) ? left.assignee_ids : []),
    ...(Array.isArray(right.assignee_ids) ? right.assignee_ids : []),
    ...(left.assignee_id ? [left.assignee_id] : []),
    ...(right.assignee_id ? [right.assignee_id] : []),
    ...(primaryAssignee?.id ? [primaryAssignee.id] : []),
  ])).filter((value) => Number.isFinite(value) && value > 0)

  return {
    id: right.id || left.id,
    title: pickString(right.title, left.title),
    description: pickNullableString(right.description, left.description),
    order: right.order ?? left.order,
    priority: right.priority ?? left.priority ?? null,
    assignee: primaryAssignee,
    assignees,
    assignee_id: right.assignee_id ?? left.assignee_id ?? primaryAssignee?.id ?? null,
    assignee_ids: assigneeIds,
    due_date: pickNullableString(right.due_date, left.due_date),
    completed_at: pickNullableString(right.completed_at, left.completed_at),
    completion_duration_seconds: right.completion_duration_seconds ?? left.completion_duration_seconds ?? null,
    current_status_duration_seconds: right.current_status_duration_seconds ?? left.current_status_duration_seconds ?? null,
    status_history: right.status_history.length > 0 ? right.status_history : left.status_history,
    telegram_source_chat_id: pickNullableString(right.telegram_source_chat_id, left.telegram_source_chat_id),
    telegram_source_message_id: pickNullableString(right.telegram_source_message_id, left.telegram_source_message_id),
    telegram_source_command: pickNullableString(right.telegram_source_command, left.telegram_source_command),
    telegram_source_kind: pickNullableString(right.telegram_source_kind, left.telegram_source_kind),
    column_id: right.column_id || left.column_id,
    created_by: mergeUserSummary(left.created_by, right.created_by),
    created_at: pickString(left.created_at, right.created_at),
    updated_at: pickString(right.updated_at, left.updated_at),
    images: mergeCardImages(left.images, right.images),
    files: mergeCardImages(left.files, right.files),
  }
}

function mergeCardLists(...groups: Array<CardRecord[] | null | undefined>) {
  const cards = new Map<number, CardRecord>()

  for (const group of groups) {
    for (const card of group ?? []) {
      if (card.id <= 0) {
        continue
      }

      const current = cards.get(card.id)
      cards.set(card.id, current ? mergeCardRecord(current, card) : card)
    }
  }

  return Array.from(cards.values()).sort((left, right) =>
    left.order - right.order || right.updated_at.localeCompare(left.updated_at) || left.id - right.id,
  )
}

function mergeColumnRecord(left: ColumnRecord, right: ColumnRecord): ColumnRecord {
  return {
    id: right.id || left.id,
    name: pickString(right.name, left.name),
    color: pickNullableString(right.color, left.color),
    order: right.order ?? left.order,
    board_id: right.board_id || left.board_id,
    cards: mergeCardLists(left.cards, right.cards),
  }
}

function mergeColumnLists(...groups: Array<ColumnRecord[] | null | undefined>) {
  const columns = new Map<number, ColumnRecord>()

  for (const group of groups) {
    for (const column of group ?? []) {
      if (column.id <= 0) {
        continue
      }

      const current = columns.get(column.id)
      columns.set(column.id, current ? mergeColumnRecord(current, column) : column)
    }
  }

  return Array.from(columns.values()).sort((left, right) => left.order - right.order || left.id - right.id)
}

function mergeBoardRecord(left: BoardRecord, right: BoardRecord): BoardRecord {
  return {
    id: right.id || left.id,
    name: pickString(right.name, left.name),
    description: pickNullableString(right.description, left.description),
    project_id: right.project_id || left.project_id,
    created_by: mergeUserSummary(left.created_by, right.created_by),
    is_archived: left.is_archived && right.is_archived,
    created_at: pickString(left.created_at, right.created_at),
    updated_at: pickString(right.updated_at, left.updated_at),
  }
}

function mergeBoardDetailRecord(left: BoardDetail, right: BoardDetail): BoardDetail {
  return {
    ...mergeBoardRecord(left, right),
    columns: mergeColumnLists(left.columns, right.columns),
    files: mergeCardImages(left.files, right.files).map((file) => ({
      id: file.id,
      url: file.url,
      url_path: file.url_path,
      filename: file.filename,
      created_at: '',
    })),
  }
}

function mergeBoardRecordLists(...groups: Array<BoardRecord[] | null | undefined>) {
  const boards = new Map<number, BoardRecord>()

  for (const group of groups) {
    for (const board of group ?? []) {
      if (board.id <= 0) {
        continue
      }

      const current = boards.get(board.id)

      if (!current) {
        boards.set(board.id, board)
        continue
      }

      boards.set(board.id, mergeBoardRecord(current, board))
    }
  }

  return Array.from(boards.values()).sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at) || right.id - left.id)
}

function mergeProjectRecord(left: ProjectRecord, right: ProjectRecord): ProjectRecord {
  return {
    id: right.id || left.id,
    project_name: pickString(right.project_name, left.project_name),
    project_description: pickNullableString(right.project_description, left.project_description),
    project_url: pickNullableString(right.project_url, left.project_url),
    image: pickNullableString(right.image, left.image),
    team_id: right.team_id ?? left.team_id ?? null,
    team: right.team ?? left.team ?? null,
    deadline: pickNullableString(right.deadline, left.deadline),
    telegram_group_id: pickNullableString(right.telegram_group_id, left.telegram_group_id),
    created_by: mergeUserSummary(left.created_by, right.created_by),
    members: mergeUserSummaryLists(left.members, right.members),
    boards_count: Math.max(left.boards_count, right.boards_count),
    created_at: pickString(left.created_at, right.created_at),
    updated_at: pickString(right.updated_at, left.updated_at),
  }
}

function mergeProjectDetailRecord(left: ProjectDetail, right: ProjectDetail): ProjectDetail {
  const boards = mergeBoardRecordLists(left.boards, right.boards)

  return {
    ...mergeProjectRecord(left, right),
    boards_count: Math.max(left.boards_count, right.boards_count, boards.length),
    boards,
  }
}

function flattenBoardCards(project: Pick<ProjectRecord, 'id' | 'project_name'>, boards: BoardDetail[]): UserOpenCardRecord[] {
  const cards: UserOpenCardRecord[] = []

  for (const board of boards) {
    for (const column of board.columns) {
      for (const card of column.cards) {
        cards.push({
          ...card,
          board_id: board.id,
          project_id: project.id,
          project_name: project.project_name,
          board_name: board.name,
          column_name: column.name,
        })
      }
    }
  }

  return cards
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const projectsService = {
  // Teams
  listTeams() {
    return request<ApiProjectTeamListResponse>({ path: '/projects/teams' })
      .then((response) => {
        const source = Array.isArray(response) ? response : response.teams ?? response.items ?? []
        const teams = source.map(normalizeProjectTeam).filter((team): team is ProjectTeamRecord => team !== null)
        return { teams, total_count: Array.isArray(response) ? teams.length : response.total_count ?? teams.length }
      })
  },

  getTeam(teamId: number) {
    return request<ApiProjectTeamRecord>({ path: `/projects/teams/${teamId}` })
      .then((team) => normalizeProjectTeam(team))
      .then((team) => {
        if (!team) {
          throw new Error('Team not found')
        }

        return team
      })
  },

  createTeam(payload: { name: string; description?: string; member_ids: number[] }) {
    return request<CreateResponse>({
      path: '/projects/teams',
      method: 'POST',
      body: payload,
    })
  },

  updateTeam(teamId: number, payload: { name: string; description?: string; member_ids: number[] }) {
    return request<SuccessResponse>({
      path: `/projects/teams/${teamId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteTeam(teamId: number) {
    return request<SuccessResponse>({
      path: `/projects/teams/${teamId}`,
      method: 'DELETE',
    })
  },

  // Projects
  listProjects() {
    return request<ProjectListResponse & { projects?: ApiProjectRecord[] }>({ path: '/projects' }).then((response) => ({
      ...response,
      projects: Array.isArray(response.projects) ? response.projects.map(normalizeProject) : [],
      total_count: response.total_count ?? (Array.isArray(response.projects) ? response.projects.length : 0),
    }))
  },

  listUserOpenProjects(userId: number) {
    return request<UserOpenProjectListResponse & { projects?: ApiProjectRecord[] }>({
      path: `/open/projects/user/${userId}`,
    }).then((response) => ({
      ...response,
      projects: Array.isArray(response.projects) ? response.projects.map(normalizeProject) : [],
      total_count: response.total_count ?? (Array.isArray(response.projects) ? response.projects.length : 0),
    }))
  },

  async listReadableProjects(preferredUserId?: number | null) {
    const users = await this.getAllUsers()
    const candidateUserIds = Array.from(new Set(
      [preferredUserId ?? null, ...users.map((user) => user.id)]
        .filter((userId): userId is number => typeof userId === 'number' && Number.isFinite(userId) && userId > 0),
    ))

    const results = await Promise.allSettled(candidateUserIds.map((userId) => this.listUserOpenProjects(userId)))
    const projects = new Map<number, ProjectRecord>()

    for (const result of results) {
      if (result.status !== 'fulfilled') {
        continue
      }

      for (const project of result.value.projects) {
        const current = projects.get(project.id)
        projects.set(project.id, current ? mergeProjectRecord(current, project) : project)
      }
    }

    const mergedProjects = Array.from(projects.values()).sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at) || left.project_name.localeCompare(right.project_name))

    return {
      projects: mergedProjects,
      total_count: mergedProjects.length,
    }
  },

  getAllUsers() {
    return request<UserSummary[]>({ path: '/projects/users/all' })
  },

  createProject(formData: FormData) {
    return request<CreateResponse>({
      path: '/projects',
      method: 'POST',
      body: formData,
    })
  },

  getProject(projectId: number) {
    return request<ApiProjectDetail>({ path: `/projects/${projectId}` }).then(normalizeProjectDetail)
  },

  getUserOpenProjectDetail(projectId: number, userId: number) {
    return request<ApiProjectDetail>({
      path: `/open/projects/${projectId}/detail/user/${userId}`,
    }).then(normalizeProjectDetail)
  },

  async getReadableProjectDetail(projectId: number, preferredUserId?: number | null) {
    const users = await this.getAllUsers()
    const candidateUserIds = Array.from(new Set(
      [preferredUserId ?? null, ...users.map((user) => user.id)]
        .filter((userId): userId is number => typeof userId === 'number' && Number.isFinite(userId) && userId > 0),
    ))

    const accessResults = await Promise.allSettled(candidateUserIds.map((userId) => this.listUserOpenProjects(userId)))
    const readableUserIds = candidateUserIds.filter((_, index) => {
      const result = accessResults[index]
      return result?.status === 'fulfilled' && result.value.projects.some((project) => project.id === projectId)
    })

    const details = await Promise.allSettled(readableUserIds.map((userId) => this.getUserOpenProjectDetail(projectId, userId)))
    const mergedDetail = details.reduce<ProjectDetail | null>((current, result) => {
      if (result.status !== 'fulfilled') {
        return current
      }

      return current ? mergeProjectDetailRecord(current, result.value) : result.value
    }, null)

    if (!mergedDetail) {
      throw new Error('Project not found in readable projects')
    }

    return mergedDetail
  },

  updateProject(projectId: number, formData: FormData) {
    return request<SuccessResponse>({
      path: `/projects/${projectId}`,
      method: 'PATCH',
      body: formData,
    })
  },

  updateProjectTelegramGroup(projectId: number, telegramGroupId: string | null) {
    return request<SuccessResponse>({
      path: `/projects/${projectId}/telegram-group`,
      method: 'PATCH',
      body: { telegram_group_id: telegramGroupId },
    })
  },

  deleteProject(projectId: number) {
    return request<SuccessResponse>({
      path: `/projects/${projectId}`,
      method: 'DELETE',
    })
  },

  // Boards
  listBoards(projectId: number) {
    return request<BoardListResponse>({ path: `/projects/${projectId}/boards` })
  },

  listUserOpenProjectBoards(projectId: number, userId: number) {
    return request<{ project_id?: number; boards?: ApiBoardDetail[]; total_count?: number }>({
      path: `/open/projects/${projectId}/boards/detail/user/${userId}`,
    }).then((response) => ({
      project_id: response.project_id ?? projectId,
      boards: Array.isArray(response.boards) ? response.boards.map(normalizeBoardDetail) : [],
      total_count: response.total_count ?? (Array.isArray(response.boards) ? response.boards.length : 0),
    }))
  },

  async getReadableProjectBoards(projectId: number, preferredUserId?: number | null) {
    const users = await this.getAllUsers()
    const candidateUserIds = Array.from(new Set(
      [preferredUserId ?? null, ...users.map((user) => user.id)]
        .filter((userId): userId is number => typeof userId === 'number' && Number.isFinite(userId) && userId > 0),
    ))

    const accessResults = await Promise.allSettled(candidateUserIds.map((userId) => this.listUserOpenProjects(userId)))
    const readableUserIds = candidateUserIds.filter((_, index) => {
      const result = accessResults[index]
      return result?.status === 'fulfilled' && result.value.projects.some((project) => project.id === projectId)
    })

    const boardResults = await Promise.allSettled(readableUserIds.map((userId) => this.listUserOpenProjectBoards(projectId, userId)))
    const boards = new Map<number, BoardDetail>()

    for (const result of boardResults) {
      if (result.status !== 'fulfilled') {
        continue
      }

      for (const board of result.value.boards) {
        const current = boards.get(board.id)
        boards.set(board.id, current ? mergeBoardDetailRecord(current, board) : board)
      }
    }

    const mergedBoards = Array.from(boards.values()).sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at) || right.id - left.id)

    return {
      project_id: projectId,
      boards: mergedBoards,
      total_count: mergedBoards.length,
    }
  },

  async getUserOpenBoardDetail(boardId: number, userId: number, projectId?: number | null) {
    const scopedProjectIds = typeof projectId === 'number' && Number.isFinite(projectId) && projectId > 0
      ? [projectId]
      : (await this.listUserOpenProjects(userId)).projects.map((project) => project.id)

    for (const nextProjectId of scopedProjectIds) {
      const response = await this.listUserOpenProjectBoards(nextProjectId, userId)
      const matchedBoard = response.boards.find((board) => board.id === boardId)

      if (matchedBoard) {
        return matchedBoard
      }
    }

    throw new Error('Board not found in open user projects')
  },

  async getReadableBoardDetail(boardId: number, projectId?: number | null, preferredUserId?: number | null) {
    const scopedProjectIds = typeof projectId === 'number' && Number.isFinite(projectId) && projectId > 0
      ? [projectId]
      : (await this.listReadableProjects(preferredUserId)).projects.map((project) => project.id)

    for (const nextProjectId of scopedProjectIds) {
      const response = await this.getReadableProjectBoards(nextProjectId, preferredUserId)
      const matchedBoard = response.boards.find((board) => board.id === boardId)

      if (matchedBoard) {
        return matchedBoard
      }
    }

    throw new Error('Board not found in readable projects')
  },

  createBoard(projectId: number, payload: { name: string; description?: string }) {
    return request<CreateResponse>({
      path: `/projects/${projectId}/boards`,
      method: 'POST',
      body: payload,
    })
  },

  getBoard(boardId: number) {
    return request<ApiBoardDetail>({ path: `/boards/${boardId}` }).then(normalizeBoardDetail)
  },

  updateBoard(boardId: number, payload: { name?: string; description?: string }) {
    return request<SuccessResponse>({
      path: `/boards/${boardId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteBoard(boardId: number) {
    return request<SuccessResponse>({
      path: `/boards/${boardId}`,
      method: 'DELETE',
    })
  },

  // Columns
  createColumn(boardId: number, payload: { name: string; color?: string }) {
    return request<CreateResponse>({
      path: `/boards/${boardId}/columns`,
      method: 'POST',
      body: payload,
    })
  },

  updateColumn(columnId: number, payload: { name?: string; color?: string }) {
    return request<SuccessResponse>({
      path: `/columns/${columnId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteColumn(columnId: number) {
    return request<SuccessResponse>({
      path: `/columns/${columnId}`,
      method: 'DELETE',
    })
  },

  moveColumn(columnId: number, order: number) {
    return request<SuccessResponse>({
      path: `/columns/${columnId}/move`,
      method: 'PATCH',
      body: { order },
    })
  },

  // Cards
  createCard(columnId: number, formData: FormData) {
    return request<CreateResponse>({
      path: `/columns/${columnId}/cards`,
      method: 'POST',
      body: formData,
    })
  },

  getCard(cardId: number) {
    return request<ApiCardRecord>({ path: `/cards/${cardId}` }).then(normalizeCard)
  },

  listUserOpenCards(userId: number, projectId?: number | null) {
    return request<UserOpenCardListResponse & { cards?: ApiCardRecord[] }>({
      path: `/open/cards/user/${userId}`,
      query: {
        project_id: projectId,
      },
    }).then((response) => ({
      ...response,
      cards: Array.isArray(response.cards) ? response.cards.map(normalizeOpenCard) : [],
      total_count: response.total_count ?? (Array.isArray(response.cards) ? response.cards.length : 0),
    })).catch(async () => {
      const projects = projectId
        ? (await this.listUserOpenProjects(userId)).projects.filter((project) => project.id === projectId)
        : (await this.listUserOpenProjects(userId)).projects

      const boardResults = await Promise.allSettled(
        projects.map((project) => this.listUserOpenProjectBoards(project.id, userId).then((response) => ({
          project,
          boards: response.boards,
        }))),
      )

      const cards = boardResults.flatMap((result) => {
        if (result.status !== 'fulfilled') {
          return []
        }

        return flattenBoardCards(result.value.project, result.value.boards)
      })

      return {
        cards: cards.sort((left, right) =>
          left.project_name.localeCompare(right.project_name) ||
          left.board_name.localeCompare(right.board_name) ||
          left.column_name.localeCompare(right.column_name) ||
          left.order - right.order ||
          left.id - right.id),
        total_count: cards.length,
      }
    })
  },

  getUserOpenCard(cardId: number, userId: number) {
    return request<ApiCardRecord>({
      path: `/open/cards/${cardId}/user/${userId}`,
    }).then(normalizeOpenCard)
  },

  updateCard(cardId: number, formData: FormData) {
    return request<SuccessResponse>({
      path: `/cards/${cardId}`,
      method: 'PATCH',
      body: formData,
    })
  },

  deleteCard(cardId: number) {
    return request<SuccessResponse | undefined>({
      path: `/cards/${cardId}`,
      method: 'DELETE',
    })
  },

  moveCard(cardId: number, columnId: number, order: number) {
    return request<SuccessResponse>({
      path: `/cards/${cardId}/move`,
      method: 'PATCH',
      body: { column_id: columnId, order },
    })
  },

  uploadAttachment(projectId: number, formData: FormData) {
    return request<ProjectAttachment>({
      path: `/projects/${projectId}/attachments`,
      method: 'POST',
      body: formData,
    })
  },

  listAttachments(projectId: number, attachmentType?: AttachmentType) {
    return request<ProjectAttachment[]>({
      path: `/projects/${projectId}/attachments`,
      query: attachmentType ? { attachment_type: attachmentType } : undefined,
    })
  },

  getAttachment(attachmentId: number) {
    return request<ProjectAttachment>({
      path: `/projects/attachments/${attachmentId}`,
    })
  },

  updateAttachment(attachmentId: number, formData: FormData) {
    return request<ProjectAttachment>({
      path: `/projects/attachments/${attachmentId}`,
      method: 'PATCH',
      body: formData,
    })
  },

  deleteAttachment(attachmentId: number) {
    return request<{ message: string }>({
      path: `/projects/attachments/${attachmentId}`,
      method: 'DELETE',
    })
  },
}
