import { useRef, useState } from 'react'
import { Download, FileText, Trash2 } from 'lucide-react'
import {
  projectsService,
  type AttachmentType,
  type ProjectAttachment,
} from '../../../shared/api/services/projects.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useToast } from '../../../shared/toast/useToast'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { env } from '../../../shared/config/env'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { IconButton } from '../../../shared/ui/icon-button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { Tabs, type TabItem } from '../../../shared/ui/tabs'

type Tab = { key: AttachmentType; label: string }

const TABS: Tab[] = [
  { key: 'tz', label: 'TZ' },
  { key: 'kp', label: 'KP' },
  { key: 'contracts', label: 'Contracts' },
]

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildFileUrl(urlPath: string) {
  const base = env.apiBaseUrl.replace(/\/$/, '')
  return urlPath.startsWith('http') ? urlPath : `${base}${urlPath}`
}

type FileRowProps = {
  attachment: ProjectAttachment
  onDelete: (id: number) => void
}

function FileRow({ attachment, onDelete }: FileRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-[var(--accent-soft)] p-3.5 transition-colors hover:bg-[var(--input-surface-hover)]">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--blue-dim)] text-[var(--blue-text)]">
        <FileText strokeWidth={1.8} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{attachment.file_name}</p>
        <p className="text-[12.5px] text-[var(--muted)]">
          {formatFileSize(attachment.file_size)} · {attachment.created_by_user.name} {attachment.created_by_user.surname}
          {' · '}{new Date(attachment.created_at).toLocaleDateString()}
        </p>
        {attachment.description && (
          <p className="mt-1 text-[12.5px] text-[var(--muted-strong)]">{attachment.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <a
          href={buildFileUrl(attachment.url_path)}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-9 w-9 place-items-center rounded-[11px] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:bg-[var(--blue-dim)] hover:text-[var(--blue-text)]"
          title="Download"
          onClick={(e) => e.stopPropagation()}
        >
          <Download strokeWidth={1.8} className="h-4 w-4" />
        </a>
        <IconButton
          tone="neutral"
          size="md"
          label="Delete"
          onClick={() => onDelete(attachment.id)}
          className="bg-[var(--surface)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]"
        >
          <Trash2 strokeWidth={1.8} className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}

type Props = {
  open: boolean
  onClose: () => void
  projectId: number
}

export function ProjectAttachmentsModal({ open, onClose, projectId }: Props) {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<AttachmentType>('tz')
  const [isUploading, setIsUploading] = useState(false)
  const [description, setDescription] = useState('')

  const query = useAsyncData(
    () => projectsService.listAttachments(projectId),
    [projectId, open],
    { enabled: open },
  )

  const allAttachments = query.data ?? []
  const tabAttachments = allAttachments.filter((a) => a.attachment_type === activeTab)

  const tabItems: TabItem<AttachmentType>[] = TABS.map((tab) => {
    const count = allAttachments.filter((a) => a.attachment_type === tab.key).length
    const isActive = tab.key === activeTab

    return {
      value: tab.key,
      label: tab.label,
      badge: count > 0 ? (
        <span
          data-ui-number="true"
          className={
            isActive
              ? 'rounded-full bg-[var(--blue-dim)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--blue-text)]'
              : 'rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--muted)]'
          }
        >
          {count}
        </span>
      ) : undefined,
    }
  })

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return

    const file = files[0]
    const formData = new FormData()
    formData.append('attachment_type', activeTab)
    formData.append('file', file)
    if (description.trim()) {
      formData.append('description', description.trim())
    }

    setIsUploading(true)
    try {
      await projectsService.uploadAttachment(projectId, formData)
      showToast({ title: 'File uploaded', tone: 'success' })
      setDescription('')
      await query.refetch()
    } catch (err) {
      showToast({ title: 'Upload failed', description: getApiErrorMessage(err), tone: 'error' })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(attachmentId: number) {
    const ok = await confirm({
      title: 'Delete attachment?',
      description: 'This file will be permanently removed.',
      tone: 'danger',
    })
    if (!ok) return

    try {
      await projectsService.deleteAttachment(attachmentId)
      showToast({ title: 'Attachment deleted', tone: 'success' })
      await query.refetch()
    } catch (err) {
      showToast({ title: 'Delete failed', description: getApiErrorMessage(err), tone: 'error' })
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Project Attachments" size="lg" eyebrow="Files">
      <div className="flex flex-col gap-[18px]">
        {/* Tabs */}
        <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} className="self-start" />

        {/* Upload area */}
        <div className="rounded-[18px] bg-[var(--muted-surface)] p-[18px]">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <input
              ref={fileInputRef}
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-[11px] border border-transparent bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[13px] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_rgba(43,89,255,0.12)]"
            />
            <Button
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0"
            >
              {isUploading ? 'Uploading...' : 'Upload file'}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <p className="mt-2.5 text-[11.5px] text-[var(--muted)]">
            Supported: jpg, png, webp, gif, pdf, doc, docx, xls, xlsx
          </p>
        </div>

        {/* File list */}
        <div className="flex flex-col gap-2.5">
          {query.isLoading ? (
            <div className="space-y-2.5">
              {[1, 2].map((i) => (
                <Skeleton key={i} rounded="xl" className="h-16" />
              ))}
            </div>
          ) : tabAttachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[18px] bg-[var(--muted-surface)] py-10 text-[var(--muted)]">
              <FileText strokeWidth={1.8} className="h-10 w-10 text-[#D3D7E0]" />
              <p className="text-sm font-semibold">No {TABS.find((t) => t.key === activeTab)?.label} files yet</p>
            </div>
          ) : (
            tabAttachments.map((attachment: ProjectAttachment) => (
              <FileRow key={attachment.id} attachment={attachment} onDelete={(id) => void handleDelete(id)} />
            ))
          )}
        </div>
      </div>
    </Dialog>
  )
}
