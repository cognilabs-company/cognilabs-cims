import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { baseNameRange } from '../lib/items'
import { MAX_NAME, nameError } from '../lib/names'

/**
 * Rename in place (F2): the name turns into a text box with the base name selected.
 * Enter or clicking away saves, Esc cancels. `onCommit` resolves true when saved; on false the box
 * stays open so the name can be fixed (e.g. 409 — the name is taken).
 */
export function InlineRename({
  initialValue,
  selectBaseName,
  multiline = false,
  onCommit,
  onCancel,
}: {
  initialValue: string
  selectBaseName: boolean
  /** Icon views: the box wraps like the label under the icon. */
  multiline?: boolean
  onCommit: (name: string) => Promise<boolean>
  onCancel: () => void
}) {
  const { t } = useLocale()
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [showError, setShowError] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const settled = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus({ preventScroll: true })
    const [start, end] = selectBaseName ? baseNameRange(input.value) : [0, input.value.length]
    input.setSelectionRange(start, end)
  }, [selectBaseName])

  const error = nameError(value, t)

  async function commit() {
    if (busy || settled.current) return
    const name = value.trim()
    if (name === initialValue.trim()) {
      settled.current = true
      onCancel()
      return
    }
    if (error) {
      setShowError(true)
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    const ok = await onCommit(name)
    setBusy(false)
    if (ok) settled.current = true
    else inputRef.current?.focus()
  }

  const shared = {
    value,
    maxLength: MAX_NAME + 20,
    spellCheck: false,
    autoComplete: 'off',
    // readOnly (not disabled) while saving: a disabled box would lose the focus and the caret.
    readOnly: busy,
    'aria-busy': busy,
    'aria-label': t('files.new_name', 'New name'),
    'aria-invalid': showError && Boolean(error),
    'data-ui-control': 'true',
    className: cn('fx-rename', multiline && 'fx-rename--wrap', busy && 'opacity-60'),
    onChange: (event: { target: { value: string } }) => {
      setValue(event.target.value.replace(/[\r\n]+/g, ''))
      setShowError(false)
    },
    onBlur: () => void commit(),
    onKeyDown: (event: ReactKeyboardEvent) => {
      event.stopPropagation()
      if (event.key === 'Enter') {
        event.preventDefault()
        void commit()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        settled.current = true
        onCancel()
      }
    },
  }

  return (
    <span
      className="fx-rename-wrap"
      data-no-marquee=""
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onDragStart={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {multiline ? (
        <textarea ref={(node) => { inputRef.current = node }} rows={2} {...shared} />
      ) : (
        <input ref={(node) => { inputRef.current = node }} type="text" {...shared} />
      )}
      {showError && error ? <span role="alert" className="fx-rename__error">{error}</span> : null}
    </span>
  )
}
