import { useRef, useState } from 'react'
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
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'

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
    <div className="flex items-center gap-3 rounded-xl border border-(--border) bg-(--surface) p-3 transition-colors hover:bg-(--accent-soft)">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-(--border) bg-(--muted-surface) text-(--muted)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-(--foreground)">{attachment.file_name}</p>
        <p className="text-xs text-(--muted)">
          {formatFileSize(attachment.file_size)} · {attachment.created_by_user.name} {attachment.created_by_user.surname}
          {' · '}{new Date(attachment.created_at).toLocaleDateString()}
        </p>
        {attachment.description && (
          <p className="mt-0.5 text-xs text-(--muted-strong) italic">{attachment.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={buildFileUrl(attachment.url_path)}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-8 w-8 place-items-center rounded-lg border border-(--border) bg-(--surface) text-(--muted) transition hover:border-(--blue-border) hover:text-(--blue-text)"
          title="Download"
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
          </svg>
        </a>
        <button
          type="button"
          onClick={() => onDelete(attachment.id)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-(--border) bg-(--surface) text-(--muted) transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
          title="Delete"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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
      <div className="flex flex-col gap-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-(--border) bg-(--muted-surface) p-1">
          {TABS.map((tab) => {
            const count = allAttachments.filter((a) => a.attachment_type === tab.key).length
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all',
                  activeTab === tab.key
                    ? 'bg-(--blue-soft) text-(--blue-text) shadow-sm'
                    : 'text-(--muted-strong) hover:text-(--foreground)',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                    activeTab === tab.key ? 'bg-(--blue-dim) text-(--blue-text)' : 'bg-(--accent-soft) text-(--muted)',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Upload area */}
        <div className="rounded-xl border border-dashed border-(--border) bg-(--muted-surface)/50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              ref={fileInputRef}
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 flex-1 rounded-xl border border-(--border) bg-(--surface) px-3 text-sm text-(--foreground) placeholder:text-(--muted) focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
          <p className="mt-2 text-[11px] text-(--muted)">
            Supported: jpg, png, webp, gif, pdf, doc, docx, xls, xlsx
          </p>
        </div>

        {/* File list */}
        <div className="flex flex-col gap-2">
          {query.isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-(--border) bg-(--surface)" />
              ))}
            </div>
          ) : tabAttachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-(--muted)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 opacity-40">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
