import type { ReactNode } from 'react'
import { ShieldCheckIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { localeLabels, type AppLocale } from '../../../shared/i18n/translations'
import { cn } from '../../../shared/lib/cn'
import { BrandMark, BrandWordmark } from '../../../shared/ui/brand-logo'

/** The public registration page frame: brand, language switch, a centred column — no app shell. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useLocale()

  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--app-canvas)] text-[var(--foreground)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(70%_100%_at_50%_0%,var(--blue-dim),transparent)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-[720px] items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
        <span className="flex min-w-0 items-center gap-2.5">
          <BrandMark size={36} />
          <span className="min-w-0 leading-tight">
            <BrandWordmark height={20} className="text-[var(--foreground)]" />
            <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">{t('registrations.public.tagline', 'Registration')}</span>
          </span>
        </span>
        <div role="group" aria-label={t('registrations.public.language', 'Language')} className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--elev-sm)]">
          {(['uz', 'ru', 'en'] as AppLocale[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLocale(value)}
              aria-pressed={locale === value}
              className={cn(
                'inline-flex h-8 min-w-9 items-center justify-center rounded-full px-2 text-[12px] transition-colors',
                locale === value ? 'bg-[var(--surface-inverse)] font-semibold text-[var(--on-inverse)]' : 'font-medium text-[var(--muted)] hover:text-[var(--foreground)]',
              )}
            >
              {localeLabels[value]}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pt-6 pb-10 sm:px-6 sm:pt-10">{children}</main>

      <footer className="relative z-10 mx-auto flex w-full max-w-[720px] flex-wrap items-center justify-between gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[11.5px] text-[var(--muted)] sm:px-6">
        <span>© Cognilabs</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheckIcon size={14} className="text-[var(--success-text)]" />{t('registrations.public.secure', 'Your data is sent over an encrypted connection')}</span>
      </footer>
    </div>
  )
}
