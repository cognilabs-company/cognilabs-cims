import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useLocale } from '../../app/hooks/useLocale'
import { cn } from '../../shared/lib/cn'
import { setThemePreference, useResolvedTheme, useThemePreference, type ThemePreference } from '../../shared/theme/theme'

/** Header button: shows the current theme (sun / moon) and opens Auto · Light · Dark. */
export function ThemeMenu({ pillClassName }: { pillClassName: string }) {
  const { t } = useLocale()
  const preference = useThemePreference()
  const resolved = useResolvedTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const options: Array<[ThemePreference, LucideIcon, string]> = [
    ['auto', Monitor, t('shell.theme.auto', 'Auto (system)')],
    ['light', Sun, t('shell.theme.light', 'Light')],
    ['dark', Moon, t('shell.theme.dark', 'Dark')],
  ]
  const current = options.find(([value]) => value === preference)?.[2] ?? ''
  const label = `${t('shell.theme.label', 'Appearance')}: ${current}`

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={cn(pillClassName, 'relative w-11 justify-center overflow-hidden text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none')}
      >
        <Sun size={18} className={cn('absolute transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]', resolved === 'dark' ? 'scale-50 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100')} />
        <Moon size={17} className={cn('absolute transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]', resolved === 'dark' ? 'scale-100 rotate-0 opacity-100' : 'scale-50 -rotate-90 opacity-0')} />
        {preference === 'auto' ? <span className="absolute right-[9px] bottom-[9px] h-1.5 w-1.5 rounded-full bg-[var(--primary)] ring-2 ring-[var(--surface)]" /> : null}
      </button>

      {open ? (
        <div role="menu" aria-label={t('shell.theme.label', 'Appearance')} className="modal-pop absolute top-[calc(100%+8px)] right-0 z-50 w-[210px] rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--elev-lg)]">
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--caption)] uppercase">{t('shell.theme.label', 'Appearance')}</p>
          {options.map(([value, Icon, text]) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === value}
              onClick={() => { setThemePreference(value); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                preference === value ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]',
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{text}</span>
              {preference === value ? <Check size={15} className="shrink-0" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
