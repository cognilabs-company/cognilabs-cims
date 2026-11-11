import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { managementService } from '../../../shared/api/services/management.service'
import type {
  ManagementImageCategory,
  ManagementImageCleanupResponse,
  ManagementImageRecord,
  ManagementPageCreatePayload,
  ManagementPageRecord,
  ManagementPageUpdatePayload,
  ManagementRoleCreatePayload,
  ManagementRoleRecord,
  ManagementRoleUpdatePayload,
  ManagementStatusCreatePayload,
  ManagementStatusRecord,
  ManagementStatusUpdatePayload,
} from '../../../shared/api/types'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { formatShortDate } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { ActionsMenu } from '../../../shared/ui/actions-menu'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Checkbox } from '../../../shared/ui/checkbox'
import { DataTable } from '../../../shared/ui/data-table'
import { Dialog } from '../../../shared/ui/dialog'
import { IconButton } from '../../../shared/ui/icon-button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { PageHeader } from '../../../shared/ui/page-header'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { StatCard } from '../../../shared/ui/stat-card'
import { ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { Tabs } from '../../../shared/ui/tabs'
import { Textarea } from '../../../shared/ui/textarea'
import type { Tone } from '../../../shared/ui/tone'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { useAuth } from '../../auth/hooks/useAuth'

type ManagementTab = 'pages' | 'statuses' | 'roles' | 'images'
type ImageReferenceFilter = 'all' | 'referenced' | 'unreferenced'

type PageFormState = {
  name: string
  displayName: string
  description: string
  routePath: string
  order: string
  isActive: boolean
  isSystem: boolean
}

type StatusFormState = {
  name: string
  displayName: string
  description: string
  color: string
  order: string
  isActive: boolean
  isSystem: boolean
}

type RoleFormState = {
  name: string
  displayName: string
  description: string
  isActive: boolean
  isSystem: boolean
}

const tabOptions: Array<{ key: ManagementTab; label: string; description: string }> = [
  { key: 'pages', label: 'Pages', description: 'Permission pages with live CRUD.' },
  { key: 'statuses', label: 'Statuses', description: 'Dynamic CRM statuses with live CRUD.' },
  { key: 'roles', label: 'Roles', description: 'User roles with live CRUD.' },
  { key: 'images', label: 'Images Cleanup', description: 'Image library, detail view and cleanup actions.' },
]

const imageCategoryOptions: SelectFieldOption[] = [
  { value: '', label: 'All categories' },
  { value: 'project_images', label: 'Project images' },
  { value: 'card_images', label: 'Card images' },
  { value: 'profile_images', label: 'Profile images' },
  { value: 'profil_images', label: 'Profil images (legacy)' },
]

const imageReferenceFilterOptions: SelectFieldOption[] = [
  { value: 'all', label: 'All images' },
  { value: 'referenced', label: 'Referenced only' },
  { value: 'unreferenced', label: 'Unreferenced only' },
]

const initialPageForm: PageFormState = {
  name: '',
  displayName: '',
  description: '',
  routePath: '',
  order: '0',
  isActive: true,
  isSystem: false,
}

const statusColorPresets = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6']

const initialStatusForm: StatusFormState = {
  name: '',
  displayName: '',
  description: '',
  color: '#2563EB',
  order: '0',
  isActive: true,
  isSystem: false,
}

const initialRoleForm: RoleFormState = {
  name: '',
  displayName: '',
  description: '',
  isActive: true,
  isSystem: false,
}

function EditGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
  )
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
  )
}

function ImagesGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3.5" /><circle cx="9" cy="9" r="1.6" /><path d="M21 15.5 16 10.5 5 21" /></svg>
  )
}

function LinkGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M9.5 17H7.5a5 5 0 0 1 0-10h2" /><path d="M14.5 7h2a5 5 0 0 1 0 10h-2" /><path d="M8.5 12h7" /></svg>
  )
}

function UnlinkGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M9.5 17H7.5a5 5 0 0 1-.9-9.9" /><path d="M14.5 7h2a5 5 0 0 1 3.9 8.1" /><path d="M4 4l16 16" /></svg>
  )
}

function SelectGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4.5" /><path d="M8 12.4l2.9 2.9L16.5 9.6" /></svg>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  iconTone,
  solid,
}: {
  label: string
  value: string | number
  hint: string
  icon?: ReactNode
  iconTone?: Tone
  solid?: boolean
}) {
  const lt = translateCurrentLiteral
  return (
    <StatCard
      label={lt(label)}
      value={value}
      hint={hint}
      icon={icon}
      iconTone={iconTone}
      solid={solid}
      className={solid ? undefined : 'bg-[var(--accent-soft)]'}
    />
  )
}

function toPageFormState(item?: ManagementPageRecord | null): PageFormState {
  if (!item) {
    return initialPageForm
  }

  return {
    name: item.name,
    displayName: item.display_name,
    description: item.description ?? '',
    routePath: item.route_path,
    order: String(item.order ?? 0),
    isActive: item.is_active,
    isSystem: item.is_system,
  }
}

function toStatusFormState(item?: ManagementStatusRecord | null): StatusFormState {
  if (!item) {
    return initialStatusForm
  }

  return {
    name: item.name,
    displayName: item.display_name,
    description: item.description ?? '',
    color: item.color || '#2563EB',
    order: String(item.order ?? 0),
    isActive: item.is_active,
    isSystem: item.is_system,
  }
}

function toRoleFormState(item?: ManagementRoleRecord | null): RoleFormState {
  if (!item) {
    return initialRoleForm
  }

  return {
    name: item.name,
    displayName: item.display_name,
    description: item.description ?? '',
    isActive: item.is_active,
    isSystem: item.is_system,
  }
}

function BooleanToggle({
  value,
  onChange,
  trueLabel,
  falseLabel,
}: {
  value: boolean
  onChange: (next: boolean) => void
  trueLabel: string
  falseLabel: string
}) {
  const lt = translateCurrentLiteral
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          'min-h-11 rounded-[14px] px-4 py-3 text-left text-sm transition-colors',
          value
            ? 'bg-[var(--success-dim)] font-semibold text-[var(--success-text)]'
            : 'bg-[var(--input-surface)] font-medium text-[var(--muted-strong)] hover:bg-[var(--input-surface-hover)]',
        )}
      >
        {lt(trueLabel)}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          'min-h-11 rounded-[14px] px-4 py-3 text-left text-sm transition-colors',
          !value
            ? 'bg-[var(--warning-dim)] font-semibold text-[var(--warning-text)]'
            : 'bg-[var(--input-surface)] font-medium text-[var(--muted-strong)] hover:bg-[var(--input-surface-hover)]',
        )}
      >
        {lt(falseLabel)}
      </button>
    </div>
  )
}

