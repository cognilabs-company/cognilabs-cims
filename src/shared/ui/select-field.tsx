import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, type LucideIcon } from 'lucide-react'
import { translateCurrent } from '../i18n/translations'
import { cn } from '../lib/cn'

export type SelectFieldOption = {
  value: string
  label: string
  /** Optional leading icon or colour dot. */
  icon?: LucideIcon
  color?: string
  /** Small grey text under / beside the label. */
  hint?: string
}

type SelectFieldProps = {
  value: string
  values?: string[]
  options: SelectFieldOption[]
  onValueChange?: (value: string) => void
  onValuesChange?: (values: string[]) => void
  multiple?: boolean
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  /** Icon shown inside the trigger, before the value. */
  leadingIcon?: ReactNode
  id?: string
  'aria-label'?: string
  children?: ReactNode
}

type MenuPosition = CSSProperties & { '--popover-origin'?: string }

const OPTION_HEIGHT = 36

function normalizeOptionValue(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** Opens below the trigger, or above it when there isn't room. Anchors by bottom when above, so the real height never matters. */
function menuPosition(trigger: HTMLElement, optionCount: number, extra: number): MenuPosition {
  const rect = trigger.getBoundingClientRect()
  const estimate = Math.min(optionCount, 7) * OPTION_HEIGHT + 12 + extra
  const spaceBelow = window.innerHeight - rect.bottom
  const above = spaceBelow < estimate + 12 && rect.top > spaceBelow
  const width = Math.max(rect.width, 200)
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
  return above
    ? { left, width, bottom: window.innerHeight - rect.top + 6, maxHeight: Math.min(320, rect.top - 16), '--popover-origin': 'bottom center' }
    : { left, width, top: rect.bottom + 6, maxHeight: Math.min(320, spaceBelow - 16), '--popover-origin': 'top center' }
}

function OptionMark({ option }: { option: SelectFieldOption }) {
  if (option.icon) {
    const Icon = option.icon
    return <Icon size={15} className="shrink-0" style={option.color ? { color: option.color } : undefined} />
  }
  if (option.color) return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: option.color }} />
  return null
}

