import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, Paperclip, X } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { Dialog } from '../../../shared/ui/dialog'
import { Button } from '../../../shared/ui/button'
import { IconButton } from '../../../shared/ui/icon-button'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import type {
  CardRecord,
  UserSummary,
} from '../../../shared/api/services/projects.service'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { buildFormData } from '../lib/formdata'
import { getPriorityConfig } from '../lib/format'
import { MemberSelector } from './MemberSelector'

type CardFormValues = {
  title: string
  description: string
  priority: string
  assignee_ids: number[]
  due_date: string
  images: File[]
  clear_existing_images: boolean
}

type CardFormModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<void>
  initial?: CardRecord | null
  members: UserSummary[]
  title: string
  submitLabel: string
  isSubmitting: boolean
  showPriority?: boolean
}

const empty: CardFormValues = {
  title: '',
  description: '',
  priority: '',
  assignee_ids: [],
  due_date: '',
  images: [],
  clear_existing_images: false,
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function toApiDateTimeWithOffset(value: string) {
  const [datePart, timePart] = value.split('T')

  if (!datePart || !timePart) {
    return value
  }

  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  const date = new Date(year, month - 1, day, hours, minutes, 0)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(offsetMinutes)
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0')
  const offsetMins = String(absoluteOffset % 60).padStart(2, '0')

  return `${datePart}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00${sign}${offsetHours}:${offsetMins}`
}

function getCardImageUrl(image: { url?: string | null; url_path?: string | null }) {
  const value = image.url ?? image.url_path ?? ''
  return resolveMediaUrl(value) ?? value
}

export function CardFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  members,
  title,
  submitLabel,
  isSubmitting,
  showPriority = true,
}: CardFormModalProps) {
  const { t } = useLocale()
  const priorityConfig = getPriorityConfig()
  const [values, setValues] = useState<CardFormValues>(empty)
  const [titleError, setTitleError] = useState('')
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const priorityOptions: SelectFieldOption[] = [
    { value: '', label: t('projects.no_priority', 'No priority') },
    { value: 'low', label: priorityConfig.low.label },
    { value: 'medium', label: priorityConfig.medium.label },
    { value: 'high', label: priorityConfig.high.label },
  ]

  useEffect(() => {
    if (open) {
      if (initial) {
        const initialImages = Array.isArray(initial.images)
          ? initial.images
          : Array.isArray(initial.files)
            ? initial.files
            : []

        setValues({
          title: initial.title,
          description: initial.description ?? '',
          priority: initial.priority === 'urgent' ? 'high' : (initial.priority ?? ''),
          assignee_ids: Array.isArray(initial.assignee_ids) && initial.assignee_ids.length > 0
            ? initial.assignee_ids.filter((value) => Number.isFinite(value) && value > 0)
            : initial.assignees.length > 0
              ? initial.assignees.map((member) => member.id).filter((value) => Number.isFinite(value) && value > 0)
              : initial.assignee_id
                ? [initial.assignee_id]
                : [],
          due_date: toDateTimeLocalValue(initial.due_date),
          images: [],
          clear_existing_images: false,
        })
        setImagePreviews(initialImages.map(getCardImageUrl))
      } else {
        setValues(empty)
        setImagePreviews([])
      }

      setTitleError('')
      setPreviewImageUrl(null)
    }
  }, [open, initial])

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [imagePreviews])

  function set<K extends keyof CardFormValues>(key: K, value: CardFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))

    if (key === 'title') {
      setTitleError('')
    }
  }

  function handleImagesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])

    if (!files.length) {
      return
    }

    const urls = files.map((file) => URL.createObjectURL(file))
    setValues((prev) => ({ ...prev, images: [...prev.images, ...files] }))
    setImagePreviews((prev) => [...prev, ...urls])
  }

  function removeImage(index: number) {
    const existingCount = Array.isArray(initial?.images)
      ? initial.images.length
      : Array.isArray(initial?.files)
        ? initial.files.length
        : 0

    const newIndex = index - existingCount

    if (newIndex < 0) {
      setValues((prev) => ({ ...prev, clear_existing_images: true }))
      setImagePreviews((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
      return
    }

    const url = imagePreviews[index]
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }

    setValues((prev) => ({ ...prev, images: prev.images.filter((_, itemIndex) => itemIndex !== newIndex) }))
    setImagePreviews((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  function openImagePreview(url: string) {
    setPreviewImageUrl(url)
  }

  function closeImagePreview() {
    setPreviewImageUrl(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!values.title.trim()) {
      setTitleError(t('projects.card_title_required', 'Card title is required'))
      return
    }

    const fd = buildFormData({
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      priority: showPriority ? (values.priority || undefined) : undefined,
      assignee_id: values.assignee_ids[0] ?? undefined,
      assignee_ids: values.assignee_ids,
      due_date: values.due_date ? toApiDateTimeWithOffset(values.due_date) : undefined,
    })

    if (initial && values.clear_existing_images) {
      fd.append('clear_existing_images', 'true')
    }

    for (const image of values.images) {
      fd.append('images', image)
    }

    await onSubmit(fd)
  }

  const newFilesLabel = values.images.length === 1
    ? t('projects.new_files_count', '{count} new file', { count: values.images.length })
    : t('projects.new_files_count_plural', '{count} new files', { count: values.images.length })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={t('projects.form_eyebrow_cards', 'Cards')}
      size="lg"
      footer={(
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={isSubmitting}>
            {t('projects.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isSubmitting}
            onClick={handleSubmit as unknown as React.MouseEventHandler}
          >
            {submitLabel}
          </Button>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* The task itself: a borderless title and description, like writing on paper */}
        <input
          value={values.title}
          onChange={(event) => set('title', event.target.value)}
          placeholder={t('projects.task_title_placeholder', 'Task name')}
          aria-label={t('projects.card_title', 'Title')}
          autoFocus
          className="w-full bg-transparent text-[19px] leading-7 font-semibold tracking-[-0.02em] text-[var(--foreground)] outline-none placeholder:font-medium placeholder:text-[var(--caption)]"
        />
        {titleError ? <p className="mt-1 text-xs text-[var(--danger-text)]">{titleError}</p> : null}
        <textarea
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          placeholder={t('projects.card_description_placeholder', 'Add more details...')}
          aria-label={t('projects.description', 'Description')}
          rows={3}
          className="mt-2 w-full resize-none bg-transparent text-[14px] leading-[1.6] text-[var(--foreground)] outline-none placeholder:text-[var(--caption)]"
        />

        {/* Properties */}
        <div className="mt-4 flex flex-col gap-4 border-t border-[var(--border)] pt-4">
          <div className={cn('grid gap-4', showPriority ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
            {showPriority ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-[var(--muted)]">{t('projects.priority', 'Priority')}</span>
                <SelectField
                  value={values.priority}
                  options={priorityOptions}
                  onValueChange={(value) => set('priority', value)}
                  placeholder={t('projects.no_priority', 'No priority')}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-[var(--muted)]">{t('projects.due_date_time', 'Due date')}</span>
              <CalendarField mode="datetime" value={values.due_date} onValueChange={(value) => set('due_date', value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[var(--muted)]">{t('projects.assignees', 'Assignees')}</span>
            <MemberSelector
              allUsers={members}
              selectedIds={values.assignee_ids}
              onChange={(ids) => set('assignee_ids', ids)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-medium text-[var(--muted)]">{t('projects.attachments', 'Attachments')}</span>
            <div className="flex flex-wrap items-center gap-2">
              {imagePreviews.map((url, index) => (
                <div key={`${url}-${index}`} className="group relative h-16 w-16 overflow-hidden rounded-[12px] bg-[var(--muted-surface)] ring-1 ring-[var(--border)]">
                  <img src={url} alt={t('projects.attachment', 'Attachment')} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => openImagePreview(url)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:bg-[var(--surface-inverse)]/45 group-hover:opacity-100"
                    aria-label={t('projects.preview_image', 'Preview image')}
                  >
                    <Eye size={18} className="text-white" />
                  </button>
                  <IconButton
                    label={t('projects.remove', 'Remove')}
                    tone="inverse"
                    size="sm"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100"
                  >
                    <X size={12} strokeWidth={2.4} />
                  </IconButton>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] font-medium text-[var(--muted-strong)] ring-1 ring-[var(--border-hover)] transition-colors hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
              >
                <Paperclip size={14} strokeWidth={2} />
                {t('projects.add_images', 'Add images')}
              </button>
              {values.images.length > 0 ? <span className="text-xs text-[var(--muted)]">{newFilesLabel}</span> : null}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImagesChange} />
          </div>
        </div>
      </form>

      {previewImageUrl && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="dialog-backdrop fixed inset-0 z-220 flex items-center justify-center p-4"
              onClick={closeImagePreview}
              aria-hidden="true"
            >
              <div
                className="relative max-h-[90vh] max-w-[92vw] overflow-hidden rounded-[24px] bg-[var(--surface)] shadow-[var(--elev-xl)]"
                onClick={(event) => event.stopPropagation()}
              >
                <IconButton
                  label={t('projects.close_preview', 'Close preview')}
                  tone="inverse"
                  size="lg"
                  onClick={closeImagePreview}
                  className="absolute top-3 right-3 rounded-full"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </IconButton>
                <img
                  src={previewImageUrl}
                  alt={t('projects.preview_image', 'Preview image')}
                  className="max-h-[90vh] max-w-[92vw] object-contain"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </Dialog>
  )
}
