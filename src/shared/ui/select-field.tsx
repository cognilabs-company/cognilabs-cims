import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'

export type SelectFieldOption = {
  value: string
  label: string
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
  children?: ReactNode
}

type MenuPosition = {
  top: number
  left: number
  width: number
}

function normalizeOptionValue(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function getMenuPosition(trigger: HTMLButtonElement, optionCount: number, extraHeight = 0): MenuPosition {
  const rect = trigger.getBoundingClientRect()
  const menuHeight = Math.min(optionCount, 6) * 40 + 12 + extraHeight
  const openAbove = rect.bottom + menuHeight + 8 > window.innerHeight && rect.top - menuHeight - 8 >= 8
  const top = openAbove
    ? Math.max(8, rect.top - menuHeight - 8)
    : Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 8)

  return {
    top,
    left: Math.max(8, rect.left),
    width: rect.width,
  }
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
}: SelectFieldProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0, width: 0 })
  const isMultiple = multiple && Array.isArray(values)
  const selectedValues = isMultiple ? values : []

  const normalizedValue = normalizeOptionValue(value)
  const normalizedSelectedValues = new Set(selectedValues.map((item) => normalizeOptionValue(item)))
  const selectedOption =
    options.find((option) => option.value === value) ??
    options.find((option) =>
      normalizeOptionValue(option.value) === normalizedValue ||
      normalizeOptionValue(option.label) === normalizedValue,
    )
  const selectedOptions = isMultiple
    ? options.filter((option) => {
        const normalizedOptionValue = normalizeOptionValue(option.value)
        const normalizedOptionLabel = normalizeOptionValue(option.label)
        return normalizedSelectedValues.has(normalizedOptionValue) || normalizedSelectedValues.has(normalizedOptionLabel)
      })
    : []

  const normalizedSearchQuery = normalizeOptionValue(searchQuery)
  const visibleOptions = searchable && normalizedSearchQuery
    ? options.filter((option) => {
        const normalizedOptionLabel = normalizeOptionValue(option.label)
        const normalizedOptionValue = normalizeOptionValue(option.value)

        return normalizedOptionLabel.includes(normalizedSearchQuery) || normalizedOptionValue.includes(normalizedSearchQuery)
      })
    : options

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      return
    }

    const updatePosition = () => {
      if (!triggerRef.current) {
        return
      }

      setPosition(getMenuPosition(triggerRef.current, visibleOptions.length, isMultiple ? 48 : 0))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMultiple, isOpen, visibleOptions.length])

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  return (
    <>
      <button
        ref={triggerRef}
        data-ui-control="true"
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current)
          }
        }}
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-transparent bg-[var(--input-surface)] px-3.5 py-2 text-sm text-[var(--foreground)]',
          'outline-none',
          'transition-[border-color,box-shadow,background-color,transform] duration-150',
          'hover:bg-[var(--input-surface-hover)]',
          'focus-visible:border-[var(--primary)] focus-visible:bg-[var(--surface)]',
          'focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_rgba(43,89,255,0.12)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className={cn('truncate text-left', (isMultiple ? selectedOptions.length > 0 : Boolean(selectedOption)) ? 'text-[var(--foreground)]' : 'text-[var(--muted)]')}>
          {isMultiple
            ? (selectedOptions.length > 0
                ? (selectedOptions.length === 1
                    ? selectedOptions[0]?.label
                    : `${selectedOptions.length} selected`)
                : placeholder)
            : (selectedOption?.label ?? placeholder)}
        </span>
        <ChevronDown
          strokeWidth={1.8}
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-200',
            isOpen && 'rotate-180 text-[var(--foreground)]',
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[119]" onClick={() => setIsOpen(false)} aria-hidden="true" />
              <div
                data-ui-surface="true"
                className="fixed z-[120] max-h-72 overflow-y-auto rounded-[14px] bg-[var(--surface)] p-1.5 text-[var(--foreground)] shadow-[var(--elev-lg)] ring-1 ring-[var(--border)]"
                style={position}
                role="listbox"
                aria-multiselectable={isMultiple || undefined}
              >
                {searchable ? (
                  <div className="sticky top-0 z-10 bg-[var(--surface)] p-1 pb-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={searchPlaceholder}
                      className="w-full rounded-[11px] border border-transparent bg-[var(--input-surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-[border-color,box-shadow] focus-visible:border-[var(--primary)] focus-visible:shadow-[0_0_0_3px_rgba(43,89,255,0.12)]"
                    />
                  </div>
                ) : null}

                {visibleOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-[var(--muted)]">{emptyMessage}</div>
                ) : null}

                {visibleOptions.map((option) => {
                  const isSelected =
                    isMultiple
                      ? normalizedSelectedValues.has(normalizeOptionValue(option.value)) ||
                        normalizedSelectedValues.has(normalizeOptionValue(option.label))
                      : option.value === value ||
                        normalizeOptionValue(option.value) === normalizedValue ||
                        normalizeOptionValue(option.label) === normalizedValue

                  return (
                    <button
                      key={`${option.value}-${option.label}`}
                      data-ui-control="true"
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        if (isMultiple) {
                          if (!onValuesChange) {
                            return
                          }

                          const normalized = normalizeOptionValue(option.value)
                          const nextValues = normalizedSelectedValues.has(normalized)
                            ? selectedValues.filter((item) => normalizeOptionValue(item) !== normalized)
                            : [...selectedValues, option.value]

                          onValuesChange(nextValues)
                          return
                        }

                        setIsOpen(false)
                        onValueChange?.(option.value)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-[11px] px-3 py-2.5 text-sm font-medium transition-colors',
                        isSelected
                          ? 'border border-transparent bg-[var(--blue-dim)] text-[var(--blue-text)]'
                          : 'border border-transparent text-[var(--foreground)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            'inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--muted)]/40',
                            isSelected && 'bg-[var(--blue-text)]',
                          )}
                        />
                        <span className="truncate">{option.label}</span>
                      </span>
                      {isSelected ? (
                        <Check
                          strokeWidth={1.8}
                          className="h-4 w-4 shrink-0 text-[var(--blue-text)]"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  )
                })}

                {isMultiple ? (
                  <div className="sticky bottom-0 mt-1 flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] p-2">
                    <button
                      type="button"
                      className="rounded-full bg-[var(--input-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-strong)] transition hover:text-[var(--foreground)]"
                      onClick={() => {
                        onValuesChange?.([])
                        setIsOpen(false)
                      }}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-[var(--blue-dim)] px-2.5 py-1 text-xs font-semibold text-[var(--blue-text)] transition hover:bg-[var(--blue-soft)]"
                      onClick={() => setIsOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
