import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { Dialog } from '../../../shared/ui/dialog'
import { Button } from '../../../shared/ui/button'
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
      {/* Only the name: the board shows no column colours, so an existing colour is kept as it is. */}
      <form onSubmit={handleSubmit} className="flex flex-col">
        <input
          value={values.name}
          onChange={(event) => {
            setValues((prev) => ({ ...prev, name: event.target.value }))
            setNameError('')
          }}
          placeholder={t('projects.column_name_placeholder', 'To Do, In Progress, Done...')}
          aria-label={t('projects.column_name', 'Column Name')}
          autoFocus
          className="w-full bg-transparent text-[19px] leading-7 font-semibold tracking-[-0.02em] text-[var(--foreground)] outline-none placeholder:font-medium placeholder:text-[var(--caption)]"
        />
        {nameError ? <p className="mt-1 text-[12.5px] text-[var(--danger-text)]">{nameError}</p> : null}
      </form>
    </Dialog>
  )
}
