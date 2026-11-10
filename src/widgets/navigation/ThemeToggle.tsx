import { Moon, Sun } from 'lucide-react'
import { useLocale } from '../../app/hooks/useLocale'
import { cn } from '../../shared/lib/cn'
import { setThemePreference, useResolvedTheme } from '../../shared/theme/theme'

/**
 * Header button: one click switches light ↔ dark (sun / moon swap with a small turn).
 * Until the first click the app follows the system appearance; after that the choice is remembered.
 */
export function ThemeToggle({ pillClassName }: { pillClassName: string }) {
  const { t } = useLocale()
  const resolved = useResolvedTheme()
  const dark = resolved === 'dark'
  const label = dark ? t('shell.theme.to_light', 'Switch to light mode') : t('shell.theme.to_dark', 'Switch to dark mode')

  return (
    <button
      type="button"
      onClick={() => setThemePreference(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      aria-pressed={dark}
      className={cn(pillClassName, 'relative w-11 justify-center overflow-hidden text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none')}
    >
      <Sun size={18} className={cn('absolute transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]', dark ? 'scale-50 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100')} />
      <Moon size={17} className={cn('absolute transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]', dark ? 'scale-100 rotate-0 opacity-100' : 'scale-50 -rotate-90 opacity-0')} />
    </button>
  )
}
