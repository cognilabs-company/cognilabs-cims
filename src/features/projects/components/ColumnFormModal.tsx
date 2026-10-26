import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { Dialog } from '../../../shared/ui/dialog'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { cn } from '../../../shared/lib/cn'
import type { ColumnRecord } from '../../../shared/api/services/projects.service'
import { getColumnColors } from '../lib/format'

type ColumnFormValues = {
  name: string
  color: string
}

type ColumnFormModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (values: ColumnFormValues) => Promise<void>
  initial?: ColumnRecord | null
  title: string
  submitLabel: string
  isSubmitting: boolean
}

export function ColumnFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  title,
  submitLabel,
  isSubmitting,
}: ColumnFormModalProps) {
  const { t } = useLocale()
  const columnColors = useMemo(() => getColumnColors(), [])
  const defaultColor = columnColors[0]?.value ?? '#3b82f6'

  const [values, setValues] = useState<ColumnFormValues>({ name: '', color: defaultColor })
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (open) {
      setValues(
        initial
          ? { name: initial.name, color: initial.color ?? defaultColor }
          : { name: '', color: defaultColor },
      )
      setNameError('')
    }
  }, [defaultColor, open, initial])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!values.name.trim()) {
      setNameError(t('projects.column_name_required', 'Column name is required'))
      return
    }

    await onSubmit({ name: values.name.trim(), color: values.color })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={t('projects.form_eyebrow_columns', 'Columns')}
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
            {t('projects.column_name', 'Column Name')} <span className="text-red-400">*</span>
          </label>
          <Input
            value={values.name}
            onChange={(event) => {
              setValues((prev) => ({ ...prev, name: event.target.value }))
              setNameError('')
            }}
            placeholder={t('projects.column_name_placeholder', 'To Do, In Progress, Done...')}
            autoFocus
          />
          {nameError ? <p className="text-xs text-[var(--danger-text)]">{nameError}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.accent_color', 'Accent Color')}
          </label>
          <div className="flex flex-wrap gap-2">
            {columnColors.map((colorOption) => (
              <button
                key={colorOption.value}
                type="button"
                title={colorOption.label}
                onClick={() => setValues((prev) => ({ ...prev, color: colorOption.value }))}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                  values.color === colorOption.value
                    ? 'scale-110 border-white'
                    : 'border-transparent',
                )}
                style={{ background: colorOption.value }}
              />
            ))}
          </div>

          <div
            className="h-1 w-full rounded-full opacity-70"
            style={{ background: values.color }}
          />
        </div>
      </form>
    </Dialog>
  )
}
