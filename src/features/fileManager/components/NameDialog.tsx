import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { baseNameRange } from '../lib/items'
import { MAX_NAME, nameError } from '../lib/names'

/** One-field dialog for "New folder" and "Rename". Mount it fresh for every use (it keeps its own draft). */
export function NameDialog({
  title,
  description,
  label,
  initialValue = '',
  confirmLabel,
  icon,
  selectBaseName = false,
  onSubmit,
  onClose,
}: {
  title: string
  description?: string
  label: string
  initialValue?: string
  confirmLabel: string
  icon: ReactNode
  /** Rename of a file: pre-select the name without its extension. */
  selectBaseName?: boolean
  /** Resolves when saved (the parent closes the dialog); rejects to keep it open. */
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
}) {
  const { t } = useLocale()
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    if (selectBaseName) {
      const [start, end] = baseNameRange(input.value)
      input.setSelectionRange(start, end)
    } else {
      input.select()
    }
  }, [selectBaseName])

  const name = value.trim()
  const error = nameError(value, t)
  const unchanged = Boolean(initialValue) && name === initialValue.trim()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (error || busy) return
    if (unchanged) {
      onClose()
      return
    }
    setBusy(true)
    try {
      await onSubmit(name)
    } catch {
      /* the parent already showed why; keep the dialog open */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => { if (!busy) onClose() }}
      title={title}
      description={description}
      headerIcon={icon}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t('files.cancel', 'Cancel')}</Button>
          <Button type="submit" form="fm-name-form" loading={busy} disabled={Boolean(error) && touched}>{confirmLabel}</Button>
        </>
      )}
    >
      <form id="fm-name-form" onSubmit={(event) => void submit(event)} noValidate>
        <label htmlFor="fm-name-input" className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{label}</label>
        <input
          id="fm-name-input"
          ref={inputRef}
          data-ui-control="true"
          className="control-field min-h-10 w-full rounded-[10px] px-3 py-1.5 text-[13.5px] placeholder:text-[var(--caption)]"
          value={value}
          maxLength={MAX_NAME + 20}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={touched && Boolean(error)}
          aria-describedby={touched && error ? 'fm-name-error' : undefined}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        {touched && error ? (
          <p id="fm-name-error" className="mt-1.5 text-[12px] font-medium text-[var(--danger-text)]">{error}</p>
        ) : null}
      </form>
    </Dialog>
  )
}
