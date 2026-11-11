import { request, requestBlob } from '../http'
import type { PermissionSelection } from './rbac.service'

/* ──────────────────────────────────────────────────────────────
   Registration links — /registration-links/* (admin, CEO only) and
   /public/registration-links/* (no login).
   Contract: PLATFORM_FEATURES_FRONTEND.md → "Registration Links".
   Request bodies follow the OpenAPI schemas; responses are untyped there,
   so every reader below accepts the usual FastAPI shapes and normalises them.
   ────────────────────────────────────────────────────────────── */

export const REGISTRATION_FIELD_TYPES = [
  'text', 'textarea', 'email', 'phone', 'number', 'date', 'datetime',
  'select', 'multi_select', 'radio', 'checkbox', 'file', 'image', 'password',
] as const
export type RegistrationFieldType = (typeof REGISTRATION_FIELD_TYPES)[number]

/** Every form must contain these four (required) fields. */
export const REGISTRATION_BASE_FIELDS = [
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'surname', label: 'Surname', type: 'text' },
  { key: 'password', label: 'Password', type: 'password' },
] as const satisfies ReadonlyArray<{ key: string; label: string; type: RegistrationFieldType }>

export const REGISTRATION_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/

export const REGISTRATION_STATUSES = ['pending', 'approved', 'rejected'] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

/** Public upload limits (backend answers 413 above them). */
export const REGISTRATION_MAX_FILE_BYTES = 25 * 1024 * 1024
export const REGISTRATION_MAX_TOTAL_BYTES = 100 * 1024 * 1024

export type RegistrationField = {
  key: string
  label: string
  type: RegistrationFieldType
  required: boolean
  placeholder: string | null
  help_text: string | null
  /** select / multi_select / radio */
  options: string[]
  /** file / image: extensions (".pdf") or MIME types ("image/*") */
  accept: string[]
}

/** What POST / PATCH send for one field (empty optional parts are left out). */
export type RegistrationFieldPayload = {
  key: string
  label: string
  type: RegistrationFieldType
  required: boolean
  placeholder?: string
  help_text?: string
  options?: string[]
  accept?: string[]
}

export type RegistrationCounters = { total: number; pending: number; approved: number; rejected: number }

export type RegistrationForm = {
  id: string
  title: string
  slug: string
  description: string | null
  is_active: boolean
  fields: RegistrationField[]
  /** Number of fields when the list does not send the fields themselves. */
  field_count: number
  counts: RegistrationCounters
  created_at: string | null
  updated_at: string | null
}

export type RegistrationFormCreatePayload = {
  title: string
  slug?: string | null
  description?: string | null
  is_active: boolean
  fields: RegistrationFieldPayload[]
}

/** The slug cannot be changed after creation (RegistrationFormUpdate has no slug). */
export type RegistrationFormUpdatePayload = {
  title?: string
  description?: string | null
  is_active?: boolean
  fields?: RegistrationFieldPayload[]
}

/** DELETE removes an unused form and only deactivates a form that already has applications. */
export type RegistrationDeleteOutcome = 'deleted' | 'deactivated' | 'unknown'

export type RegistrationFile = {
  /** Stable key for React lists. */
  uid: string
  id: string | null
  field_key: string | null
  name: string
  content_type: string | null
  size: number | null
  /** Authenticated inline content (images, PDF). */
  preview_path: string | null
  /** Authenticated download. */
  download_path: string | null
}

export type RegistrationSubmissionSummary = {
  id: string
  form_id: string | null
  form_title: string | null
  form_slug: string | null
  status: RegistrationStatus
  email: string
  name: string
  surname: string
  created_at: string | null
  updated_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  user_id: number | null
}

export type RegistrationSubmission = RegistrationSubmissionSummary & {
  /** Answers by field key (never the password). */
  answers: Record<string, unknown>
  /** The exact schema the applicant filled in — render history with this, not with the current form. */
  fields_snapshot: RegistrationField[]
  files: RegistrationFile[]
  password_set: boolean
  reviewed_by: string | null
  role_name: string | null
  job_title: string | null
}

export type RegistrationSubmissionPage = {
  items: RegistrationSubmissionSummary[]
  total: number
  page: number
  page_size: number
  pages: number
}

export type RegistrationSubmissionQuery = {
  form_id?: string | null
  status?: RegistrationStatus | null
  search?: string | null
  page?: number
  page_size?: number
}

export type RegistrationApprovalPayload = {
  role_id: number
  job_title?: string | null
  company_code: string
  direct_permissions: PermissionSelection[]
}

