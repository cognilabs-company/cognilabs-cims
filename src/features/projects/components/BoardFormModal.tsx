import { useEffect, useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { Dialog } from '../../../shared/ui/dialog'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
import type { BoardRecord } from '../../../shared/api/services/projects.service'

type BoardFormValues = {
  name: string
  description: string
}

type BoardFormModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (values: BoardFormValues) => Promise<void>
  initial?: BoardRecord | null
  title: string
  submitLabel: string
  isSubmitting: boolean
}

const empty: BoardFormValues = { name: '', description: '' }

export function BoardFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  title,
  submitLabel,
  isSubmitting,
}: BoardFormModalProps) {
  const { t } = useLocale()
  const [values, setValues] = useState<BoardFormValues>(empty)
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (open) {
      setValues(initial ? { name: initial.name, description: initial.description ?? '' } : empty)
      setNameError('')
    }
  }, [open, initial])

  function set<K extends keyof BoardFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))

    if (key === 'name') {
      setNameError('')
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!values.name.trim()) {
      setNameError(t('projects.board_name_required', 'Board name is required'))
      return
    }

    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || undefined as unknown as string,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={t('projects.form_eyebrow_boards', 'Boards')}
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
            {t('projects.board_name', 'Board Name')} <span className="text-red-400">*</span>
          </label>
          <Input
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder={t('projects.board_name_placeholder', 'Sprint backlog, Design review...')}
            autoFocus
          />
          {nameError ? <p className="text-xs text-[var(--danger-text)]">{nameError}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
            {t('projects.description', 'Description')}
          </label>
          <Textarea
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder={t('projects.board_description_placeholder', 'What is this board for?')}
            rows={3}
          />
        </div>
      </form>
    </Dialog>
  )
}
