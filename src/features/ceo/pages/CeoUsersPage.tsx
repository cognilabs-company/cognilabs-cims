import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../../shared/lib/cn'
import {
  ceoService,
  type CeoMessageRecord,
  type CeoUserRecord,
  type IncomingCeoMessageRecord,
  type UserPayload,
} from '../../../shared/api/services/ceo.service'
import { managementService } from '../../../shared/api/services/management.service'
import type { PermissionMap } from '../../../shared/api/types'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { formatCompactNumber, formatShortDate, formatShortMonthDayTime } from '../../../shared/lib/format'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { DataTable } from '../../../shared/ui/data-table'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { Textarea } from '../../../shared/ui/textarea'
import { PermissionEditorModal } from '../components/PermissionEditorModal'
import { type MessageComposerValues } from '../components/MessageComposerModal'
import { MetricCard } from '../components/MetricCard'
import { UserFormModal, type UserFormValues } from '../components/UserFormModal'
import { permissionCatalog } from '../lib/permissionCatalog'
import { resolveMediaUrl } from '../../../shared/lib/media-url'

const initialUserForm: UserFormValues = {
  email: '',
  name: '',
  surname: '',
  password: '',
  company_code: 'oddiy',
  telegram_id: '',
  default_salary: 0,
  job_title: '',
  role: 'Member',
  is_active: true,
}

const initialMessageForm: MessageComposerValues = {
  receiver_id: undefined,
  receiver_label: '',
  subject: '',
  body: '',
}

const emptyUsers: CeoUserRecord[] = []
const emptySentMessages: CeoMessageRecord[] = []
const emptyIncomingMessages: IncomingCeoMessageRecord[] = []
const now = new Date()
const supportedUserRoles = ['Member', 'Customer', 'SalesManager', 'Finance', 'CEO', 'Admin'] as const
type UserConversationEntry = {
  id: string
  direction: 'incoming' | 'outgoing'
  subject: string
  body: string
  sentAt: string
}

type UserConversationSummary = {
  entries: UserConversationEntry[]
  incomingCount: number
  outgoingCount: number
  totalCount: number
}

const emptyConversationSummary: UserConversationSummary = {
  entries: [],
  incomingCount: 0,
  outgoingCount: 0,
  totalCount: 0,
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function arePermissionMapsEqual(left: PermissionMap, right: PermissionMap) {
  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)

  if (leftEntries.length !== rightEntries.length) {
    return false
  }

  return leftEntries.every(([key, value]) => right[key] === value)
}

type MessagePresentation = {
  headline: string
  preview: string | null
  hasHiddenPayload: boolean
}

function normalizeMessageText(value: string) {
  return value.replace(/\r/g, '').trim()
}

function isOpaquePayloadLine(value: string) {
  const normalized = value.trim()

  if (!normalized || normalized.includes(' ')) {
    return false
  }

  if (/^https?:\/\//i.test(normalized)) {
    return false
  }

  if (normalized.length < 32) {
    return false
  }

  return /^[A-Za-z0-9:_-]+$/.test(normalized)
}

function stripOpaquePayload(value: string) {
  const lines = normalizeMessageText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const visibleLines = lines.filter((line) => !isOpaquePayloadLine(line))

  return {
    text: visibleLines.join('\n').trim(),
    hasHiddenPayload: visibleLines.length !== lines.length,
  }
}

function getMessagePresentation(entry: UserConversationEntry): MessagePresentation {
  const subject = stripOpaquePayload(entry.subject)
  const body = stripOpaquePayload(entry.body)
  const headline = subject.text || body.text || (subject.hasHiddenPayload || body.hasHiddenPayload ? 'Media attachment' : 'Untitled message')
  const preview = body.text && body.text !== headline ? body.text : null

  return {
    headline,
    preview,
    hasHiddenPayload: subject.hasHiddenPayload || body.hasHiddenPayload,
  }
}

function formatSalary(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return new Intl.NumberFormat('en-US').format(value)
}

function normalizeUserRole(value?: string | null) {
  const normalizedValue = String(value ?? '').trim().toLowerCase()
  const matchedRole = supportedUserRoles.find((role) => role.toLowerCase() === normalizedValue)

  if (matchedRole) {
    return matchedRole
  }

  return String(value ?? initialUserForm.role).trim() || initialUserForm.role
}

function isCeoUser(user: CeoUserRecord) {
  return normalizeUserRole(String(user.role ?? '')) === 'CEO'
}

function getRoleTextClass(role?: string | null) {
  switch (normalizeUserRole(role)) {
    case 'CEO':
      return 'text-[var(--violet-text)]'
    case 'Finance':
      return 'text-[var(--success-text)]'
    case 'SalesManager':
      return 'text-[var(--warning-text)]'
    case 'Admin':
      return 'text-[var(--danger-text)]'
    case 'Customer':
      return 'text-sky-500'
    case 'Member':
    default:
      return 'text-[var(--blue-text)]'
  }
}