export type PublicRegistrationForm = {
  title: string
  slug: string
  description: string | null
  is_active: boolean
  fields: RegistrationField[]
}

export type PublicSubmissionReceipt = {
  submission_id: string
  edit_token: string
  status: RegistrationStatus
}

export type PublicSubmissionStatus = {
  id: string
  status: RegistrationStatus
  rejection_reason: string | null
  email: string | null
  submitted_at: string | null
  reviewed_at: string | null
  /** Saved answers (without the password) — used to prefill a rejected application. */
  answers: Record<string, unknown>
  files: RegistrationFile[]
  fields_snapshot: RegistrationField[]
}

/** JSON (no files) or multipart: `data` (JSON string of the other fields) + `file__{key}` parts. */
export type RegistrationSubmissionBody = Record<string, unknown> | FormData

/* ── normalisers ─────────────────────────────────────────────── */

type Loose = Record<string, unknown>

const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null && !Array.isArray(value)
const asString = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value))
const asText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)
const asStrings = (value: unknown) => (Array.isArray(value) ? value.map(asString).filter((item) => item.trim() !== '') : [])

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

/** First present value among `keys`, looked up in each source in turn. */
function pick(sources: unknown[], keys: string[]): unknown {
  for (const source of sources) {
    if (!isObject(source)) continue
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null) return source[key]
    }
  }
  return undefined
}

/** First array found in `value` itself or under one of `keys`. */
function listOf(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value
  if (isObject(value)) {
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key] as unknown[]
    }
    for (const key of keys) {
      const nested = value[key]
      if (isObject(nested)) {
        const inner = listOf(nested, ['items', 'results', 'data'])
        if (inner.length) return inner
      }
    }
  }
  return []
}

const FIELD_TYPE_SET = new Set<string>(REGISTRATION_FIELD_TYPES)
const FIELD_TYPE_ALIASES: Record<string, RegistrationFieldType> = {
  string: 'text', short_text: 'text', long_text: 'textarea', tel: 'phone', integer: 'number', float: 'number',
  multiselect: 'multi_select', 'multi-select': 'multi_select', boolean: 'checkbox', bool: 'checkbox', photo: 'image', datetime_local: 'datetime',
}

function normalizeFieldType(value: unknown): RegistrationFieldType {
  const raw = asString(value).trim().toLowerCase()
  if (FIELD_TYPE_SET.has(raw)) return raw as RegistrationFieldType
  return FIELD_TYPE_ALIASES[raw] ?? 'text'
}

export function normalizeRegistrationField(raw: unknown): RegistrationField | null {
  if (!isObject(raw)) return null
  const key = asString(raw.key ?? raw.name ?? raw.field_key).trim()
  if (!key) return null
  return {
    key,
    label: asString(raw.label ?? raw.title ?? key) || key,
    type: normalizeFieldType(raw.type ?? raw.field_type),
    required: raw.required === true || raw.is_required === true,
    placeholder: asText(raw.placeholder),
    help_text: asText(raw.help_text ?? raw.helpText ?? raw.hint ?? raw.description),
    options: Array.isArray(raw.options)
      ? raw.options.map((option) => (isObject(option) ? asString(option.label ?? option.value) : asString(option))).filter((option) => option.trim() !== '')
      : [],
    accept: asStrings(raw.accept),
  }
}

function normalizeFields(raw: unknown): RegistrationField[] {
  const list = listOf(raw, ['fields', 'items', 'schema'])
  return list.map(normalizeRegistrationField).filter((field): field is RegistrationField => field !== null)
}

function normalizeStatus(value: unknown): RegistrationStatus {
  const raw = asString(value).trim().toLowerCase()
  if (raw === 'approved' || raw === 'accepted') return 'approved'
  if (raw === 'rejected' || raw === 'declined' || raw === 'denied') return 'rejected'
  return 'pending'
}

function normalizeCounters(data: Loose): RegistrationCounters {
  const sources = [data.counts, data.counters, data.stats, data.statistics, data.submission_counts, data.submissions_count, data.submission_stats, data]
  const read = (keys: string[]) => asNumber(pick(sources, keys))
  const pending = read(['pending', 'pending_count', 'pending_submissions', 'pending_submissions_count', 'submissions_pending']) ?? 0
  const approved = read(['approved', 'approved_count', 'approved_submissions', 'approved_submissions_count', 'submissions_approved']) ?? 0
  const rejected = read(['rejected', 'rejected_count', 'rejected_submissions', 'rejected_submissions_count', 'submissions_rejected']) ?? 0
  const total = read(['total', 'total_count', 'submission_count', 'submissions_count', 'total_submissions', 'submissions_total', 'all', 'count'])
  return { total: total ?? pending + approved + rejected, pending, approved, rejected }
}