export function SelectField({
  value,
  values,
  options,
  onValueChange,
  onValuesChange,
  multiple = false,
  placeholder = 'Select option',
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found',
  className,
  disabled = false,
  size = 'md',
  leadingIcon,
  id,
  'aria-label': ariaLabel,
}: SelectFieldProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const isOpen = position !== null
  const isMultiple = multiple && Array.isArray(values)
  const selectedValues = isMultiple ? values : []

  const normalizedValue = normalizeOptionValue(value)
  const normalizedSelectedValues = new Set(selectedValues.map((item) => normalizeOptionValue(item)))
  const isOptionSelected = (option: SelectFieldOption) => isMultiple
    ? normalizedSelectedValues.has(normalizeOptionValue(option.value)) || normalizedSelectedValues.has(normalizeOptionValue(option.label))
    : option.value === value || normalizeOptionValue(option.value) === normalizedValue || (normalizedValue !== '' && normalizeOptionValue(option.label) === normalizedValue)

  const selectedOption = isMultiple ? undefined : options.find((option) => option.value === value) ?? options.find(isOptionSelected)
  const selectedOptions = isMultiple ? options.filter(isOptionSelected) : []

  const query = normalizeOptionValue(searchQuery)
  const visibleOptions = searchable && query
    ? options.filter((option) => normalizeOptionValue(option.label).includes(query) || normalizeOptionValue(option.value).includes(query))
    : options

  const extraHeight = (searchable ? 48 : 0) + (isMultiple ? 48 : 0)

  function open() {
    if (disabled || !triggerRef.current) return
    setSearchQuery('')
    setActiveIndex(Math.max(0, options.findIndex(isOptionSelected)))
    setPosition(menuPosition(triggerRef.current, options.length, extraHeight))
  }

  function close(focusTrigger = false) {
    setPosition(null)
    setSearchQuery('')
    if (focusTrigger) triggerRef.current?.focus()
  }

  function choose(option: SelectFieldOption) {
    if (isMultiple) {
      if (!onValuesChange) return
      const normalized = normalizeOptionValue(option.value)
      onValuesChange(normalizedSelectedValues.has(normalized)
        ? selectedValues.filter((item) => normalizeOptionValue(item) !== normalized)
        : [...selectedValues, option.value])
      return
    }
    close(true)
    onValueChange?.(option.value)
  }

  // Follow the trigger while the page scrolls / resizes; close on Escape
  useEffect(() => {
    if (!isOpen) return
    const update = () => { if (triggerRef.current) setPosition(menuPosition(triggerRef.current, options.length, extraHeight)) }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    if (searchable) searchRef.current?.focus()
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [extraHeight, isOpen, options.length, searchable])

  // Keep the highlighted option in view
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, isOpen])

  function onKeyDown(event: ReactKeyboardEvent) {
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); open() }
      return
    }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
    if (event.key === 'Tab') { close(); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(visibleOptions.length - 1, index + 1)); return }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); return }
    if (event.key === 'Enter') {
      event.preventDefault()
      const option = visibleOptions[activeIndex]
      if (option) choose(option)
    }
  }

  const triggerText = isMultiple
    ? (selectedOptions.length === 0 ? placeholder : selectedOptions.length === 1 ? selectedOptions[0]?.label : translateCurrent('picker.selected_count', '{{count}} selected', { count: selectedOptions.length }))
    : (selectedOption?.label ?? placeholder)
  const hasValue = isMultiple ? selectedOptions.length > 0 : Boolean(selectedOption && selectedOption.value !== '')

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        data-ui-control="true"
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={onKeyDown}
        className={cn(
          'control-field flex w-full min-w-0 items-center gap-2 text-left',
          size === 'sm' ? 'h-8 rounded-[8px] px-2.5 text-[12.5px]' : 'min-h-10 rounded-[10px] px-3 text-[13.5px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        {leadingIcon ? <span className="shrink-0 text-[var(--muted)]">{leadingIcon}</span> : null}
        {!isMultiple && selectedOption && (selectedOption.icon || selectedOption.color) ? <OptionMark option={selectedOption} /> : null}
        <span className={cn('min-w-0 flex-1 truncate', hasValue ? 'text-[var(--foreground)]' : 'text-[var(--caption)]')}>{triggerText}</span>
        <ChevronDown size={size === 'sm' ? 14 : 16} className={cn('shrink-0 text-[var(--muted)] transition-transform duration-200', isOpen && 'rotate-180 text-[var(--primary)]')} />
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div data-floating-layer="true">
              <div className="fixed inset-0 z-[119]" onPointerDown={() => close()} aria-hidden="true" />
              <div
                data-ui-surface="true"
                className="popover-panel fixed z-[120] flex flex-col overflow-hidden"
                style={position ?? undefined}
                onKeyDown={onKeyDown}
              >
                {searchable ? (
                  <label className="relative flex shrink-0 items-center border-b border-[var(--border)]">
                    <Search size={14} className="pointer-events-none absolute left-3 text-[var(--muted)]" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={searchQuery}
                      onChange={(event) => { setSearchQuery(event.target.value); setActiveIndex(0) }}
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      className="h-10 w-full bg-transparent pr-3 pl-8 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--caption)]"
                    />
                  </label>
                ) : null}

                <div ref={listRef} role="listbox" aria-multiselectable={isMultiple || undefined} className="min-h-0 flex-1 overflow-y-auto p-1">
                  {visibleOptions.length === 0 ? (
                    <p className="px-3 py-3 text-center text-[12.5px] text-[var(--muted)]">{emptyMessage}</p>
                  ) : visibleOptions.map((option, index) => {
                    const selected = isOptionSelected(option)
                    const active = index === activeIndex
                    return (
                      <button
                        key={`${option.value}-${option.label}`}
                        data-index={index}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(option)}
                        className={cn(
                          'flex min-h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] transition-colors',
                          active ? 'bg-[var(--input-surface)]' : 'bg-transparent',
                          selected ? 'font-semibold text-[var(--foreground)]' : 'font-medium text-[var(--muted-strong)]',
                        )}
                      >
                        {isMultiple ? (
                          <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border transition-colors', selected ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--control-border)]')}>
                            {selected ? <Check size={11} strokeWidth={3} /> : null}
                          </span>
                        ) : null}
                        <OptionMark option={option} />
                        <span className="min-w-0 flex-1 truncate">
                          {option.label}
                          {option.hint ? <span className="ml-1.5 text-[11.5px] font-normal text-[var(--muted)]">{option.hint}</span> : null}
                        </span>
                        {!isMultiple && selected ? <Check size={15} className="shrink-0 text-[var(--primary)]" strokeWidth={2.4} /> : null}
                      </button>
                    )
                  })}
                </div>

                {isMultiple ? (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border)] px-2 py-1.5">
                    <button type="button" onClick={() => onValuesChange?.([])} className="rounded-[7px] px-2 py-1 text-[12px] font-semibold text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
                      {translateCurrent('common.clear', 'Clear')}
                    </button>
                    <button type="button" onClick={() => close(true)} className="rounded-[7px] bg-[var(--primary)] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-[var(--primary-hover)]">
                      {translateCurrent('common.done', 'Done')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
