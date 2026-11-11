import { useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { Input } from '../../../shared/ui/input'

type OptionsEditorProps = {
  id: string
  options: string[]
  onChange: (options: string[]) => void
  error?: string
}

const MAX_OPTIONS = 200

/** Choices of a select / multi-select / radio field. Enter adds the next option; pasting several lines adds one per line. */
export function OptionsEditor({ id, options, onChange, error }: OptionsEditorProps) {
  const { t } = useLocale()
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  function update(index: number, value: string) {
    onChange(options.map((option, position) => (position === index ? value : option)))
  }

  function insertAfter(index: number, values: string[]) {
    const next = [...options.slice(0, index + 1), ...values, ...options.slice(index + 1)].slice(0, MAX_OPTIONS)
    onChange(next)
    setFocusIndex(Math.min(index + values.length, next.length - 1))
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= options.length) return
    const next = [...options]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === 'Enter') {
      event.preventDefault()
      insertAfter(index, [''])
    } else if (event.key === 'Backspace' && options[index] === '' && options.length > 1) {
      event.preventDefault()
      onChange(options.filter((_, position) => position !== index))
      setFocusIndex(Math.max(0, index - 1))
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    const text = event.clipboardData.getData('text')
    if (!/[\r\n]/.test(text)) return
    event.preventDefault()
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (!lines.length) return
    const [first, ...rest] = lines
    const next = options.map((option, position) => (position === index ? `${option}${first}` : option))
    onChange([...next.slice(0, index + 1), ...rest, ...next.slice(index + 1)].slice(0, MAX_OPTIONS))
    setFocusIndex(Math.min(index + rest.length, MAX_OPTIONS - 1))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('registrations.builder.options', 'Options')}</span>
        <span className="text-[11.5px] text-[var(--muted)]">{t('registrations.builder.options_hint', 'Enter adds the next one · paste a list to add many')}</span>
      </div>
      <ol aria-labelledby={`${id}-label`} className="flex flex-col gap-1.5">
        {options.map((option, index) => (
          <li key={index} className="group/opt flex items-center gap-1.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[11px] font-semibold text-[var(--muted)] tabular-nums">{index + 1}</span>
            <Input
              value={option}
              autoFocus={focusIndex === index}
              onFocus={() => setFocusIndex(null)}
              onChange={(event) => update(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onPaste={(event) => onPaste(event, index)}
              placeholder={t('registrations.builder.option_placeholder', 'Option {{n}}', { n: index + 1 })}
              aria-label={t('registrations.builder.option_placeholder', 'Option {{n}}', { n: index + 1 })}
              aria-invalid={error && !option.trim() ? true : undefined}
              maxLength={255}
              className="min-h-9 py-1"
              data-i18n-skip="true"
            />
            <div className="flex shrink-0 items-center">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t('registrations.builder.move_up', 'Move up')} className="grid h-8 w-7 place-items-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] disabled:opacity-30">
                <ArrowUpIcon size={13} />
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === options.length - 1} aria-label={t('registrations.builder.move_down', 'Move down')} className="grid h-8 w-7 place-items-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)] disabled:opacity-30">
                <ArrowDownIcon size={13} />
              </button>
              <button
                type="button"
                onClick={() => onChange(options.filter((_, position) => position !== index))}
                aria-label={t('registrations.builder.remove_option', 'Remove option')}
                className="grid h-8 w-8 place-items-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]"
              >
                <XIcon size={14} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => insertAfter(options.length - 1, [''])}
        disabled={options.length >= MAX_OPTIONS}
        className={cn(
          'inline-flex h-9 w-fit items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--blue-dim)] disabled:opacity-40',
        )}
      >
        <PlusIcon size={14} weight="bold" />
        {t('registrations.builder.add_option', 'Add option')}
      </button>
      {error ? <p className="text-[12px] font-medium text-[var(--danger-text)]">{error}</p> : null}
    </div>
  )
}