export function normalizeRegistrationForm(raw: unknown): RegistrationForm {
  const data = isObject(raw) ? (isObject(raw.form) ? { ...raw, ...raw.form } : raw) : {}
  const fields = normalizeFields(data.fields ?? data.schema)
  return {
    id: asString(data.id ?? data.form_id),
    title: asString(data.title ?? data.name),
    slug: asString(data.slug),
    description: asText(data.description),
    is_active: data.is_active !== false && data.active !== false,
    fields,
    field_count: fields.length || (asNumber(data.field_count ?? data.fields_count) ?? 0),
    counts: normalizeCounters(data),
    created_at: asText(data.created_at),
    updated_at: asText(data.updated_at ?? data.created_at),
  }
}

/** Uploaded file — the private file id plus the authenticated paths to load it. */
function normalizeFile(raw: unknown, index: number, fallbackKey: string | null = null): RegistrationFile | null {
  if (typeof raw === 'string' && raw.trim()) {
    const looksLikeUrl = raw.startsWith('/') || /^https?:\/\//i.test(raw)
    return {
      uid: `${fallbackKey ?? 'file'}-${index}-${raw}`,
      id: looksLikeUrl ? null : raw,
      field_key: fallbackKey,
      name: looksLikeUrl ? decodeURIComponent(raw.split('?')[0].split('/').pop() || raw) : raw,
      content_type: null,
      size: null,
      preview_path: looksLikeUrl ? raw : `/file-manager/files/${encodeURIComponent(raw)}/content`,
      download_path: looksLikeUrl ? raw : `/file-manager/files/${encodeURIComponent(raw)}/download`,
    }
  }
  if (!isObject(raw)) return null
  const nested = isObject(raw.file) ? raw.file : {}
  const sources = [raw, nested]
  const idValue = pick(sources, ['file_manager_file_id', 'file_manager_id', 'stored_file_id', 'file_id', 'id'])
  const id = idValue == null ? null : asString(idValue)
  const name = asString(pick(sources, ['original_name', 'original_filename', 'filename', 'file_name', 'name', 'title'])) || `file-${index + 1}`
  const url = (keys: string[]) => asText(pick(sources, keys))
  const explicitPreview = url(['preview_url', 'content_url', 'inline_url', 'url'])
  const explicitDownload = url(['download_url', 'url', 'content_url'])
  const encoded = id ? encodeURIComponent(id) : null
  return {
    uid: `${id ?? name}-${index}`,
    id,
    field_key: asText(pick(sources, ['field_key', 'key', 'field', 'field_name'])) ?? fallbackKey,
    name,
    content_type: asText(pick(sources, ['content_type', 'mime_type', 'mimetype', 'mime'])),
    size: asNumber(pick(sources, ['size', 'size_bytes', 'file_size', 'bytes'])),
    preview_path: explicitPreview ?? (encoded ? `/file-manager/files/${encoded}/content` : null),
    download_path: explicitDownload ?? (encoded ? `/file-manager/files/${encoded}/download` : null),
  }
}

function normalizeFiles(raw: unknown): RegistrationFile[] {
  if (isObject(raw) && Array.isArray(raw.items)) return normalizeFiles(raw.items)
  if (isObject(raw)) {
    // { field_key: [file, …] }
    const grouped = Object.entries(raw).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map((item, index) => normalizeFile(item, index, key)),
    )
    return grouped.filter((file): file is RegistrationFile => file !== null)
  }
  return listOf(raw, []).map((item, index) => normalizeFile(item, index)).filter((file): file is RegistrationFile => file !== null)
}

/** Files of one answer value (an answer of a file field may itself hold the file objects). */
export function filesFromAnswer(value: unknown, fieldKey: string): RegistrationFile[] {
  const list = Array.isArray(value) ? value : value == null || value === '' ? [] : [value]
  return list.map((item, index) => normalizeFile(item, index, fieldKey)).filter((file): file is RegistrationFile => file !== null)
}

function answersOf(data: Loose): Record<string, unknown> {
  const raw = pick([data], ['answers', 'data', 'values', 'payload', 'responses', 'form_data'])
  if (isObject(raw)) return raw
  // [{key, value}] lists
  if (Array.isArray(raw)) {
    const result: Record<string, unknown> = {}
    for (const entry of raw) {
      if (isObject(entry)) {
        const key = asString(entry.key ?? entry.field_key ?? entry.name)
        if (key) result[key] = entry.value ?? entry.answer
      }
    }
    return result
  }
  return {}
}

