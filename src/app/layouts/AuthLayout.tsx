import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Bot, KanbanSquare, PhoneCall, ShieldCheck, UsersRound, type LucideIcon } from 'lucide-react'
import { useLocale } from '../hooks/useLocale'
import { type AppLocale, localeLabels } from '../../shared/i18n/translations'
import { cn } from '../../shared/lib/cn'
import { ThemeMenu } from '../../widgets/navigation/ThemeMenu'

const pill = 'inline-flex h-10 shrink-0 items-center rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] backdrop-blur-md'

/** The rotating word in the headline ("one workspace for … customers / calls / projects …"). */
function RotatingWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % words.length), 2400)
    return () => window.clearInterval(timer)
  }, [words.length])
  return (
    <span className="relative inline-block">
      <span key={index} className="login-word login-gradient-text">{words[index % words.length]}</span>
    </span>
  )
}

export function AuthLayout() {
  const { t, locale, setLocale } = useLocale()
  const location = useLocation()

  const words = [
    t('auth.hero.word_customers', 'customers'),
    t('auth.hero.word_calls', 'calls'),
    t('auth.hero.word_projects', 'projects'),
    t('auth.hero.word_team', 'your team'),
    t('auth.hero.word_ai', 'AI assistants'),
  ]
  const modules: Array<[LucideIcon, string, string, string]> = [
    [UsersRound, t('auth.hero.module_crm', 'CRM'), t('auth.hero.module_crm_hint', 'Leads & customers'), '#2B59FF'],
    [PhoneCall, t('auth.hero.module_calls', 'Calls'), t('auth.hero.module_calls_hint', 'Browser telephony'), '#16A34A'],
    [KanbanSquare, t('auth.hero.module_projects', 'Projects'), t('auth.hero.module_projects_hint', 'Boards & tasks'), '#F59E0B'],
    [Bot, t('auth.hero.module_ai', 'Cognilabs AI'), t('auth.hero.module_ai_hint', 'Chats & automation'), '#8B5CF6'],
  ]

  return (
    <div className="login-page">
      <div className="login-aurora" aria-hidden="true"><span /><span /><span /></div>
      <div className="login-dots" aria-hidden="true" />

      {/* top bar */}
      <header className="relative z-20 flex items-center justify-between gap-3 px-5 pt-5 sm:px-8 sm:pt-6">
        <Link to="/auth/login" className="flex items-center gap-2.5" aria-label="Cognilabs CIMS">
          <span className="grid h-10 w-10 place-items-center rounded-[12px] text-[18px] font-bold text-white shadow-[0_10px_24px_-12px_var(--blue-glow)]" style={{ background: 'var(--primary-gradient)' }}>C</span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-[-0.02em] text-[var(--foreground)]">Cognilabs CIMS</span>
            <span className="block text-[11.5px] text-[var(--muted)]">{t('auth.hero.tagline', 'Company workspace')}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeMenu pillClassName={pill} />
          <div className={cn(pill, 'gap-0.5 p-1')} role="group" aria-label={t('shell.language')}>
            {(Object.keys(localeLabels) as AppLocale[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLocale(value)}
                aria-pressed={locale === value}
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[12px] transition-colors',
                  locale === value ? 'bg-[var(--surface-inverse)] font-semibold text-white' : 'font-medium text-[var(--muted)] hover:text-[var(--foreground)]',
                )}
              >
                {localeLabels[value]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1180px] flex-1 items-center gap-14 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* hero */}
        <section className="login-hero hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--muted-strong)] backdrop-blur-md">
            <span className="status-live h-2 w-2 rounded-full bg-[var(--success)] text-[var(--success)]" />
            {t('auth.hero.badge', 'One workspace for the whole company')}
          </span>
          <h1 data-i18n-skip="true" className="mt-6 max-w-[560px] text-[52px] leading-[1.05] font-bold tracking-[-0.045em] text-[var(--foreground)]">
            {t('auth.hero.title', 'All in one place:')}
            <br />
            <RotatingWord words={words} />
          </h1>
          <p className="mt-5 max-w-[480px] text-[15.5px] leading-relaxed text-[var(--muted-strong)]">
            {t('auth.hero.subtitle', 'CRM, calls, projects, attendance and AI assistants — sign in and pick up where you left off.')}
          </p>
          <div className="mt-9 grid max-w-[560px] grid-cols-2 gap-3">
            {modules.map(([Icon, title, hint, color]) => (
              <div key={title} className="login-module flex items-center gap-3 rounded-[16px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] p-3 backdrop-blur-md">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
                  <Icon size={19} strokeWidth={2.1} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-[var(--foreground)]">{title}</span>
                  <span className="block truncate text-[12px] text-[var(--muted)]">{hint}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* form card */}
        <section className="mx-auto w-full max-w-[440px]">
          <div key={location.pathname} className="login-card p-6 sm:p-8">
            <Outlet />
          </div>
        </section>
      </main>

      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-5 pb-5 text-[12px] text-[var(--muted)] sm:px-8 sm:pb-6">
        <span>© {new Date().getFullYear()} Cognilabs</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-[var(--success)]" />{t('auth.footer.secure', 'Encrypted connection')}</span>
      </footer>
    </div>
  )
}