function renderJobTitleTag(jobTitle: string, role?: string | null) {
  const isCeo = normalizeUserRole(String(role ?? '')) === 'CEO'

  return (
    <span
      data-keep-color="true"
      className={cn(
        'mt-1 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
        isCeo
          ? 'border-[var(--violet-border)] bg-[var(--violet-dim)] text-[var(--violet-text)]'
          : 'border-[var(--success-border)] bg-[var(--success-dim)] text-[var(--success-text)]',
      )}
    >
      {jobTitle}
    </span>
  )
}

function getUserDisplayName(user: Pick<CeoUserRecord, 'name' | 'surname'>) {
  return `${user.name} ${user.surname}`.trim()
}

function getUserInitials(user: Pick<CeoUserRecord, 'name' | 'surname'>) {
  return `${user.name?.charAt(0) ?? ''}${user.surname?.charAt(0) ?? ''}`.toUpperCase() || '?'
}

function getUserAvatarHue(user: Pick<CeoUserRecord, 'name'>) {
  return ((user.name?.charCodeAt(0) ?? 0) * 7) % 360
}

function UserAvatar({
  user,
  size = 'md',
}: {
  user: Pick<CeoUserRecord, 'name' | 'surname' | 'profile_image'>
  size?: 'sm' | 'md' | 'lg'
}) {
  const imageUrl = resolveMediaUrl(user.profile_image) ?? user.profile_image
  const sizeClassName = size === 'lg' ? 'h-16 w-16 text-lg' : size === 'sm' ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-base'

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={getUserDisplayName(user)}
        className={cn('shrink-0 rounded-full border border-white/10 object-cover', sizeClassName)}
      />
    )
  }

  const hue = getUserAvatarHue(user)

  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-full font-bold', sizeClassName)}
      style={{
        background: `hsl(${hue}, 45%, 18%)`,
        color: `hsl(${hue}, 65%, 65%)`,
      }}
    >
      {getUserInitials(user)}
    </div>
  )
}

function formatMessageTimestamp(sentAt?: string | null) {
  if (!sentAt) {
    return '-'
  }

  const parsed = new Date(sentAt)

  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return formatShortMonthDayTime(sentAt)
}

function toUserFormValues(user?: CeoUserRecord | null): UserFormValues {
  if (!user) {
    return initialUserForm
  }

  return {
    email: user.email ?? '',
    name: user.name ?? '',
    surname: user.surname ?? '',
    password: '',
    company_code: user.company_code ?? 'oddiy',
    telegram_id: user.telegram_id ?? '',
    default_salary: typeof user.default_salary === 'number' ? user.default_salary : 0,
    job_title: user.job_title ?? '',
    role: String(user.role ?? initialUserForm.role).trim() || initialUserForm.role,
    is_active: Boolean(user.is_active),
  }
}

function toUserPayload(values: UserFormValues, mode: 'create' | 'edit'): UserPayload {
  const payload: UserPayload = {
    email: values.email.trim(),
    name: values.name.trim(),
    surname: values.surname.trim(),
    company_code: values.company_code.trim(),
    telegram_id: values.telegram_id?.trim() || undefined,
    default_salary: Number(values.default_salary ?? 0),
    job_title: values.job_title?.trim() || undefined,
    role: values.role,
    is_active: values.is_active,
  }

  if (mode === 'create' || values.password.trim()) {
    payload.password = values.password
  }

  return payload
}