function normalizeSummary(raw: unknown): RegistrationSubmissionSummary {
  const data = isObject(raw) ? raw : {}
  const answers = answersOf(data)
  const form = isObject(data.form) ? data.form : isObject(data.registration_form) ? data.registration_form : isObject(data.link) ? data.link : {}
  const applicant = isObject(data.applicant) ? data.applicant : {}
  const sources = [data, applicant, answers]
  const review = isObject(data.review) ? data.review : {}
  const userId = asNumber(pick([data, review], ['user_id', 'created_user_id', 'approved_user_id']) ?? (isObject(data.user) ? data.user.id : undefined))
  return {
    id: asString(data.id ?? data.submission_id),
    form_id: asText(asString(data.form_id ?? form.id)),
    form_title: asText(data.form_title ?? data.link_title ?? form.title),
    form_slug: asText(data.form_slug ?? data.slug ?? form.slug),
    status: normalizeStatus(data.status),
    email: asString(pick(sources, ['email'])),
    name: asString(pick(sources, ['name', 'first_name'])),
    surname: asString(pick(sources, ['surname', 'last_name'])),
    created_at: asText(data.submitted_at ?? data.created_at),
    updated_at: asText(data.updated_at ?? data.resubmitted_at),
    reviewed_at: asText(pick([data, review], ['reviewed_at', 'approved_at', 'rejected_at', 'decided_at'])),
    rejection_reason: asText(pick([data, review], ['rejection_reason', 'reject_reason', 'reason', 'review_note'])),
    user_id: userId,
  }
}

function normalizeSubmission(raw: unknown): RegistrationSubmission {
  const data = isObject(raw) ? (isObject(raw.submission) ? { ...raw, ...raw.submission } : raw) : {}
  const answers = { ...answersOf(data) }
  delete answers.password
  const review = isObject(data.review) ? data.review : {}
  const user = isObject(data.user) ? data.user : {}
  const role = isObject(data.role) ? data.role : isObject(user.role) ? user.role : {}
  return {
    ...normalizeSummary(data),
    answers,
    fields_snapshot: normalizeFields(data.fields_snapshot ?? data.schema_snapshot ?? data.fields ?? (isObject(data.form) ? data.form.fields : undefined)),
    files: normalizeFiles(data.files ?? data.uploaded_files ?? data.attachments ?? data.uploads),
    password_set: data.password_set === true || data.has_password === true,
    reviewed_by: asText(pick([data, review], ['reviewed_by_name', 'reviewer_name', 'reviewed_by'])),
    role_name: asText(pick([data, review, user], ['role_display_name', 'role_name']) ?? role.display_name ?? role.name),
    job_title: asText(pick([data, review, user], ['job_title'])),
  }
}

function normalizeSubmissionPage(raw: unknown, query: RegistrationSubmissionQuery): RegistrationSubmissionPage {
  const data = isObject(raw) ? raw : {}
  const items = listOf(raw, ['items', 'results', 'submissions', 'data']).map(normalizeSummary)
  const pageSize = asNumber(data.page_size ?? data.size ?? data.per_page ?? data.limit) ?? query.page_size ?? 50
  const total = asNumber(data.total ?? data.count ?? data.total_count) ?? items.length
  return {
    items,
    total,
    page: asNumber(data.page) ?? query.page ?? 1,
    page_size: pageSize,
    pages: asNumber(data.pages ?? data.total_pages) ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
  }
}

function normalizeDeleteOutcome(raw: unknown): RegistrationDeleteOutcome {
  if (!isObject(raw)) return 'unknown'
  const action = asString(raw.action ?? raw.result ?? raw.status ?? raw.outcome).toLowerCase()
  if (raw.deactivated === true || action.includes('deactivat') || raw.is_active === false) return 'deactivated'
  if (raw.deleted === true || action.includes('delet')) return 'deleted'
  return 'unknown'
}

function normalizePublicForm(raw: unknown): PublicRegistrationForm {
  const data = isObject(raw) ? (isObject(raw.form) ? { ...raw, ...raw.form } : raw) : {}
  return {
    title: asString(data.title ?? data.name),
    slug: asString(data.slug),
    description: asText(data.description),
    is_active: data.is_active !== false && data.active !== false,
    fields: normalizeFields(data.fields ?? data.schema),
  }
}

function normalizeReceipt(raw: unknown): PublicSubmissionReceipt {
  const data = isObject(raw) ? raw : {}
  const submission = isObject(data.submission) ? data.submission : {}
  return {
    submission_id: asString(data.submission_id ?? data.id ?? submission.id),
    edit_token: asString(data.edit_token ?? data.token ?? submission.edit_token),
    status: normalizeStatus(data.status ?? submission.status),
  }
}