function formatBytes(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '-'
  }

  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function getImageCategoryLabel(category?: ManagementImageCategory | null) {
  switch (category) {
    case 'project_images':
      return 'Project images'
    case 'card_images':
      return 'Card images'
    case 'profile_images':
      return 'Profile images'
    case 'profil_images':
      return 'Profil images'
    default:
      return category || 'Unknown'
  }
}

export function CeoManagementPage() {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { can } = useAuth()
  const canCreate = can('management_api', 'create')
  const canEdit = can('management_api', 'edit')
  const canDelete = can('management_api', 'delete')
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
  const [activeTab, setActiveTab] = useState<ManagementTab>('pages')

  const [pageDialogMode, setPageDialogMode] = useState<'create' | 'edit'>('create')
  const [pageDialogOpen, setPageDialogOpen] = useState(false)
  const [pageForm, setPageForm] = useState<PageFormState>(initialPageForm)
  const [editingPage, setEditingPage] = useState<ManagementPageRecord | null>(null)
  const [isPageSubmitting, setIsPageSubmitting] = useState(false)

  const [statusDialogMode, setStatusDialogMode] = useState<'create' | 'edit'>('create')
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusForm, setStatusForm] = useState<StatusFormState>(initialStatusForm)
  const [editingStatus, setEditingStatus] = useState<ManagementStatusRecord | null>(null)
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false)

  const [roleDialogMode, setRoleDialogMode] = useState<'create' | 'edit'>('create')
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleForm, setRoleForm] = useState<RoleFormState>(initialRoleForm)
  const [editingRole, setEditingRole] = useState<ManagementRoleRecord | null>(null)
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false)

  const [isSingleDeleteSubmitting, setIsSingleDeleteSubmitting] = useState(false)
  const [isBulkDeleteSubmitting, setIsBulkDeleteSubmitting] = useState(false)
  const [imageCategoryFilter, setImageCategoryFilter] = useState<string>('')
  const [imageReferenceFilter, setImageReferenceFilter] = useState<ImageReferenceFilter>('all')
  const [imageSearch, setImageSearch] = useState('')
  const [selectedImagePaths, setSelectedImagePaths] = useState<string[]>([])
  const [imageDetailPath, setImageDetailPath] = useState<string | null>(null)

  const pagesQuery = useAsyncData(() => managementService.listPages(), [])
  const statusesQuery = useAsyncData(() => managementService.listStatuses(), [])
  const rolesQuery = useAsyncData(() => managementService.listRoles(), [])
  const imagesQuery = useAsyncData(
    () => managementService.listImages({
      category: (imageCategoryFilter || undefined) as ManagementImageCategory | undefined,
      referenced_only: imageReferenceFilter === 'referenced',
      unreferenced_only: imageReferenceFilter === 'unreferenced',
    }),
    [activeTab, imageCategoryFilter, imageReferenceFilter],
    { enabled: activeTab === 'images' },
  )
  const imageDetailQuery = useAsyncData(
    () => managementService.getImageDetail(imageDetailPath ?? ''),
    [imageDetailPath],
    { enabled: Boolean(imageDetailPath) },
  )

  const pageItems = useMemo(
    () => [...(pagesQuery.data ?? [])].sort((left, right) => left.order - right.order || left.display_name.localeCompare(right.display_name)),
    [pagesQuery.data],
  )

  const statuses = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((left, right) => left.order - right.order || left.display_name.localeCompare(right.display_name)),
    [statusesQuery.data],
  )
  const roles = useMemo(
    () => [...(rolesQuery.data ?? [])].sort((left, right) => left.display_name.localeCompare(right.display_name)),
    [rolesQuery.data],
  )
  const imageItems = useMemo(
    () => [...(imagesQuery.data?.images ?? [])].sort((left, right) => (
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime() ||
      left.filename.localeCompare(right.filename)
    )),
    [imagesQuery.data?.images],
  )
  const filteredImages = useMemo(() => {
    const normalizedSearch = imageSearch.trim().toLowerCase()

    if (!normalizedSearch) {
      return imageItems
    }

    return imageItems.filter((image) =>
      [image.filename, image.path, image.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    )
  }, [imageItems, imageSearch])
  const selectedImagePathSet = useMemo(
    () => new Set(selectedImagePaths),
    [selectedImagePaths],
  )
  const referencedImagesCount = useMemo(
    () => imageItems.filter((image) => image.is_referenced).length,
    [imageItems],
  )
  const unreferencedImagesCount = useMemo(
    () => imageItems.filter((image) => !image.is_referenced).length,
    [imageItems],
  )
  const allFilteredImagesSelected = filteredImages.length > 0 && filteredImages.every((image) => selectedImagePathSet.has(image.path))
  const activeImageDetail = useMemo(() => {
    if (!imageDetailPath) {
      return null
    }

    if (imageDetailQuery.data?.path === imageDetailPath) {
      return imageDetailQuery.data
    }

    return imageItems.find((image) => image.path === imageDetailPath) ?? null
  }, [imageDetailPath, imageDetailQuery.data, imageItems])

  useEffect(() => {
    setSelectedImagePaths((current) => {
      const next = current.filter((path) => imageItems.some((image) => image.path === path))
      return next.length === current.length && next.every((path, index) => path === current[index]) ? current : next
    })
  }, [imageItems])

  const isInitialLoading =
    !pagesQuery.data &&
    !statusesQuery.data &&
    !rolesQuery.data &&
    (pagesQuery.isLoading || statusesQuery.isLoading || rolesQuery.isLoading)

  function closePageDialog() {
    setPageDialogOpen(false)
    setEditingPage(null)
    setPageForm(initialPageForm)
  }

  function closeStatusDialog() {
    setStatusDialogOpen(false)
    setEditingStatus(null)
    setStatusForm(initialStatusForm)
  }

  function closeRoleDialog() {
    setRoleDialogOpen(false)
    setEditingRole(null)
    setRoleForm(initialRoleForm)
  }

  function reloadManagementPageAfterSave() {
    if (typeof window === 'undefined') {
      return
    }

    window.setTimeout(() => {
      window.location.reload()
    }, 180)
  }

  async function refreshAll() {
    const tasks: Array<Promise<unknown>> = [
      pagesQuery.refetch(),
      statusesQuery.refetch(),
      rolesQuery.refetch(),
    ]

    if (activeTab === 'images' || imagesQuery.data) {
      tasks.push(imagesQuery.refetch())
    }

    const results = await Promise.allSettled(tasks)

    const failed = results.find((result) => result.status === 'rejected')

    if (failed && failed.status === 'rejected') {
      showToast({
        title: lt('Management refresh failed'),
        description: getApiErrorMessage(failed.reason),
        tone: 'error',
      })
      return
    }

    showToast({
      title: lt('Management refreshed'),
      description: activeTab === 'images'
        ? lt('Pages, statuses, roles and images reloaded.')
        : lt('Pages, statuses and roles reloaded.'),
      tone: 'success',
    })
  }

  function toggleImageSelection(imagePath: string, nextValue?: boolean) {
    setSelectedImagePaths((current) => {
      const hasPath = current.includes(imagePath)

      if (nextValue ?? !hasPath) {
        return hasPath ? current : [...current, imagePath]
      }

      return current.filter((path) => path !== imagePath)
    })
  }

  function toggleSelectAllFilteredImages(nextValue: boolean) {
    setSelectedImagePaths((current) => {
      const filteredPaths = filteredImages.map((image) => image.path)

      if (nextValue) {
        return Array.from(new Set([...current, ...filteredPaths]))
      }

      const filteredSet = new Set(filteredPaths)
      return current.filter((path) => !filteredSet.has(path))
    })
  }

  function openImageDetail(image: Pick<ManagementImageRecord, 'path'>) {
    setImageDetailPath(image.path)
  }

  function applyCleanupResult(response: ManagementImageCleanupResponse) {
    if (response.deleted_paths.length === 0) {
      return
    }

    const deletedPathSet = new Set(response.deleted_paths)

    setSelectedImagePaths((current) => current.filter((path) => !deletedPathSet.has(path)))

    if (imageDetailPath && deletedPathSet.has(imageDetailPath)) {
      setImageDetailPath(null)
    }
  }

  async function refreshImagesAfterCleanup() {
    if (activeTab === 'images' || imagesQuery.data) {
      await imagesQuery.refetch()
    }
  }

  async function handleDeleteImageByPath(imagePath: string) {
    const approved = await confirm({
      title: lt('Delete this image?'),
      description: imagePath,
      confirmLabel: lt('Delete image'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    setIsSingleDeleteSubmitting(true)

    try {
      const response = await managementService.deleteImage(imagePath)
      applyCleanupResult(response)
      await refreshImagesAfterCleanup()
      showToast({
        title: lt('Image cleanup complete'),
        description: response.message,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Image delete failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsSingleDeleteSubmitting(false)
    }
  }

  function openCreatePageDialog() {
    setPageDialogMode('create')
    setEditingPage(null)
    setPageForm(initialPageForm)
    setPageDialogOpen(true)
  }

  function openEditPageDialog(item: ManagementPageRecord) {
    setPageDialogMode('edit')
    setEditingPage(item)
    setPageForm(toPageFormState(item))
    setPageDialogOpen(true)
  }

  async function handleSubmitPage() {
    if (!pageForm.name.trim() || !pageForm.displayName.trim() || !pageForm.routePath.trim()) {
      showToast({
        title: lt('Page form incomplete'),
        description: lt('Name, display name, and route path are required.'),
        tone: 'error',
      })
      return
    }

    setIsPageSubmitting(true)

    try {
      const shouldReloadPage = pageDialogMode === 'edit'

      if (pageDialogMode === 'create') {
        const payload: ManagementPageCreatePayload = {
          name: pageForm.name.trim(),
          display_name: pageForm.displayName.trim(),
          description: pageForm.description.trim() || undefined,
          route_path: pageForm.routePath.trim(),
          order: Number(pageForm.order) || 0,
          is_active: pageForm.isActive,
          is_system: pageForm.isSystem,
        }

        await managementService.createPage(payload)
      } else if (editingPage) {
        const payload: ManagementPageUpdatePayload = {
          display_name: pageForm.displayName.trim(),
          description: pageForm.description.trim() || undefined,
          route_path: pageForm.routePath.trim(),
          order: Number(pageForm.order) || 0,
          is_active: pageForm.isActive,
        }

        await managementService.updatePage(editingPage.id, payload)
      }

      await pagesQuery.refetch()
      closePageDialog()
      showToast({
        title: pageDialogMode === 'create' ? lt('Page created') : lt('Page updated'),
        description: lt('Management pages list refreshed.'),
        tone: 'success',
      })

      if (shouldReloadPage) {
        reloadManagementPageAfterSave()
      }
    } catch (error) {
      showToast({
        title: lt('Page save failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsPageSubmitting(false)
    }
  }

  async function handleDeletePage(item: ManagementPageRecord) {
    const approved = await confirm({
      title: `${lt('Delete page')} ${item.display_name}?`,
      description: item.is_system
        ? 'Backend system page ni o‘chirishga ruxsat bermasligi mumkin.'
        : 'Permission page butunlay o‘chiriladi.',
      confirmLabel: lt('Delete page'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    try {
      await managementService.deletePage(item.id)
      await pagesQuery.refetch()
      showToast({
        title: lt('Page deleted'),
        description: `${item.display_name} ${lt('removed.')}`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Delete failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    }
  }

  function openCreateStatusDialog() {
    setStatusDialogMode('create')
    setEditingStatus(null)
    setStatusForm(initialStatusForm)
    setStatusDialogOpen(true)
  }

  function openEditStatusDialog(item: ManagementStatusRecord) {
    setStatusDialogMode('edit')
    setEditingStatus(item)
    setStatusForm(toStatusFormState(item))
    setStatusDialogOpen(true)
  }

  function openCreateRoleDialog() {
    setRoleDialogMode('create')
    setEditingRole(null)
    setRoleForm(initialRoleForm)
    setRoleDialogOpen(true)
  }

  function openEditRoleDialog(item: ManagementRoleRecord) {
    setRoleDialogMode('edit')
    setEditingRole(item)
    setRoleForm(toRoleFormState(item))
    setRoleDialogOpen(true)
  }

  async function handleSubmitStatus() {
    if (!statusForm.name.trim() || !statusForm.displayName.trim()) {
      showToast({
        title: lt('Status form incomplete'),
        description: lt('Name and display name are required.'),
        tone: 'error',
      })
      return
    }

    setIsStatusSubmitting(true)

    try {
      const shouldReloadPage = statusDialogMode === 'edit'

      if (statusDialogMode === 'create') {
        const payload: ManagementStatusCreatePayload = {
          name: statusForm.name.trim(),
          display_name: statusForm.displayName.trim(),
          description: statusForm.description.trim() || undefined,
          color: statusForm.color,
          order: Number(statusForm.order) || 0,
          is_active: statusForm.isActive,
          is_system: statusForm.isSystem,
        }

        await managementService.createStatus(payload)
      } else if (editingStatus) {
        const payload: ManagementStatusUpdatePayload = {
          display_name: statusForm.displayName.trim(),
          description: statusForm.description.trim() || undefined,
          color: statusForm.color,
          order: Number(statusForm.order) || 0,
          is_active: statusForm.isActive,
        }

        await managementService.updateStatus(editingStatus.id, payload)
      }

      await statusesQuery.refetch()
      closeStatusDialog()
      showToast({
        title: statusDialogMode === 'create' ? lt('Status created') : lt('Status updated'),
        description: lt('Management statuses list refreshed.'),
        tone: 'success',
      })

      if (shouldReloadPage) {
        reloadManagementPageAfterSave()
      }
    } catch (error) {
      showToast({
        title: lt('Status save failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsStatusSubmitting(false)
    }
  }

  async function handleDeleteStatus(item: ManagementStatusRecord) {
    const approved = await confirm({
      title: `${lt('Delete status')} ${item.display_name}?`,
      description: item.is_system
        ? 'Backend system statusni o‘chirishga ruxsat bermasligi mumkin.'
        : 'Status butunlay o‘chiriladi.',
      confirmLabel: lt('Delete status'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    try {
      await managementService.deleteStatus(item.id)
      await statusesQuery.refetch()
      showToast({
        title: lt('Status deleted'),
        description: `${item.display_name} ${lt('removed.')}`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Delete failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    }
  }

  async function handleSubmitRole() {
    if (!roleForm.name.trim() || !roleForm.displayName.trim()) {
      showToast({
        title: lt('Role form incomplete'),
        description: lt('Name and display name are required.'),
        tone: 'error',
      })
      return
    }

    setIsRoleSubmitting(true)

    try {
      const shouldReloadPage = roleDialogMode === 'edit'

      if (roleDialogMode === 'create') {
        const payload: ManagementRoleCreatePayload = {
          name: roleForm.name.trim(),
          display_name: roleForm.displayName.trim(),
          description: roleForm.description.trim() || undefined,
          is_active: roleForm.isActive,
          is_system: roleForm.isSystem,
        }

        await managementService.createRole(payload)
      } else if (editingRole) {
        const payload: ManagementRoleUpdatePayload = {
          display_name: roleForm.displayName.trim(),
          description: roleForm.description.trim() || undefined,
          is_active: roleForm.isActive,
        }

        await managementService.updateRole(editingRole.id, payload)
      }

      await rolesQuery.refetch()
      closeRoleDialog()
      showToast({
        title: roleDialogMode === 'create' ? lt('Role created') : lt('Role updated'),
        description: lt('Management roles list refreshed.'),
        tone: 'success',
      })

      if (shouldReloadPage) {
        reloadManagementPageAfterSave()
      }
    } catch (error) {
      showToast({
        title: lt('Role save failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsRoleSubmitting(false)
    }
  }

  async function handleDeleteRole(item: ManagementRoleRecord) {
    const approved = await confirm({
      title: `${lt('Delete role')} ${item.display_name}?`,
      description: item.is_system
        ? 'Backend system rolni o‘chirishga ruxsat bermasligi mumkin.'
        : 'Role butunlay o‘chiriladi.',
      confirmLabel: lt('Delete role'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    try {
      await managementService.deleteRole(item.id)
      await rolesQuery.refetch()
      showToast({
        title: lt('Role deleted'),
        description: `${item.display_name} ${lt('removed.')}`,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Delete failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    }
  }

  async function handleDeleteSelectedImages() {
    if (selectedImagePaths.length === 0) {
      showToast({
        title: lt('No images selected'),
        description: lt('Select at least one image to delete.'),
        tone: 'error',
      })
      return
    }

    const approved = await confirm({
      title: `${lt('Delete')} ${selectedImagePaths.length} ${lt(selectedImagePaths.length > 1 ? 'selected images' : 'selected image')}?`,
      description: lt('Bulk delete runs against the selected paths and can also clear database references.'),
      confirmLabel: lt('Delete selected'),
      tone: 'danger',
    })

    if (!approved) {
      return
    }

    setIsBulkDeleteSubmitting(true)

    try {
      const response = await managementService.bulkDeleteImages({
        image_paths: selectedImagePaths,
        delete_all_in_category: false,
        only_unreferenced: false,
      })

      applyCleanupResult(response)
      await refreshImagesAfterCleanup()
      showToast({
        title: lt('Selected images deleted'),
        description: response.message,
        tone: 'success',
      })
    } catch (error) {
      showToast({
        title: lt('Selected delete failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsBulkDeleteSubmitting(false)
    }
  }

  if (isInitialLoading) {
    return (
      <LoadingStateBlock
        eyebrow={lt('CEO / Management')}
        title={lt('Loading management modules')}
        description={lt('Fetching pages overview, statuses and roles.')}
      />
    )
  }

  if (!pagesQuery.data && !statusesQuery.data && !rolesQuery.data && (pagesQuery.isError || statusesQuery.isError || rolesQuery.isError)) {
    return (
      <ErrorStateBlock
        eyebrow={lt('CEO / Management')}
        title={lt('Management modules unavailable')}
        description={lt('Could not load the management dashboard.')}
        actionLabel={lt('Retry')}
        onAction={() => void refreshAll()}
      />
    )
  }

  return (
    <section className="space-y-[18px] page-enter">
      <PageHeader
        title={lt('Management API')}
        actions={(
          <>
            <Button variant="secondary" onClick={() => void refreshAll()}>
              {lt('Refresh')}
            </Button>
            {activeTab === 'pages' && canCreate ? (
              <Button onClick={openCreatePageDialog}>{lt('Create page')}</Button>
            ) : null}
            {activeTab === 'statuses' && canCreate ? (
              <Button onClick={openCreateStatusDialog}>{lt('Create status')}</Button>
            ) : null}
            {activeTab === 'roles' && canCreate ? (
              <Button onClick={openCreateRoleDialog}>{lt('Create role')}</Button>
            ) : null}
          </>
        )}
      />

      <Tabs
        ariaLabel={lt('Management API')}
        items={tabOptions.map((tab) => ({ value: tab.key, label: lt(tab.label) }))}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'pages' ? (
        <Card noPadding>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>{lt('Pages Registry')}</CardTitle>
              <CardDescription>{lt('Permission page catalog is managed from this table with create, edit, and delete actions.')}</CardDescription>
            </div>
            <Badge variant="blue">{pageItems.length} {lt('pages')}</Badge>
          </CardHeader>
          <CardContent>
            <DataTable
              caption={lt('Management pages')}
              rows={pageItems}
              getRowKey={(row) => String(row.id)}
              zebra
              columns={[
                {
                  key: 'page',
                  header: lt('Page'),
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{row.display_name}</p>
                      <p className="mt-1 text-[12px] text-[var(--muted)]">{row.name}</p>
                    </div>
                  ),
                },
                {
                  key: 'route',
                  header: lt('Route'),
                  render: (row) => <span className="text-[13.5px] text-[var(--muted-strong)]">{row.route_path}</span>,
                },
                {
                  key: 'description',
                  header: lt('Description'),
                  render: (row) => <span className="text-[13.5px] text-[var(--muted-strong)]">{row.description || lt('No description')}</span>,
                },
                {
                  key: 'order',
                  header: lt('Order'),
                  align: 'right',
                  render: (row) => row.order,
                },
                {
                  key: 'flags',
                  header: lt('Flags'),
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.is_active ? 'success' : 'outline'}>
                        {row.is_active ? lt('Active') : lt('Inactive')}
                      </Badge>
                      <Badge variant={row.is_system ? 'warning' : 'secondary'}>
                        {row.is_system ? lt('System') : lt('Custom')}
                      </Badge>
                    </div>
                  ),
                },
                {
                  key: 'updated',
                  header: lt('Updated'),
                  render: (row) => formatShortDate(row.updated_at),
                },
                {
                  key: 'actions',
                  header: lt('Actions'),
                  render: (row) => (
                    <div className="flex items-center gap-1">
                      {canEdit ? (
                        <IconButton size="sm" label={lt('Edit')} onClick={() => openEditPageDialog(row)}>
                          <EditGlyph />
                        </IconButton>
                      ) : null}
                      {canDelete ? (
                        <IconButton size="sm" tone="danger" label={lt('Delete')} onClick={() => void handleDeletePage(row)}>
                          <TrashGlyph />
                        </IconButton>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'statuses' ? (
        <Card noPadding>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle>{lt('Statuses')}</CardTitle>
            <Badge variant="success">{statuses.length} {lt('statuses')}</Badge>
          </CardHeader>
          <CardContent>
            <DataTable
              caption={lt('Management statuses')}
              rows={statuses}
              getRowKey={(row) => String(row.id)}
              zebra
              columns={[
                {
                  key: 'status',
                  header: lt('Status'),
                  render: (row) => (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                        <p className="font-semibold text-[var(--foreground)]">{row.display_name}</p>
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--muted)]">{row.name}</p>
                    </div>
                  ),
                },
                {
                  key: 'description',
                  header: lt('Description'),
                  render: (row) => (
                    <span className="text-[13.5px] text-[var(--muted-strong)]">{row.description || lt('No description')}</span>
                  ),
                },
                {
                  key: 'order',
                  header: lt('Order'),
                  align: 'right',
                  render: (row) => row.order,
                },
                {
                  key: 'flags',
                  header: lt('Flags'),
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.is_active ? 'success' : 'outline'}>
                        {row.is_active ? lt('Active') : lt('Inactive')}
                      </Badge>
                      <Badge variant={row.is_system ? 'warning' : 'secondary'}>
                        {row.is_system ? lt('System') : lt('Custom')}
                      </Badge>
                    </div>
                  ),
                },
                {
                  key: 'updated',
                  header: lt('Updated'),
                  render: (row) => formatShortDate(row.updated_at),
                },
                {
                  key: 'actions',
                  header: lt('Actions'),
                  render: (row) => (
                    <div className="flex items-center gap-1">
                      {canEdit ? (
                        <IconButton size="sm" label={lt('Edit')} onClick={() => openEditStatusDialog(row)}>
                          <EditGlyph />
                        </IconButton>
                      ) : null}
                      {canDelete ? (
                        <IconButton size="sm" tone="danger" label={lt('Delete')} onClick={() => void handleDeleteStatus(row)}>
                          <TrashGlyph />
                        </IconButton>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'roles' ? (
        <Card noPadding>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>{lt('Roles')}</CardTitle>
              <CardDescription>{lt('User role management follows the same CRUD workflow as the statuses section.')}</CardDescription>
            </div>
            <Badge variant="violet">{roles.length} {lt('roles')}</Badge>
          </CardHeader>
          <CardContent>
            <DataTable
              caption={lt('Management roles')}
              rows={roles}
              getRowKey={(row) => String(row.id)}
              zebra
              columns={[
                {
                  key: 'role',
                  header: lt('Role'),
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{row.display_name}</p>
                      <p className="mt-1 text-[12px] text-[var(--muted)]">{row.name}</p>
                    </div>
                  ),
                },
                {
                  key: 'description',
                  header: lt('Description'),
                  render: (row) => (
                    <span className="text-[13.5px] text-[var(--muted-strong)]">{row.description || lt('No description')}</span>
                  ),
                },
                {
                  key: 'flags',
                  header: lt('Flags'),
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.is_active ? 'success' : 'outline'}>
                        {row.is_active ? lt('Active') : lt('Inactive')}
                      </Badge>
                      <Badge variant={row.is_system ? 'warning' : 'secondary'}>
                        {row.is_system ? lt('System') : lt('Custom')}
                      </Badge>
                    </div>
                  ),
                },
                {
                  key: 'updated',
                  header: lt('Updated'),
                  render: (row) => formatShortDate(row.updated_at),
                },
                {
                  key: 'actions',
                  header: lt('Actions'),
                  render: (row) => (
                    <div className="flex items-center gap-1">
                      {canEdit ? (
                        <IconButton size="sm" label={lt('Edit')} onClick={() => openEditRoleDialog(row)}>
                          <EditGlyph />
                        </IconButton>
                      ) : null}
                      {canDelete ? (
                        <IconButton size="sm" tone="danger" label={lt('Delete')} onClick={() => void handleDeleteRole(row)}>
                          <TrashGlyph />
                        </IconButton>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'images' ? (
        <Card noPadding>
          <CardHeader>
            <CardTitle>{tr('Images Cleanup', 'Rasmlarni tozalash', 'Ochistka izobrazhenii')}</CardTitle>
            <CardDescription>{tr('Image library, detail preview va selection-based cleanup shu section ichida ishlaydi.', 'Rasm kutubxonasi, detal korinishi va tanlov boyicha tozalash shu bolim ichida ishlaydi.', 'Biblioteka izobrazhenii, detalnyi predprosmotr i ochistka po vyboru rabotayut v etom razdele.')}</CardDescription>
          </CardHeader>
          <CardContent>

          <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              solid
              icon={<ImagesGlyph />}
              label={tr('Images loaded', 'Yuklangan rasmlar', 'Zagruzhennye izobrazheniya')}
              value={imagesQuery.data?.total_count ?? imageItems.length}
              hint={tr('Current category and reference filters bilan yuklangan rasmlar.', 'Joriy kategoriya va boglanish filtrlari bilan yuklangan rasmlar.', 'Izobrazheniya, zagruzhennye s tekushchimi filtrami kategorii i ssylok.')}
            />
            <SummaryCard
              icon={<LinkGlyph />}
              iconTone="success"
              label={tr('Referenced', 'Boglangan', 'Svyazannye')}
              value={referencedImagesCount}
              hint={tr('DB ichida kamida bitta reference bor.', 'DB ichida kamida bitta boglanish bor.', 'V BD est khotya by odna svyaz.')}
            />
            <SummaryCard
              icon={<UnlinkGlyph />}
              iconTone="warning"
              label={tr('Unreferenced', 'Boglanmagan', 'Nesvyazannye')}
              value={unreferencedImagesCount}
              hint={tr('DB da ishlatilmayotgan rasmlar.', 'DB da ishlatilmayotgan rasmlar.', 'Izobrazheniya, kotorye ne ispolzuyutsya v BD.')}
            />
            <SummaryCard
              icon={<SelectGlyph />}
              iconTone="violet"
              label={tr('Selected', 'Tanlangan', 'Vybrannye')}
              value={selectedImagePaths.length}
              hint={tr('Bulk delete uchun tanlangan rasmlar.', 'Ommaviy ochirish uchun tanlangan rasmlar.', 'Izobrazheniya, vybrannye dlya massovogo udaleniya.')}
            />
          </div>

            <div className="mt-[18px] space-y-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
                <div>
                  <p className="text-[15px] font-semibold text-[var(--foreground)]">{lt('Image library')}</p>
                  <p className="mt-1 text-[12.5px] leading-5 text-[var(--muted)]">
                    {lt('GET /management/images and GET /management/images/detail are connected here.')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void imagesQuery.refetch()}
                  disabled={imagesQuery.isLoading && !imagesQuery.data}
                >
                  {lt('Refresh images')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedImagePaths([])}
                  disabled={selectedImagePaths.length === 0}
                >
                  {lt('Clear selection')}
                </Button>
                {canDelete ? (
                  <Button
                    variant="danger"
                    onClick={() => void handleDeleteSelectedImages()}
                    disabled={selectedImagePaths.length === 0}
                    loading={isBulkDeleteSubmitting}
                  >
                    {lt('Delete selected')}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-[18px] lg:grid-cols-[1.2fr_0.85fr_0.85fr]">
              <div>
                <Label className="mb-2 block">{lt('Search')}</Label>
                <Input
                  value={imageSearch}
                  onChange={(event) => setImageSearch(event.target.value)}
                  placeholder={lt('Search by file name or path')}
                />
              </div>

              <div>
                <Label className="mb-2 block">{lt('Category')}</Label>
                <SelectField
                  value={imageCategoryFilter}
                  options={imageCategoryOptions.map((option) => ({
                    ...option,
                    label:
                      option.label === 'All categories'
                        ? tr('All categories', 'Barcha toifalar', 'Vse kategorii')
                        : option.label === 'Project images'
                          ? tr('Project images', 'Loyiha rasmlari', 'Izobrazheniya proekta')
                          : option.label === 'Card images'
                            ? tr('Card images', 'Karta rasmlari', 'Izobrazheniya kart')
                            : option.label === 'Profile images'
                              ? tr('Profile images', 'Profil rasmlari', 'Izobrazheniya profilya')
                              : option.label === 'Profil images (legacy)'
                                ? tr('Profil images (legacy)', 'Profil rasmlari (eski)', 'Izobrazheniya profilya (legacy)')
                                : lt(option.label),
                  }))}
                  onValueChange={(value) => setImageCategoryFilter(value)}
                />
              </div>

              <div>
                <Label className="mb-2 block">{tr('Reference filter', 'Boglanish filtri', 'Filtr svyazei')}</Label>
                <SelectField
                  value={imageReferenceFilter}
                  options={imageReferenceFilterOptions.map((option) => ({
                    ...option,
                    label:
                      option.label === 'All images'
                        ? tr('All images', 'Barcha rasmlar', 'Vse izobrazheniya')
                        : option.label === 'Referenced only'
                          ? tr('Referenced only', 'Faqat boglanganlar', 'Tolko svyazannye')
                          : option.label === 'Unreferenced only'
                            ? tr('Unreferenced only', 'Faqat boglanmaganlar', 'Tolko nesvyazannye')
                            : lt(option.label),
                  }))}
                  onValueChange={(value) => setImageReferenceFilter(value as ImageReferenceFilter)}
                />
              </div>
            </div>

            <div>
              {imagesQuery.isLoading && !imagesQuery.data ? (
                <LoadingStateBlock
                  eyebrow={lt('Management / Images')}
                  title={lt('Loading image library')}
                  description={lt('Fetching management image metadata and reference counts.')}
                />
              ) : imagesQuery.isError && !imagesQuery.data ? (
                <ErrorStateBlock
                  eyebrow={lt('Management / Images')}
                  title={lt('Image library unavailable')}
                  description={lt('Could not load management images.')}
                  actionLabel={lt('Retry')}
                  onAction={() => void imagesQuery.refetch()}
                />
              ) : (
                <DataTable
                  caption={lt('Management images')}
                  rows={filteredImages}
                  getRowKey={(row) => row.path}
                  pageSize={75}
                  zebra
                  emptyState={(
                    <div className="rounded-[18px] bg-[var(--muted-surface)] px-4 py-5 text-[13.5px] text-[var(--muted)]">
                      {lt('Image list is empty for the current filters.')}
                    </div>
                  )}
                  columns={[
                    {
                      key: 'select',
                      header: (
                        <Checkbox
                          size="sm"
                          checked={allFilteredImagesSelected}
                          onChange={(event) => toggleSelectAllFilteredImages(event.target.checked)}
                          aria-label={lt('Select all filtered images')}
                        />
                      ),
                      width: '52px',
                      align: 'center',
                      render: (row) => (
                        <Checkbox
                          size="sm"
                          checked={selectedImagePathSet.has(row.path)}
                          onChange={(event) => toggleImageSelection(row.path, event.target.checked)}
                          aria-label={`${lt('Select')} ${row.filename}`}
                        />
                      ),
                    },
                    {
                      key: 'image',
                      header: lt('Image'),
                      width: '360px',
                      render: (row) => (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openImageDetail(row)}
                            className="overflow-hidden rounded-[11px] bg-[var(--muted-surface)]"
                          >
                            <img
                              src={resolveMediaUrl(row.file_url) ?? row.file_url}
                              alt={row.filename}
                              className="h-11 w-11 object-cover"
                            />
                          </button>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openImageDetail(row)}
                              className="truncate text-left text-sm font-semibold text-[var(--foreground)] transition-colors hover:text-[var(--primary)]"
                            >
                              {row.filename}
                            </button>
                            <p className="mt-1 break-all text-[12px] text-[var(--muted)]">{row.path}</p>
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: 'category',
                      header: lt('Category'),
                      render: (row) => <Badge variant="secondary">{lt(getImageCategoryLabel(row.category))}</Badge>,
                    },
                    {
                      key: 'references',
                      header: lt('References'),
                      align: 'center',
                      render: (row) => (
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant={row.is_referenced ? 'success' : 'outline'}>
                            {row.is_referenced ? lt('Referenced') : lt('Unused')}
                          </Badge>
                          <span className="text-[12px] text-[var(--muted)]">{row.reference_count} {lt('refs')}</span>
                        </div>
                      ),
                    },
                    {
                      key: 'size',
                      header: lt('Size'),
                      align: 'right',
                      render: (row) => formatBytes(row.size_bytes),
                    },
                    {
                      key: 'updated',
                      header: lt('Updated'),
                      render: (row) => formatShortDate(row.updated_at),
                    },
                    {
                      key: 'actions',
                      header: lt('Actions'),
                      render: (row) => (
                        <ActionsMenu
                          label={`${lt('Actions for')} ${row.filename}`}
                          items={[
                            { label: lt('View detail'), onSelect: () => openImageDetail(row) },
                            {
                              label: selectedImagePathSet.has(row.path) ? lt('Unselect') : lt('Select'),
                              onSelect: () => toggleImageSelection(row.path),
                            },
                            ...(canDelete ? [{
                              label: lt('Delete'),
                              onSelect: () => void handleDeleteImageByPath(row.path),
                              tone: 'danger' as const,
                            }] : []),
                          ]}
                        />
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      ) : null}

      <Dialog
        open={Boolean(imageDetailPath)}
        onClose={() => setImageDetailPath(null)}
        title={activeImageDetail?.filename ?? lt('Image detail')}
        description={activeImageDetail?.path ?? lt('Management image metadata')}
        size="lg"
        footer={(
          <>
            {activeImageDetail ? (
              <Button
                variant="secondary"
                onClick={() => toggleImageSelection(activeImageDetail.path)}
              >
                {selectedImagePathSet.has(activeImageDetail.path) ? lt('Unselect') : lt('Select')}
              </Button>
            ) : null}
            {activeImageDetail && canDelete ? (
              <Button
                variant="danger"
                onClick={() => void handleDeleteImageByPath(activeImageDetail.path)}
                loading={isSingleDeleteSubmitting}
              >
                {lt('Delete image')}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setImageDetailPath(null)}>
              {lt('Close')}
            </Button>
          </>
        )}
      >
        {activeImageDetail ? (
          <div className="space-y-[18px]">
            <div className="overflow-hidden rounded-[18px] bg-[var(--muted-surface)]">
              <img
                src={resolveMediaUrl(activeImageDetail.file_url) ?? activeImageDetail.file_url}
                alt={activeImageDetail.filename}
                className="max-h-[420px] w-full object-contain"
              />
            </div>

            {imageDetailQuery.isLoading && imageDetailQuery.data?.path !== imageDetailPath ? (
              <p className="text-[13px] text-[var(--muted)]">{lt('Refreshing image detail...')}</p>
            ) : null}

            <div className="grid gap-[18px] sm:grid-cols-2">
              <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-4">
                <p className="ui-card-label">{lt('Category')}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{lt(getImageCategoryLabel(activeImageDetail.category))}</p>
              </div>
              <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-4">
                <p className="ui-card-label">{lt('Size')}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatBytes(activeImageDetail.size_bytes)}</p>
              </div>
              <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-4">
                <p className="ui-card-label">{lt('References')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={activeImageDetail.is_referenced ? 'success' : 'outline'}>
                    {activeImageDetail.is_referenced ? lt('Referenced') : lt('Unused')}
                  </Badge>
                  <span className="text-sm font-semibold text-[var(--foreground)]">{activeImageDetail.reference_count}</span>
                </div>
              </div>
              <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-4">
                <p className="ui-card-label">{lt('Updated')}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatShortDate(activeImageDetail.updated_at)}</p>
              </div>
            </div>

            <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-4">
              <p className="ui-card-label">{lt('Path')}</p>
              <p className="mt-2 break-all text-sm font-semibold text-[var(--foreground)]">{activeImageDetail.path}</p>
              <p className="ui-card-label mt-4">{lt('File URL')}</p>
              <p className="mt-2 break-all text-[13.5px] text-[var(--muted-strong)]">{activeImageDetail.file_url}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] bg-[var(--muted-surface)] px-4 py-5 text-[13.5px] text-[var(--muted)]">
            {lt('Image detail not found.')}
          </div>
        )}
      </Dialog>

      <Dialog
        open={pageDialogOpen}
        onClose={closePageDialog}
        title={pageDialogMode === 'create' ? lt('Create page') : lt('Edit page')}
        description={lt('Management page CRUD form')}
        size="xl"
        footer={(
          <>
            <Button variant="secondary" onClick={closePageDialog} disabled={isPageSubmitting}>
              {lt('Cancel')}
            </Button>
            <Button onClick={() => void handleSubmitPage()} loading={isPageSubmitting}>
              {pageDialogMode === 'create' ? lt('Create page') : lt('Save changes')}
            </Button>
          </>
        )}
      >
        <div className="grid gap-[18px] lg:grid-cols-2">
          <div className="space-y-[18px]">
            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Name')}</Label>
              <Input
                value={pageForm.name}
                onChange={(event) => setPageForm((current) => ({ ...current, name: event.target.value }))}
                disabled={pageDialogMode === 'edit'}
                placeholder="team_updates"
              />
            </div>

            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Display name')}</Label>
              <Input
                value={pageForm.displayName}
                onChange={(event) => setPageForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder={lt('Team Updates')}
              />
            </div>

            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Description')}</Label>
              <Textarea
                value={pageForm.description}
                onChange={(event) => setPageForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={lt('Page usage description')}
              />
            </div>
          </div>

          <div className="space-y-[18px]">
            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Route path')}</Label>
              <Input
                value={pageForm.routePath}
                onChange={(event) => setPageForm((current) => ({ ...current, routePath: event.target.value }))}
                placeholder="/ceo/team-updates"
              />
            </div>

            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Order')}</Label>
              <Input
                type="number"
                value={pageForm.order}
                onChange={(event) => setPageForm((current) => ({ ...current, order: event.target.value }))}
              />
            </div>

            <div>
              <p className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Active state')}</p>
              <BooleanToggle
                value={pageForm.isActive}
                onChange={(isActive) => setPageForm((current) => ({ ...current, isActive }))}
                trueLabel={lt('Active')}
                falseLabel={lt('Inactive')}
              />
            </div>

            {pageDialogMode === 'create' ? (
              <div>
                <p className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('System page')}</p>
                <BooleanToggle
                  value={pageForm.isSystem}
                  onChange={(isSystem) => setPageForm((current) => ({ ...current, isSystem }))}
                  trueLabel={lt('System')}
                  falseLabel={lt('Custom')}
                />
              </div>
            ) : null}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={statusDialogOpen}
        onClose={closeStatusDialog}
        title={statusDialogMode === 'create' ? lt('Create status') : lt('Edit status')}
        description={lt('Status CRUD form')}
        size="xl"
        footer={(
          <>
            <Button variant="secondary" onClick={closeStatusDialog} disabled={isStatusSubmitting}>
              {lt('Cancel')}
            </Button>
            <Button onClick={() => void handleSubmitStatus()} loading={isStatusSubmitting}>
              {statusDialogMode === 'create' ? lt('Create status') : lt('Save changes')}
            </Button>
          </>
        )}
      >
        <div className="grid gap-[18px] lg:grid-cols-2">
          <div className="space-y-[18px]">
            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Name')}</Label>
              <Input
                value={statusForm.name}
                onChange={(event) => setStatusForm((current) => ({ ...current, name: event.target.value }))}
                disabled={statusDialogMode === 'edit'}
                placeholder="contacted"
              />
            </div>

            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Display name')}</Label>
              <Input
                value={statusForm.displayName}
                onChange={(event) => setStatusForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder={lt('Contacted')}
              />
            </div>

            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Description')}</Label>
              <Textarea
                value={statusForm.description}
                onChange={(event) => setStatusForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={lt('Status usage description')}
              />
            </div>
          </div>

          <div className="space-y-[18px]">
            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Color')}</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="color"
                  value={statusForm.color}
                  onChange={(event) => setStatusForm((current) => ({ ...current, color: event.target.value }))}
                  className="h-11 w-16 rounded-[14px] p-1.5"
                />
                <div className="flex flex-wrap gap-2">
                  {statusColorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setStatusForm((current) => ({ ...current, color }))}
                      className={cn(
                        'h-9 w-9 rounded-full border-2 transition-colors',
                        statusForm.color === color ? 'border-[var(--foreground)]' : 'border-transparent',
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Select ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Order')}</Label>
              <Input
                type="number"
                value={statusForm.order}
                onChange={(event) => setStatusForm((current) => ({ ...current, order: event.target.value }))}
              />
            </div>

            <div>
              <p className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Active state')}</p>
              <BooleanToggle
                value={statusForm.isActive}
                onChange={(isActive) => setStatusForm((current) => ({ ...current, isActive }))}
                trueLabel={lt('Active')}
                falseLabel={lt('Inactive')}
              />
            </div>

            {statusDialogMode === 'create' ? (
              <div>
                <p className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('System status')}</p>
                <BooleanToggle
                  value={statusForm.isSystem}
                  onChange={(isSystem) => setStatusForm((current) => ({ ...current, isSystem }))}
                  trueLabel={lt('System')}
                  falseLabel={lt('Custom')}
                />
              </div>
            ) : null}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={roleDialogOpen}
        onClose={closeRoleDialog}
        title={roleDialogMode === 'create' ? lt('Create role') : lt('Edit role')}
        description={lt('Role CRUD form')}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={closeRoleDialog} disabled={isRoleSubmitting}>
              {lt('Cancel')}
            </Button>
            <Button onClick={() => void handleSubmitRole()} loading={isRoleSubmitting}>
              {roleDialogMode === 'create' ? lt('Create role') : lt('Save changes')}
            </Button>
          </>
        )}
      >
        <div className="grid gap-[18px]">
          <div>
            <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Name')}</Label>
            <Input
              value={roleForm.name}
              onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
              disabled={roleDialogMode === 'edit'}
              placeholder="SalesManager"
            />
          </div>

          <div>
            <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Display name')}</Label>
            <Input
              value={roleForm.displayName}
              onChange={(event) => setRoleForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder={lt('Sales Manager')}
              />
            </div>

          <div>
            <Label className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Description')}</Label>
            <Textarea
              value={roleForm.description}
              onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={lt('Role usage description')}
            />
          </div>

          <div>
            <p className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('Active state')}</p>
            <BooleanToggle
              value={roleForm.isActive}
              onChange={(isActive) => setRoleForm((current) => ({ ...current, isActive }))}
              trueLabel={lt('Active')}
              falseLabel={lt('Inactive')}
            />
          </div>

          {roleDialogMode === 'create' ? (
            <div>
              <p className="mb-2 block text-[13px] font-medium text-[var(--muted-strong)]">{lt('System role')}</p>
              <BooleanToggle
                value={roleForm.isSystem}
                onChange={(isSystem) => setRoleForm((current) => ({ ...current, isSystem }))}
                trueLabel={lt('System')}
                falseLabel={lt('Custom')}
              />
            </div>
          ) : null}
        </div>
      </Dialog>
    </section>
  )
}
