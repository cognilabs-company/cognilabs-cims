import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { Dialog } from '../../../shared/ui/dialog'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { projectsService, type ProjectRecord } from '../../../shared/api/services/projects.service'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { buildFormData } from '../lib/formdata'

type ProjectFormValues = {
  project_name: string
  project_description: string
  project_url: string
  team_id: string
  deadline: string
  telegram_group_id: string
  image: File | null
  clear_existing_image: boolean
}

type ProjectFormModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (fd: FormData, telegramGroupId?: string | null) => Promise<void>
  initial?: ProjectRecord | null
  title: string
  submitLabel: string
  isSubmitting: boolean
}

const empty: ProjectFormValues = {
  project_name: '',
  project_description: '',
  project_url: '',
  team_id: '',
  deadline: '',
  telegram_group_id: '',
  image: null,
  clear_existing_image: false,
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function toApiDateTimeWithOffset(value: string) {
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return value

  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  const localDate = new Date(year, month - 1, day, hours, minutes, 0)
  if (Number.isNaN(localDate.getTime())) return value

  const offsetMinutes = -localDate.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(offsetMinutes)
  return `${datePart}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`
}

export function ProjectFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  title,
  submitLabel,
  isSubmitting,
}: ProjectFormModalProps) {
  const { t } = useLocale()
  const [values, setValues] = useState<ProjectFormValues>(empty)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormValues, string>>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const teamsQuery = useAsyncData(
    () => projectsService.listTeams(),
    [open],
    { enabled: open },
  )

  useEffect(() => {
    if (open) {
      if (initial) {
        setValues({
          project_name: initial.project_name,
          project_description: initial.project_description ?? '',
          project_url: initial.project_url ?? '',
          team_id: initial.team_id ? String(initial.team_id) : '',
          deadline: toDateTimeLocalValue(initial.deadline),
          telegram_group_id: initial.telegram_group_id ?? '',
          image: null,
          clear_existing_image: false,
        })
        setPreviewUrl(resolveMediaUrl(initial.image) ?? initial.image ?? null)
      } else {
        setValues(empty)
        setPreviewUrl(null)
      }

      setErrors({})
    }
  }, [open, initial])

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function set<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      return
    }

    set('image', file)
    set('clear_existing_image', false)
    const url = URL.createObjectURL(file)

    setPreviewUrl((oldValue) => {
      if (oldValue?.startsWith('blob:')) {
        URL.revokeObjectURL(oldValue)
      }

      return url
    })
  }

  function validate() {
    const next: typeof errors = {}

    if (!values.project_name.trim()) {
      next.project_name = t('projects.project_name_required', 'Project name is required')
    }

    if (!values.team_id) {
      next.team_id = t('projects.team_required', 'Select a team for this project')
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!validate()) {
      return
    }

    const fd = buildFormData({
      project_name: values.project_name.trim(),
      project_description: values.project_description.trim() || undefined,
      project_url: values.project_url.trim() || undefined,
      team_id: values.team_id ? Number(values.team_id) : undefined,
      deadline: values.deadline ? toApiDateTimeWithOffset(values.deadline) : undefined,
      telegram_group_id: initial ? undefined : values.telegram_group_id.trim() || undefined,
      image: values.image ?? undefined,
    })

    if (initial && values.clear_existing_image && !values.image) {
      fd.append('clear_existing_image', 'true')
    }

    await onSubmit(fd, initial ? values.telegram_group_id.trim() || null : undefined)
  }

  const teamOptions: SelectFieldOption[] = [
    ...(teamsQuery.data?.teams ?? []).map((team) => ({ value: String(team.id), label: team.name })),
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={t('projects.form_eyebrow_projects', 'Projects')}
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
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.project_image', 'Project Image')}
          </label>
          <div className="flex items-center gap-4">
            <div
              className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--input-surface)] transition hover:border-[var(--border-hover)]"
              onClick={() => fileRef.current?.click()}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={t('projects.preview_image', 'Preview')}
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                {previewUrl
                  ? t('projects.change_image', 'Change image')
                  : t('projects.upload_image', 'Upload image')}
              </Button>

              {previewUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    set('image', null)
                    set('clear_existing_image', true)
                    setPreviewUrl(null)

                    if (fileRef.current) {
                      fileRef.current.value = ''
                    }
                  }}
                >
                  {t('projects.remove', 'Remove')}
                </Button>
              ) : null}

              <p className="text-[10px] text-[var(--muted)]">
                {t('projects.image_hint', 'PNG, JPG up to 5 MB')}
              </p>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.project_name', 'Project Name')} <span className="text-red-400">*</span>
          </label>
          <Input
            value={values.project_name}
            onChange={(event) => set('project_name', event.target.value)}
            placeholder={t('projects.project_name_placeholder', 'My awesome project')}
          />
          {errors.project_name ? (
            <p className="text-xs text-[var(--danger-text)]">{errors.project_name}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.description', 'Description')}
          </label>
          <Textarea
            value={values.project_description}
            onChange={(event) => set('project_description', event.target.value)}
            placeholder={t('projects.description_placeholder', 'Describe the project goals and scope...')}
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.project_url', 'Project URL')}
          </label>
          <Input
            type="url"
            value={values.project_url}
            onChange={(event) => set('project_url', event.target.value)}
            placeholder="https://example.com"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
              {t('projects.team', 'Team')}
            </label>
            <SelectField
              value={values.team_id}
              options={teamOptions}
              onValueChange={(value) => set('team_id', value)}
              placeholder={t('projects.select_team', 'Select a team')}
              disabled={teamsQuery.isLoading}
            />
            {errors.team_id ? <p className="text-xs text-[var(--danger-text)]">{errors.team_id}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
              {t('projects.deadline', 'Project deadline')}
            </label>
            <Input
              type="datetime-local"
              value={values.deadline}
              onChange={(event) => set('deadline', event.target.value)}
              step="60"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.telegram_group_id', 'Telegram group ID')}
          </label>
          <Input
            value={values.telegram_group_id}
            onChange={(event) => set('telegram_group_id', event.target.value)}
            placeholder="-1001234567890"
          />
          <p className="text-[11px] text-[var(--muted)]">
            {t('projects.telegram_group_hint', 'Tasks created from this group are added to the matching board.')}
          </p>
        </div>
      </form>
    </Dialog>
  )
}