function normalizePublicStatus(raw: unknown): PublicSubmissionStatus {
  const data = isObject(raw) ? (isObject(raw.submission) ? { ...raw, ...raw.submission } : raw) : {}
  const answers = { ...answersOf(data) }
  delete answers.password
  const summary = normalizeSummary(data)
  return {
    id: summary.id,
    status: summary.status,
    rejection_reason: summary.rejection_reason,
    email: asText(summary.email),
    submitted_at: summary.created_at,
    reviewed_at: summary.reviewed_at,
    answers,
    files: normalizeFiles(data.files ?? data.uploaded_files ?? data.attachments),
    fields_snapshot: normalizeFields(data.fields_snapshot ?? data.fields),
  }
}

/* ── endpoints ───────────────────────────────────────────────── */

const formPath = (formId: string) => `/registration-links/forms/${encodeURIComponent(formId)}`
const submissionPath = (submissionId: string) => `/registration-links/submissions/${encodeURIComponent(submissionId)}`
const publicPath = (slug: string) => `/public/registration-links/${encodeURIComponent(slug)}`

export const registrationsService = {
  async listForms(search?: string) {
    const raw = await request<unknown>({ path: '/registration-links', query: { search: search?.trim() || undefined } })
    return listOf(raw, ['items', 'forms', 'links', 'results', 'data']).map(normalizeRegistrationForm)
  },
  async getForm(formId: string) {
    return normalizeRegistrationForm(await request<unknown>({ path: formPath(formId) }))
  },
  async createForm(payload: RegistrationFormCreatePayload) {
    return normalizeRegistrationForm(await request<unknown>({ path: '/registration-links', method: 'POST', body: payload }))
  },
  async updateForm(formId: string, payload: RegistrationFormUpdatePayload) {
    return normalizeRegistrationForm(await request<unknown>({ path: formPath(formId), method: 'PATCH', body: payload }))
  },
  /** 'unknown' when the backend answers 204 — the caller then checks whether the form is still listed. */
  async removeForm(formId: string): Promise<RegistrationDeleteOutcome> {
    return normalizeDeleteOutcome(await request<unknown>({ path: formPath(formId), method: 'DELETE' }))
  },

  async listSubmissions(query: RegistrationSubmissionQuery) {
    const raw = await request<unknown>({
      path: '/registration-links/submissions/list',
      query: {
        form_id: query.form_id || undefined,
        status: query.status || undefined,
        search: query.search?.trim() || undefined,
        page: query.page ?? 1,
        page_size: query.page_size ?? 50,
      },
    })
    return normalizeSubmissionPage(raw, query)
  },
  async getSubmission(submissionId: string) {
    return normalizeSubmission(await request<unknown>({ path: submissionPath(submissionId) }))
  },
  approve(submissionId: string, payload: RegistrationApprovalPayload) {
    return request<unknown>({ path: `${submissionPath(submissionId)}/approve`, method: 'POST', body: payload })
  },
  reject(submissionId: string, reason: string | null) {
    return request<unknown>({ path: `${submissionPath(submissionId)}/reject`, method: 'POST', body: { reason } })
  },
  /** Private uploads are only readable with the bearer token. */
  fileBlob(path: string) {
    return requestBlob(path)
  },

  /* public — no login */
  async publicForm(slug: string) {
    return normalizePublicForm(await request<unknown>({ path: publicPath(slug), auth: false }))
  },
  async submit(slug: string, body: RegistrationSubmissionBody) {
    return normalizeReceipt(await request<unknown>({ path: `${publicPath(slug)}/submissions`, method: 'POST', body, auth: false }))
  },
  async status(slug: string, submissionId: string, token: string) {
    return normalizePublicStatus(await request<unknown>({
      path: `${publicPath(slug)}/submissions/${encodeURIComponent(submissionId)}`,
      query: { token },
      auth: false,
    }))
  },
  /** Only a rejected application can be resubmitted. A new `edit_token`, when the backend rotates it, is returned too. */
  async resubmit(slug: string, submissionId: string, token: string, body: RegistrationSubmissionBody) {
    const raw = await request<unknown>({
      path: `${publicPath(slug)}/submissions/${encodeURIComponent(submissionId)}`,
      method: 'PUT',
      query: { token },
      body,
      auth: false,
    })
    const receipt = normalizeReceipt(raw)
    return { status: normalizePublicStatus(raw), edit_token: receipt.edit_token || null }
  },
}
