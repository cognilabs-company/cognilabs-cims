import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { Dialog } from '../../../shared/ui/dialog'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.card_title', 'Title')} <span className="text-red-400">*</span>
          </label>
          <Input
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder={t('projects.card_title_placeholder', 'What needs to be done?')}
            autoFocus
          />
          {titleError ? <p className="text-xs text-[var(--danger-text)]">{titleError}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.description', 'Description')}
          </label>
          <Textarea
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder={t('projects.card_description_placeholder', 'Add more details...')}
            rows={3}
          />
        </div>

        <div className={`grid gap-3 ${showPriority ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {showPriority ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
                {t('projects.priority', 'Priority')}
              </label>
              <SelectField
                value={values.priority}
                options={priorityOptions}
                onValueChange={(value) => set('priority', value)}
                placeholder={t('projects.no_priority', 'No priority')}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
              {t('projects.assignees', 'Assignees')}
            </label>
            <MemberSelector
              allUsers={members}
              selectedIds={values.assignee_ids}
              onChange={(ids) => set('assignee_ids', ids)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.due_date_time', 'Due Date & Time')}
          </label>
          <Input
            type="datetime-local"
            value={values.due_date}
            onChange={(event) => set('due_date', event.target.value)}
            step="60"
            className="text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.attachments', 'Attachments')}
          </label>

          {imagePreviews.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((url, index) => (
                <div key={`${url}-${index}`} className="group relative h-16 w-16 overflow-hidden rounded-xl border border-[var(--border)]">
                  <img
                    src={url}
                    alt={t('projects.attachment', 'Attachment')}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => openImagePreview(url)}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/35 group-hover:opacity-100"
                    aria-label={t('projects.preview_image', 'Preview image')}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-white drop-shadow" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2.25 12c1.9-4.82 6.07-8 9.75-8s7.85 3.18 9.75 8c-1.9 4.82-6.07 8-9.75 8s-7.85-3.18-9.75-8Z" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-rose-500"
                    aria-label={t('projects.remove', 'Remove')}
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              leftIcon={(
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
              )}
            >
              {t('projects.add_images', 'Add images')}
            </Button>

            {values.images.length > 0 ? (
              <span className="text-xs text-[var(--muted)]">{newFilesLabel}</span>
            ) : null}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImagesChange}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          {(Object.entries(priorityConfig) as [string, { label: string; color: string }][]).map(([key, value]) => (
            <span key={key} className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: value.color }} />
              {value.label}
            </span>
          ))}
        </div>
      </form>

      {previewImageUrl && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-220 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              onClick={closeImagePreview}
              aria-hidden="true"
            >
              <div
                className="relative max-h-[90vh] max-w-[92vw] overflow-hidden rounded-2xl border border-white/10 bg-(--surface-elevated) shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={closeImagePreview}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                  aria-label={t('projects.close_preview', 'Close preview')}
                >
                  <svg viewBox="0 0 16 16" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
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
