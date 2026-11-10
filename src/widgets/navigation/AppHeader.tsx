import { startTransition, useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppShell } from '../../app/hooks/useAppShell'
import { useLocale } from '../../app/hooks/useLocale'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { env } from '../../shared/config/env'
import { navigationItems } from '../../shared/config/navigation'
import { type AppLocale, getIntlLocale, localeLabels } from '../../shared/i18n/translations'
import { useToast } from '../../shared/toast/useToast'
import { cn } from '../../shared/lib/cn'
import { hasPermission } from '../../shared/lib/permissions'
import { resolveMediaUrl } from '../../shared/lib/media-url'
import { openProfileDialog } from './profileEvents'
import { ThemeToggle } from './ThemeToggle'

function OutboundIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16h9a1.5 1.5 0 0 0 1.5-1.5V12" />
      <path d="M11 4h5v5M16 4l-7 7" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

const uzWeekdays = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
const uzMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

/** "Dushanba, 9-noyabr" / "Понедельник, 9 ноября" / "Monday, November 9" (uz is spelled out: browser ICU data is patchy). */
function formatToday(locale: AppLocale) {
  const date = new Date()
  const text = locale === 'uz'
    ? `${uzWeekdays[date.getDay()]}, ${date.getDate()}-${uzMonths[date.getMonth()]}`
    : date.toLocaleDateString(getIntlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function getInitials(name?: string | null, surname?: string | null) {
  const first = name?.trim()?.[0] ?? ''
  const second = surname?.trim()?.[0] ?? ''
  const initials = `${first}${second}`.toUpperCase()
  return initials || '—'
}

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { locale, setLocale, t } = useLocale()
  const { logout, user } = useAuth()
  const { showToast } = useToast()
  const { toggleSidebar } = useAppShell()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  )
  const isOutboundCrmRoute = location.pathname === '/outbound-crm' || location.pathname.startsWith('/outbound-crm/')
  const canUseCrm = hasPermission(user, 'crm')
  const canUseOutboundCrm = hasPermission(user, 'crm_outbound')
  const showCrmSwitch = isOutboundCrmRoute ? canUseCrm : canUseCrm && canUseOutboundCrm

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches)

    setIsMobileViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Phones only: on desktop the sidebar collapses into an icon rail with its own toggle.
  const shouldShowSidebarToggle = isMobileViewport

  function handleSidebarToggle() {
    toggleSidebar()
  }

  const currentItem =
    [...navigationItems]
      .sort((left, right) => right.to.length - left.to.length)
      .find((item) =>
        location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
      ) ?? null

  async function handleLogout() {
    setIsSubmitting(true)

    try {
      await logout()
      showToast({
        title: t('shell.logged_out'),
        description: t('shell.session_closed'),
        tone: 'success',
      })
      startTransition(() =>
        navigate('/auth/login', {
          replace: true,
          state: {
            statusMessage: t('shell.session_closed'),
          },
        }),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const routeLabel = currentItem ? t(`nav.${currentItem.to}.label`, currentItem.label) : env.appName

  const pill = 'inline-flex h-11 shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] shadow-[var(--pill-shadow)]'
  const profileImage = resolveMediaUrl(user?.profile_image) ?? user?.profile_image ?? null

  return (
    <header className="app-chrome relative z-30 flex h-[76px] shrink-0 items-center gap-3 px-4 pt-2 sm:px-7">
      {shouldShowSidebarToggle ? (
        <button
          type="button"
          onClick={handleSidebarToggle}
          aria-label={t('shell.toggle_navigation')}
          className={cn(pill, 'w-11 justify-center text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none')}
        >
          <Menu size={18} />
        </button>
      ) : null}

      {/* Greeting + where you are */}
      <div className="flex min-w-0 flex-col">
        <p className="hidden truncate text-[12.5px] font-medium text-[var(--muted)] sm:block">
          {formatToday(locale)} · {routeLabel}
        </p>
        <p className="truncate text-[19px] leading-7 font-bold tracking-[-0.02em] text-[var(--foreground)] sm:text-[22px]">
          {user?.name ? t('shell.greeting', 'Hi, {{name}}', { name: user.name }) : routeLabel}
        </p>
      </div>

      <div className="min-w-0 flex-1" />

      {showCrmSwitch ? (
        <button
          type="button"
          onClick={() => navigate(isOutboundCrmRoute ? '/crm' : '/outbound-crm')}
          aria-pressed={isOutboundCrmRoute}
          className={cn(
            pill,
            'hidden gap-2 px-4 text-[13.5px] font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none md:inline-flex',
            isOutboundCrmRoute ? 'border-transparent bg-[var(--blue-dim)] text-[var(--primary)] hover:bg-[var(--blue-soft)]' : 'text-[var(--foreground)] hover:bg-[var(--input-surface)]',
          )}
        >
          <OutboundIcon />
          {isOutboundCrmRoute ? t('outbound_crm.header.back_to_crm', 'Main CRM') : 'Outbound CRM'}
        </button>
      ) : null}

      <ThemeToggle pillClassName={pill} />

      <div className={cn(pill, 'hidden gap-0.5 p-1 sm:inline-flex')} role="group" aria-label={t('shell.language')}>
        {(Object.keys(localeLabels) as AppLocale[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setLocale(value)}
            aria-pressed={locale === value}
            aria-label={`${t('shell.language')}: ${localeLabels[value]}`}
            className={cn(
              'inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-[12.5px] transition-colors',
              locale === value
                ? 'bg-[var(--surface-inverse)] font-semibold text-white'
                : 'font-medium text-[var(--muted)] hover:text-[var(--foreground)]',
            )}
          >
            {localeLabels[value]}
          </button>
        ))}
      </div>

      {user ? (
        <button
          type="button"
          onClick={openProfileDialog}
          aria-label={t('profile.member_details')}
          className={cn(pill, 'gap-2.5 pr-1 pl-1 transition-colors hover:bg-[var(--input-surface)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none lg:pr-4')}
        >
          {profileImage ? (
            <img src={profileImage} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--surface-inverse)] text-[12px] font-bold text-white">
              {getInitials(user.name, user.surname)}
            </span>
          )}
          <span className="hidden min-w-0 flex-col text-left lg:flex">
            <span className="max-w-[160px] truncate text-[13px] leading-4 font-semibold text-[var(--foreground)]">
              {user.name} {user.surname}
            </span>
            {user.job_title?.trim() ? (
              <span className="max-w-[160px] truncate text-[11.5px] leading-4 text-[var(--muted)]">{user.job_title}</span>
            ) : null}
          </span>
        </button>
      ) : null}

      <button
        type="button"
        aria-label={t('shell.logout')}
        title={t('shell.logout')}
        className={cn(pill, 'w-11 justify-center text-[var(--muted-strong)] transition-colors hover:border-[var(--danger-border)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none disabled:opacity-50')}
        disabled={isSubmitting}
        onClick={() => void handleLogout()}
      >
        <LogoutIcon />
      </button>
    </header>
  )
}
