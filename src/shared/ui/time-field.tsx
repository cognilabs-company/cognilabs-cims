import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock3, X } from 'lucide-react'
import { translateCurrent } from '../i18n/translations'
import { cn } from '../lib/cn'
import { anchorPopover, type PopoverStyle } from './popover-position'

const pad = (value: number) => String(value).padStart(2, '0')

function parse(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null
}

/** Two scrolling columns (hours · minutes). Minutes step by 5; an off-step current minute is kept in the list. */
export function TimeColumns({ value, onChange, minuteStep = 5, className }: { value: string; onChange: (value: string) => void; minuteStep?: number; className?: string }) {
  const current = parse(value)
  const hourRef = useRef<HTMLDivElement>(null)
  const minuteRef = useRef<HTMLDivElement>(null)
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, index) => index * minuteStep)
  if (current && !minutes.includes(current.minute)) minutes.push(current.minute)
  minutes.sort((a, b) => a - b)

  // Centre the selected values when the columns appear
  useEffect(() => {
    for (const column of [hourRef.current, minuteRef.current]) {
      const selected = column?.querySelector<HTMLElement>('[aria-selected="true"]')
      if (column && selected) column.scrollTop = selected.offsetTop - column.clientHeight / 2 + selected.clientHeight / 2
    }
  }, [])

  const pick = (hour: number, minute: number) => onChange(`${pad(hour)}:${pad(minute)}`)
  const item = (selected: boolean) => cn(
    'mx-1 grid h-8 shrink-0 place-items-center rounded-[8px] text-[13px] tabular-nums transition-colors',
    selected ? 'bg-[var(--primary)] font-semibold text-white' : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]',
  )

  return (
    <div className={cn('grid min-h-0 grid-cols-2 divide-x divide-[var(--border)]', className)}>
      <div ref={hourRef} role="listbox" aria-label={translateCurrent('picker.hour', 'Hour')} className="no-scrollbar flex min-h-0 flex-col gap-0.5 overflow-y-auto py-1">
        {Array.from({ length: 24 }, (_, hour) => (
          <button key={hour} type="button" role="option" aria-selected={current?.hour === hour} onClick={() => pick(hour, current?.minute ?? 0)} className={item(current?.hour === hour)}>{pad(hour)}</button>
        ))}
      </div>
      <div ref={minuteRef} role="listbox" aria-label={translateCurrent('picker.minute', 'Minute')} className="no-scrollbar flex min-h-0 flex-col gap-0.5 overflow-y-auto py-1">
        {minutes.map((minute) => (
          <button key={minute} type="button" role="option" aria-selected={current?.minute === minute} onClick={() => pick(current?.hour ?? 9, minute)} className={item(current?.minute === minute)}>{pad(minute)}</button>
        ))}
      </div>
    </div>
  )
}

type TimeFieldProps = {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  id?: string
  className?: string
  placeholder?: string
  /** Shows a clear (×) button when there is a value. */
  clearable?: boolean
  'aria-label'?: string
}

/** Time picker (HH:MM) in the app style — replaces the browser's <input type="time">. */
export function TimeField({ value, onValueChange, disabled, id, className, placeholder = '--:--', clearable = false, 'aria-label': ariaLabel }: TimeFieldProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [style, setStyle] = useState<PopoverStyle | null>(null)
  const open = style !== null
  const close = (focus = false) => { setStyle(null); if (focus) triggerRef.current?.focus() }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setStyle(null)
      triggerRef.current?.focus()
    }
    const onMove = () => { if (triggerRef.current) setStyle(anchorPopover(triggerRef.current, 248, 168)) }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        data-ui-control="true"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : triggerRef.current && setStyle(anchorPopover(triggerRef.current, 248, 168)))}
        className={cn('control-field flex min-h-10 w-full min-w-0 items-center gap-2 rounded-[10px] px-3 text-left text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50', className)}
      >
        <Clock3 size={15} className="shrink-0 text-[var(--muted)]" />
        <span className={cn('min-w-0 flex-1 truncate tabular-nums', !parse(value) && 'text-[var(--caption)]')}>{parse(value) ? value.slice(0, 5) : placeholder}</span>
        {clearable && value && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={translateCurrent('common.clear', 'Clear')}
            onClick={(event) => { event.stopPropagation(); onValueChange('') }}
            className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]"
          >
            <X size={13} />
          </span>
        ) : null}
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div data-floating-layer="true">
          <div className="fixed inset-0 z-[179]" onPointerDown={() => close()} aria-hidden="true" />
          <div role="dialog" aria-label={translateCurrent('picker.choose_time', 'Choose time')} className="popover-panel fixed z-[180] flex h-[248px] flex-col overflow-hidden" style={style ?? undefined}>
            <TimeColumns value={value} onChange={onValueChange} className="flex-1" />
            <div className="flex shrink-0 justify-end border-t border-[var(--border)] p-1.5">
              <button type="button" onClick={() => close(true)} className="rounded-[7px] bg-[var(--primary)] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[var(--primary-hover)]">{translateCurrent('common.done', 'Done')}</button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