export function CeoUsersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
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

  const dashboardQuery = useAsyncData(() => ceoService.getDashboard(), [])
  const permissionsOverviewQuery = useAsyncData(() => ceoService.permissionsOverview(), [])
  const sentMessagesQuery = useAsyncData(() => ceoService.listMessages(), [])
  const incomingMessagesQuery = useAsyncData(() => ceoService.listMyMessages(), [])
  const rolesQuery = useAsyncData(() => managementService.listRoles(), [])

  const roleOptions = useMemo(() => {
    const activeRoles = (rolesQuery.data ?? []).filter((role) => role.is_active)
    return activeRoles.map((role) => ({
      value: role.name,
      label: role.display_name || role.name,
    }))
  }, [rolesQuery.data])

  const [userModalMode, setUserModalMode] = useState<'create' | 'edit'>('create')
  const [selectedUser, setSelectedUser] = useState<CeoUserRecord | null>(null)
  const [userFormValues, setUserFormValues] = useState<UserFormValues>(initialUserForm)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [isUserSubmitting, setIsUserSubmitting] = useState(false)
  const [profileUser, setProfileUser] = useState<CeoUserRecord | null>(null)

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
  const [permissionTargetUser, setPermissionTargetUser] = useState<CeoUserRecord | null>(null)
  const [permissionState, setPermissionState] = useState<PermissionMap>({})
  const [activePermissionsCount, setActivePermissionsCount] = useState(0)
  const [totalAvailablePages, setTotalAvailablePages] = useState<number>(permissionCatalog.length)
  const [availablePermissions, setAvailablePermissions] = useState<string[]>(permissionCatalog.map((item) => item.key))
  const [isPermissionLoading, setIsPermissionLoading] = useState(false)
  const [isPermissionSubmitting, setIsPermissionSubmitting] = useState(false)

  const [messageThreadUser, setMessageThreadUser] = useState<CeoUserRecord | null>(null)
  const [messageValues, setMessageValues] = useState<MessageComposerValues>(initialMessageForm)
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false)
  const [isMessageSubmitting, setIsMessageSubmitting] = useState(false)

  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const profileImageRef = useRef<HTMLInputElement>(null)

  const users = dashboardQuery.data?.users ?? emptyUsers
  const statistics = dashboardQuery.data?.statistics
  const sentMessages = sentMessagesQuery.data?.messages ?? emptySentMessages
  const incomingMessages = incomingMessagesQuery.data?.messages ?? emptyIncomingMessages

  const filteredUsers = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()

    if (!normalizedSearch) {
      return users
    }

    return users.filter((user) =>
      [user.name, user.surname, user.email, user.role, user.company_code, user.job_title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    )
  }, [deferredSearch, users])

  const permissionsByUserId = useMemo(() => {
    const map = new Map<number, { permissions_count: number; permissions_display: string[] }>()
    for (const u of permissionsOverviewQuery.data?.users ?? []) {
      map.set(u.user_id, {
        permissions_count: u.permissions_count,
        permissions_display: u.permissions_display,
      })
    }
    return map
  }, [permissionsOverviewQuery.data?.users])

  const conversationByUserId = useMemo(() => {
    const sentEntriesByEmail = new Map<string, UserConversationEntry[]>()
    const incomingEntriesByUserId = new Map<number, UserConversationEntry[]>()

    for (const message of sentMessages) {
      const receiverEmail = message.receiver_email.trim().toLowerCase()

      if (!receiverEmail) {
        continue
      }

      const current = sentEntriesByEmail.get(receiverEmail) ?? []
      current.push({
        id: `outgoing-${message.id}`,
        direction: 'outgoing',
        subject: message.subject ?? '',
        body: message.body ?? '',
        sentAt: message.sent_at,
      })
      sentEntriesByEmail.set(receiverEmail, current)
    }

    for (const message of incomingMessages) {
      const senderId = Number(message.sender_id)

      if (!Number.isFinite(senderId)) {
        continue
      }

      const current = incomingEntriesByUserId.get(senderId) ?? []
      current.push({
        id: `incoming-${message.id}`,
        direction: 'incoming',
        subject: message.subject ?? '',
        body: message.body ?? '',
        sentAt: message.sent_at,
      })
      incomingEntriesByUserId.set(senderId, current)
    }

    const conversations = new Map<number, UserConversationSummary>()

    for (const user of users) {
      const outgoingEntries = sentEntriesByEmail.get(user.email.trim().toLowerCase()) ?? []
      const incomingEntries = incomingEntriesByUserId.get(user.id) ?? []
      const entries = [...outgoingEntries, ...incomingEntries].sort(
        (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime(),
      )

      conversations.set(user.id, {
        entries,
        incomingCount: incomingEntries.length,
        outgoingCount: outgoingEntries.length,
        totalCount: entries.length,
      })
    }

    return conversations
  }, [incomingMessages, sentMessages, users])

  const activeConversation = messageThreadUser
    ? (conversationByUserId.get(messageThreadUser.id) ?? emptyConversationSummary)
    : emptyConversationSummary

  useEffect(() => {
    if (!isPermissionModalOpen || !permissionTargetUser) {
      return
    }

    const targetUser = permissionTargetUser
    let isActive = true

    async function loadUserPermissions() {
      setIsPermissionLoading(true)

      try {
        const response = await ceoService.getUserPermissions(targetUser.id)

        if (!isActive) {
          return
        }

        setPermissionState((current) => (
          arePermissionMapsEqual(current, response.permissions) ? current : response.permissions
        ))
        setActivePermissionsCount((current) => (
          current === response.active_permissions_count ? current : response.active_permissions_count
        ))
        setTotalAvailablePages((current) => (
          current === response.total_available_pages ? current : response.total_available_pages
        ))

        const overviewPermissions = permissionsOverviewQuery.data?.available_pages ?? []
        const mergedPermissions = Array.from(
          new Set([
            ...overviewPermissions,
            ...Object.keys(response.permissions),
            ...permissionCatalog.map((item) => item.key),
          ]),
        )
        setAvailablePermissions((current) => (
          areStringArraysEqual(current, mergedPermissions) ? current : mergedPermissions
        ))
      } catch (error) {
        if (!isActive) {
          return
        }

        showToast({
          title: lt('Permissions failed to load'),
          description: error instanceof Error ? error.message : lt('Error fetching user permission details.'),
          tone: 'error',
        })
      } finally {
        if (isActive) {
          setIsPermissionLoading(false)
        }
      }
    }

    void loadUserPermissions()

    return () => {
      isActive = false
    }
  }, [isPermissionModalOpen, lt, permissionTargetUser, permissionsOverviewQuery.data?.available_pages, showToast])

  function refreshAll() {
    return Promise.all([
      dashboardQuery.refetch(),
      permissionsOverviewQuery.refetch(),
      sentMessagesQuery.refetch(),
      incomingMessagesQuery.refetch(),
      rolesQuery.refetch(),
    ])
  }

  function openCreateUserModal() {
    setSelectedUser(null)
    setUserModalMode('create')
    const defaultRoleValue =
      roleOptions.find((option) => option.value === initialUserForm.role)?.value
      ?? roleOptions[0]?.value
      ?? initialUserForm.role
    setUserFormValues({ ...initialUserForm, role: defaultRoleValue })
    setIsUserModalOpen(true)
  }

  function openEditUserModal(user: CeoUserRecord) {
    setSelectedUser(user)
    setUserModalMode('edit')
    setUserFormValues(toUserFormValues(user))
    setIsUserModalOpen(true)
  }

  function openProfileDialog(user: CeoUserRecord) {
    setProfileUser(user)
  }

  function openSalaryDetail(user: CeoUserRecord) {
    navigate(`/faults/members/${user.id}?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
  }

  async function handleSubmitUser() {
    if (!userFormValues.email.trim() || !userFormValues.name.trim() || !userFormValues.surname.trim()) {
      showToast({
        title: lt('Required fields missing'),
        description: lt('Email, name, and surname are required.'),
        tone: 'error',
      })
      return
    }

    if (userModalMode === 'create' && !userFormValues.password.trim()) {
      showToast({
        title: lt('Password required'),
        description: lt('Password cannot be empty when creating a new user.'),
        tone: 'error',
      })
      return
    }

    if (
      userModalMode === 'edit' &&
      selectedUser &&
      selectedUser.is_active &&
      !userFormValues.is_active &&
      isCeoUser(selectedUser)
    ) {
      const approved = await confirm({
        title: `${lt('Deactivate CEO')} ${selectedUser.name} ${selectedUser.surname}?`,
        description: lt('Saving this form will deactivate a CEO account.'),
        confirmLabel: lt('Deactivate CEO'),
        cancelLabel: lt('Cancel'),
        tone: 'danger',
      })

      if (!approved) {
        return
      }
    }

    setIsUserSubmitting(true)

    try {
      const payload = toUserPayload(userFormValues, userModalMode)

      if (userModalMode === 'create') {
        await ceoService.createUser(payload)
      } else if (selectedUser) {
        await ceoService.updateUser(selectedUser.id, payload)
      }

      await refreshAll()
      setIsUserModalOpen(false)
      showToast({
        title: userModalMode === 'create' ? lt('User created') : lt('User updated'),
        description: lt('CEO user list has been successfully updated.'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('User not saved'),
        description: error instanceof Error ? error.message : lt('Error in user CRUD request.'),
        tone: 'error',
      })
    } finally {
      setIsUserSubmitting(false)
    }
  }

  async function handleDeleteUser(user: CeoUserRecord) {
    const isDeletingCeo = isCeoUser(user)
    const approved = await confirm({
      title: isDeletingCeo ? `${lt('Delete CEO')} ${user.name} ${user.surname}?` : `${lt('Delete')} ${user.name} ${user.surname}?`,
      description: isDeletingCeo
        ? lt('This CEO account will be permanently removed from the system. Please confirm this destructive action.')
        : lt('This user will be permanently removed from the system.'),
      confirmLabel: isDeletingCeo ? lt('Delete CEO') : lt('Delete user'),
      cancelLabel: lt('Cancel'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    try {
      await ceoService.deleteUser(user.id)
      await refreshAll()
      showToast({
        title: lt('User deleted'),
        description: `${user.email} ${lt('has been removed from the system.')}`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Delete failed'),
        description: error instanceof Error ? error.message : lt('User delete flow failed.'),
        tone: 'error',
      })
    }
  }

  async function handleToggleUser(user: CeoUserRecord) {
    const nextStatusLabel = user.is_active ? 'inactive' : 'active'
    const isDeactivatingCeo = user.is_active && isCeoUser(user)

    if (isDeactivatingCeo) {
      const approved = await confirm({
        title: `${lt('Deactivate CEO')} ${user.name} ${user.surname}?`,
        description: lt('This will disable a CEO account until it is activated again.'),
        confirmLabel: lt('Deactivate CEO'),
        cancelLabel: lt('Cancel'),
        tone: 'danger',
      })

      if (!approved) {
        return
      }
    }

    try {
      await ceoService.toggleUserActive(user.id)
      await dashboardQuery.refetch()
      showToast({
        title: `${lt('User set to')} ${lt(nextStatusLabel)}`,
        description: `${user.email} ${lt('is now marked as')} ${lt(nextStatusLabel)}.`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Status update failed'),
        description: error instanceof Error ? error.message : lt('Error changing active status.'),
        tone: 'error',
      })
    }
  }

  function openPermissionModal(user: CeoUserRecord) {
    setPermissionTargetUser(user)
    setIsPermissionModalOpen(true)
  }

  function togglePermission(permissionKey: string, nextValue: boolean) {
    setPermissionState((current) => ({
      ...current,
      [permissionKey]: nextValue,
    }))
  }

  async function handleReplacePermissions() {
    if (!permissionTargetUser) {
      return
    }

    setIsPermissionSubmitting(true)

    try {
      await ceoService.updateUserPermissions(permissionTargetUser.id, permissionState)
      await permissionsOverviewQuery.refetch()
      const nextActiveCount = Object.values(permissionState).filter(Boolean).length
      setActivePermissionsCount(nextActiveCount)
      showToast({
        title: lt('Permissions updated'),
        description: `${lt('Checkbox values saved for')} ${permissionTargetUser.email}.`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Permissions not saved'),
        description: error instanceof Error ? error.message : lt('Permission replace flow failed.'),
        tone: 'error',
      })
    } finally {
      setIsPermissionSubmitting(false)
    }
  }

  async function handleAddSelectedPermissions() {
    if (!permissionTargetUser) {
      return
    }

    setIsPermissionSubmitting(true)

    try {
      await ceoService.addUserPermissions(permissionTargetUser.id, permissionState)
      const refreshed = await ceoService.getUserPermissions(permissionTargetUser.id)
      setPermissionState(refreshed.permissions)
      setActivePermissionsCount(refreshed.active_permissions_count)
      await permissionsOverviewQuery.refetch()
      showToast({
        title: lt('Permissions added'),
        description: lt('Selected permissions have been added to the user.'),
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Permissions not added'),
        description: error instanceof Error ? error.message : lt('Add permission flow failed.'),
        tone: 'error',
      })
    } finally {
      setIsPermissionSubmitting(false)
    }
  }

  async function handleRemovePermission(permissionKey: string) {
    if (!permissionTargetUser) {
      return
    }

    try {
      await ceoService.removeUserPermission(permissionTargetUser.id, permissionKey)
      setPermissionState((current) => ({
        ...current,
        [permissionKey]: false,
      }))
      setActivePermissionsCount((current) => Math.max(0, current - 1))
      await permissionsOverviewQuery.refetch()
      showToast({
        title: lt('Permission removed'),
        description: `${permissionKey} ${lt('has been removed from the user.')}`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Permission not removed'),
        description: error instanceof Error ? error.message : lt('Single remove flow failed.'),
        tone: 'error',
      })
    }
  }

  function openMessageDialog(user: CeoUserRecord) {
    setMessageThreadUser(user)
    setMessageValues({
      receiver_id: user.id,
      receiver_label: `${user.name} ${user.surname} (${user.email})`,
      subject: '',
      body: '',
    })
    setIsMessageDialogOpen(true)
  }

  async function handleSendSingleMessage() {
    if (!messageValues.receiver_id || !messageValues.subject.trim() || !messageValues.body.trim()) {
      showToast({
        title: lt('Message incomplete'),
        description: lt('Receiver, subject, and body are required.'),
        tone: 'error',
      })
      return
    }

    setIsMessageSubmitting(true)

    try {
      await ceoService.sendMessageToUser({
        receiver_id: messageValues.receiver_id,
        subject: messageValues.subject.trim(),
        body: messageValues.body.trim(),
      })
      await Promise.all([sentMessagesQuery.refetch(), dashboardQuery.refetch()])
      setMessageValues((current) => ({
        ...current,
        subject: '',
        body: '',
      }))
      showToast({
        title: lt('Message sent'),
        description: messageValues.receiver_label,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Message not sent'),
        description: error instanceof Error ? error.message : lt('Single user message flow failed.'),
        tone: 'error',
      })
    } finally {
      setIsMessageSubmitting(false)
    }
  }

  async function handleUploadProfileImage(file: File) {
    if (!profileUser) return
    setIsUploadingImage(true)
    try {
      await ceoService.uploadUserProfileImage(profileUser.id, file)
      const refreshedDashboard = await dashboardQuery.refetch()
      const updated = refreshedDashboard.users.find((u) => u.id === profileUser.id)
      if (updated) setProfileUser(updated)
      showToast({ title: lt('Profile image updated'), tone: 'success' })
    } catch (error) {
      showToast({
        title: lt('Image upload failed'),
        description: error instanceof Error ? error.message : lt('Upload error.'),
        tone: 'error',
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  if (dashboardQuery.isLoading && !dashboardQuery.data) {
    return (
      <LoadingStateBlock
        eyebrow={lt('CEO / Users')}
        title={lt('Users module loading')}
        description={lt('Fetching CEO users list and permissions overview.')}
      />
    )
  }

  if (dashboardQuery.isError && !dashboardQuery.data) {
    return (
      <ErrorStateBlock
        eyebrow={lt('CEO / Users')}
        title={lt('Users module failed to load')}
        description={lt('Could not fetch user data. Please retry.')}
        actionLabel={lt('Retry')}
        onAction={() => {
          void refreshAll()
        }}
      />
    )
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4 stagger-children">
        <MetricCard label={lt('Users')} value={formatCompactNumber(statistics?.user_count ?? users.length)} accent="blue" sparkBars={[4,5,6,7,7,8]} />
        <MetricCard label={tr('Active', 'Faol', 'Активные')} value={formatCompactNumber(statistics?.active_user_count ?? 0)} accent="success" sparkBars={[5,6,6,7,8,8]} />
        <MetricCard label={tr('Inactive', 'Nofaol', 'Неактивные')} value={formatCompactNumber(statistics?.inactive_user_count ?? 0)} accent="warning" sparkBars={[3,2,3,2,2,2]} />
        <MetricCard label={tr('Messages', 'Xabarlar', 'Сообщения')} value={formatCompactNumber(statistics?.messages_count ?? 0)} accent="violet" sparkBars={[2,3,4,3,5,4]} />
      </div>

      <Card noPadding>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{lt('CEO users table')}</CardTitle>
          <div className="flex items-center gap-3">
            <Input
              className="w-full md:w-80"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={lt('Search by email, name, or role')}
            />
            <Button variant="secondary" size="sm" onClick={() => void refreshAll()}>
              {lt('Refresh')}
            </Button>
            <Button size="sm" onClick={openCreateUserModal}>
              {tr('Create user', 'Foydalanuvchi yaratish', 'Создать пользователя')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            caption={lt('CEO users table')}
            rows={filteredUsers}
            getRowKey={(row) => String(row.id)}
            onRowClick={openProfileDialog}
            zebra
            emptyState={
              <EmptyStateBlock
                eyebrow={lt('CEO / Users')}
                title={lt('No users found')}
                description={lt('There are no users matching your search or the database is empty.')}
              />
            }
            columns={[
              {
                key: 'identity',
                header: lt('User'),
                render: (row) => (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      openProfileDialog(row)
                    }}
                    className="group/user flex w-full items-center gap-3 rounded-xl py-1 text-left transition hover:text-[var(--blue-text)] focus-visible:outline-none"
                    aria-label={`${lt('Profile')}: ${row.name} ${row.surname}`}
                  >
                    <UserAvatar user={row} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--foreground)] transition group-hover/user:text-[var(--blue-text)]">
                        {row.name} {row.surname}
                      </p>
                      <p className="truncate text-xs font-medium text-[var(--muted-strong)]">{row.email}</p>
                      {row.job_title ? (
                        renderJobTitleTag(row.job_title, row.role)
                      ) : null}
                    </div>
                  </button>
                ),
              },
              {
                key: 'role',
                header: lt('Role'),
                render: (row) => (
                  <span
                    data-keep-color="true"
                    className={cn('text-xs font-semibold', getRoleTextClass(row.role))}
                  >
                    {row.role}
                  </span>
                ),
              },
              {
                key: 'permissions',
                header: lt('Permissions'),
                render: (row) => {
                  const perms = permissionsByUserId.get(row.id)
                  if (!perms) return <span className="text-xs text-zinc-500">—</span>
                  return (
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge className="bg-white/5 text-white border-white/10 text-[10px]">
                        {perms.permissions_count}
                      </Badge>
                      {perms.permissions_display.slice(0, 2).map((p) => (
                        <Badge key={p} className="bg-white/5 text-white/60 border-white/8 text-[10px]">
                          {p}
                        </Badge>
                      ))}
                      {perms.permissions_display.length > 2 && (
                        <Badge className="bg-white/5 text-white/40 border-white/8 text-[10px]">
                          +{perms.permissions_display.length - 2}
                        </Badge>
                      )}
                    </div>
                  )
                },
              },
              {
                key: 'messages',
                header: tr('Messages', 'Xabarlar', 'Сообщения'),
                width: '140px',
                render: (row) => {
                  const conversation = conversationByUserId.get(row.id) ?? emptyConversationSummary
                  const isMessageDataLoading =
                    sentMessagesQuery.isLoading ||
                    incomingMessagesQuery.isLoading

                  if (isMessageDataLoading && !sentMessagesQuery.data && !incomingMessagesQuery.data) {
                    return <span className="text-xs text-zinc-600">…</span>
                  }

                  return (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        openMessageDialog(row)
                      }}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-1.5 text-left transition hover:border-blue-400/30 hover:bg-blue-500/8"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 shrink-0 text-blue-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {conversation.totalCount > 0 ? (
                        <span className="text-xs font-semibold text-white">
                          {conversation.totalCount}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">{lt('Send')}</span>
                      )}
                    </button>
                  )
                },
              },
              {
                key: 'status',
                header: lt('Status'),
                render: (row) => (
                  <span
                    data-keep-color="true"
                    className={cn('text-xs font-bold uppercase tracking-wider', row.is_active ? 'text-emerald-400' : 'text-rose-500')}
                  >
                    {row.is_active ? tr('Active', 'Faol', 'Активные') : tr('Inactive', 'Nofaol', 'Неактивные')}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: lt('Actions'),
                render: (row) => (
                  <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                    <button type="button" title={lt('Edit')} onClick={() => openEditUserModal(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" title={lt('Delete')} onClick={() => void handleDeleteUser(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                    <ActionsMenu
                      label={`${lt('Open actions for')} ${row.email}`}
                      items={[
                        { label: lt('Profile'), onSelect: () => openProfileDialog(row) },
                        { label: lt('Salary detail'), onSelect: () => openSalaryDetail(row) },
                        { label: 'View Activity Logs', onSelect: () => navigate(`/audit/logs?actor_user_id=${row.id}`) },
                        { label: lt('Permissions'), onSelect: () => openPermissionModal(row) },
                        { label: row.is_active ? lt('Deactivate') : lt('Activate'), onSelect: () => void handleToggleUser(row) },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <UserFormModal
        open={isUserModalOpen}
        mode={userModalMode}
        values={userFormValues}
        roleOptions={roleOptions}
        isRolesLoading={rolesQuery.isLoading && !rolesQuery.data}
        onClose={() => setIsUserModalOpen(false)}
        onChange={(field, value) =>
          setUserFormValues((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onSubmit={() => void handleSubmitUser()}
        isSubmitting={isUserSubmitting}
      />

      <PermissionEditorModal
        open={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        userName={
          permissionTargetUser ? `${permissionTargetUser.name} ${permissionTargetUser.surname}` : 'Selected user'
        }
        permissions={permissionState}
        availablePermissions={availablePermissions}
        activePermissionsCount={activePermissionsCount}
        totalAvailablePages={totalAvailablePages}
        onToggle={togglePermission}
        onReplaceAll={() => void handleReplacePermissions()}
        onAddSelected={() => void handleAddSelectedPermissions()}
        onRemovePermission={(permissionKey) => void handleRemovePermission(permissionKey)}
        isSubmitting={isPermissionSubmitting || isPermissionLoading}
      />

      <Dialog
        open={isMessageDialogOpen}
        onClose={() => setIsMessageDialogOpen(false)}
        title={messageThreadUser ? `Messages with ${getUserDisplayName(messageThreadUser)}` : 'Message thread'}
        description={
          messageThreadUser
            ? `${activeConversation.outgoingCount} ${lt('sent')} / ${activeConversation.incomingCount} ${lt('incoming')}`
            : lt('Review prior conversation and send a new message.')
        }
        size="xl"
      >
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">{lt('Conversation')}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {lt('Previous messages and latest activity appear here.')}
                </p>
              </div>
              <Badge variant="outline">{activeConversation.totalCount} {lt('entries')}</Badge>
            </div>

            <div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto pr-1">
              {activeConversation.totalCount > 0 ? (
                activeConversation.entries.map((entry) => {
                  const presentation = getMessagePresentation(entry)

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        'relative min-w-0 max-w-[90%] overflow-hidden rounded-xl border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                        entry.direction === 'outgoing'
                          ? 'ml-auto border-violet-500/24 bg-[linear-gradient(180deg,rgba(139,92,246,0.16),rgba(139,92,246,0.08))]'
                          : 'border-blue-500/22 bg-[linear-gradient(180deg,rgba(59,130,246,0.14),rgba(59,130,246,0.07))]',
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          variant={entry.direction === 'incoming' ? 'blue' : 'violet'}
                          size="sm"
                        >
                          {entry.direction === 'incoming' ? t('ceo.users.thread.from_user') : t('ceo.users.thread.from_ceo')}
                        </Badge>
                        <span className="text-[11px] text-white/45">
                          {formatMessageTimestamp(entry.sentAt)}
                        </span>
                      </div>

                      <div className="mt-3 min-w-0 space-y-2">
                        <p className="break-words text-[15px] font-semibold text-white">
                          {presentation.headline}
                        </p>
                        {presentation.preview ? (
                          <p className="break-words whitespace-pre-wrap text-[13px] leading-6 text-white/72">
                            {presentation.preview}
                          </p>
                        ) : null}
                      </div>

                      {presentation.hasHiddenPayload ? (
                        <div className="mt-3">
                          <Badge variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-white/60">
                            {t('ceo.users.thread.attachment_hidden')}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-zinc-500">
                  {t('ceo.users.thread.empty')}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Card variant="glass" className="space-y-4 rounded-xl border-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-3">
                {messageThreadUser ? <UserAvatar user={messageThreadUser} size="md" /> : null}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {messageThreadUser ? getUserDisplayName(messageThreadUser) : t('ceo.users.thread.selected_user')}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {messageThreadUser?.email ?? t('ceo.users.thread.no_recipient')}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(96px,1fr))]">
                <div className="min-w-0 rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-3 py-3">
                  <p className="ui-card-label leading-[1.35] text-[var(--caption)] [overflow-wrap:anywhere]">{t('ceo.users.thread.sent')}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{activeConversation.outgoingCount}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-3 py-3">
                  <p className="ui-card-label leading-[1.35] text-[var(--caption)] [overflow-wrap:anywhere]">{t('ceo.users.thread.incoming')}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{activeConversation.incomingCount}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-3 py-3">
                  <p className="ui-card-label leading-[1.35] text-[var(--caption)] [overflow-wrap:anywhere]">{t('ceo.users.thread.latest')}</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {activeConversation.entries.length > 0
                      ? formatShortDate(activeConversation.entries[activeConversation.entries.length - 1]?.sentAt)
                      : '-'}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="space-y-4 rounded-xl border-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div>
                <p className="text-sm font-semibold text-white">{t('ceo.users.thread.write_title')}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {t('ceo.users.thread.write_description')}
                </p>
              </div>

              <Label className="grid gap-2">
                <span className="text-xs font-semibold text-white">{t('ceo.messages.subject')}</span>
                <Input
                  value={messageValues.subject}
                  placeholder={t('ceo.messages.subject_placeholder')}
                  onChange={(event) =>
                    setMessageValues((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                />
              </Label>

              <Label className="grid gap-2">
                <span className="text-xs font-semibold text-white">{t('ceo.messages.body')}</span>
                <Textarea
                  rows={8}
                  value={messageValues.body}
                  placeholder={t('ceo.messages.body_placeholder')}
                  onChange={(event) =>
                    setMessageValues((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                />
              </Label>

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsMessageDialogOpen(false)}>
                  {t('common.close')}
                </Button>
                <Button onClick={() => void handleSendSingleMessage()} loading={isMessageSubmitting}>
                  {t('ceo.messages.send')}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(profileUser)}
        onClose={() => setProfileUser(null)}
        title={profileUser ? `${profileUser.name} ${profileUser.surname}` : t('ceo.users.profile.title')}
        description={profileUser?.email ?? t('ceo.users.profile.description')}
        size="lg"
        footer={
          <>
            {profileUser ? (
              <>
                <Button onClick={() => openSalaryDetail(profileUser)}>
                  {t('ceo.users.profile.open_salary')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/audit/logs?actor_user_id=${profileUser.id}`)}
                >
                  View Activity Logs
                </Button>
              </>
            ) : null}
            <Button variant="secondary" onClick={() => setProfileUser(null)}>
              {t('common.close')}
            </Button>
          </>
        }
      >
        {/* Profile image section */}
        <div className="mb-4 flex items-center gap-4">
          {profileUser ? <UserAvatar user={profileUser} size="lg" /> : null}
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{profileUser?.name} {profileUser?.surname}</p>
            <p className="mb-2 text-xs text-[var(--muted-strong)]">{profileUser?.email}</p>
            <input
              ref={profileImageRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUploadProfileImage(file)
                e.target.value = ''
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => profileImageRef.current?.click()}
              loading={isUploadingImage}
              className="rounded-xl text-xs"
            >
              {profileUser?.profile_image ? t('profile.change_photo') : t('profile.upload_photo')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--blue-text)]">{t('profile.role')}</p>
            <p className={cn('mt-2 text-lg font-semibold', getRoleTextClass(profileUser?.role))}>{profileUser?.role ?? '-'}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--blue-text)]">{t('profile.company_code')}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{profileUser?.company_code ?? '-'}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--blue-text)]">{t('profile.job_title')}</p>
            <p className={cn('mt-2 text-lg font-semibold', profileUser?.job_title ? (isCeoUser(profileUser) ? 'text-[var(--violet-text)]' : 'text-[var(--success-text)]') : 'text-[var(--foreground)]')}>
              {profileUser?.job_title ?? '-'}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--blue-text)]">{t('profile.email')}</p>
            <p className="mt-2 break-all text-base font-semibold text-[var(--foreground)]">{profileUser?.email ?? '-'}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--blue-text)]">{t('profile.status')}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={cn('status-dot', profileUser?.is_active ? 'status-dot-success' : 'status-dot-muted')} />
              <p className={cn('text-base font-semibold', profileUser?.is_active ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]')}>
                {profileUser?.is_active ? t('status.active') : t('status.inactive')}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--blue-text)]">{t('auth.register.telegram_id')}</p>
            <p className="mt-2 break-all text-base font-semibold text-[var(--foreground)]">{profileUser?.telegram_id ?? '-'}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--blue-text)]">{t('ceo.users.form.default_salary')}</p>
            <p className="mt-2 text-base font-semibold text-[var(--foreground)]">{formatSalary(profileUser?.default_salary)}</p>
          </div>
        </div>
      </Dialog>
    </section>
  )
}
