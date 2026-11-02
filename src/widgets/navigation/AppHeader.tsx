import { ExternalLink, LogOut } from 'lucide-react'
import { startTransition, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppShell } from '../../app/hooks/useAppShell'
import { useLocale } from '../../app/hooks/useLocale'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { env } from '../../shared/config/env'
import { navigationItems } from '../../shared/config/navigation'
import { type AppLocale, localeLabels } from '../../shared/i18n/translations'
import { useToast } from '../../shared/toast/useToast'
import { cn } from '../../shared/lib/cn'
import { hasPermission } from '../../shared/lib/permissions'
import { NavGlyph } from './NavGlyph'
import { getNavigationGlyphName } from './navGlyphMap'

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
  const { isSidebarCollapsed, toggleSidebar, toggleSidebarCollapsed } = useAppShell()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  )
  const hideRouteContext = location.pathname.startsWith('/crm') || location.pathname.startsWith('/outbound-crm')
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

  const shouldShowSidebarToggle = isMobileViewport || isSidebarCollapsed

  function handleSidebarToggle() {
    if (isMobileViewport) {
      toggleSidebar()
      return
    }

    toggleSidebarCollapsed()
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

  return (
    <header className="relative z-10 flex h-[76px] shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-7">
      {shouldShowSidebarToggle ? (
        <button
          type="button"
          onClick={handleSidebarToggle}
          aria-label={t('shell.toggle_navigation')}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--input-surface)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none"
        >
          <span className="relative h-4 w-4">
            <span className="absolute top-1/2 left-0 h-0.5 w-4 -translate-y-[6px] rounded-full bg-current" />
            <span className="absolute top-1/2 left-0 h-0.5 w-4 -translate-y-1/2 rounded-full bg-current" />
            <span className="absolute top-1/2 left-0 h-0.5 w-4 translate-y-[5px] rounded-full bg-current" />
          </span>
        </button>
      ) : null}

      {!hideRouteContext ? (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[var(--blue-dim)] text-[var(--primary)]">
            <NavGlyph name={getNavigationGlyphName(currentItem?.to ?? location.pathname)} />
          </span>
          <p className="truncate text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
            {routeLabel}
          </p>
        </div>
      ) : null}

      <div className="min-w-0 flex-1" />

      {showCrmSwitch ? (
        <button
          type="button"
          onClick={() => navigate(isOutboundCrmRoute ? '/crm' : '/outbound-crm')}
          aria-pressed={isOutboundCrmRoute}
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-2 rounded-[14px] px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none',
            isOutboundCrmRoute
              ? 'bg-[var(--blue-dim)] text-[var(--primary)] hover:bg-[var(--blue-soft)]'
              : 'border border-[var(--border-hover)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--input-surface)]',
          )}
        >
          <ExternalLink strokeWidth={1.8} className="h-4 w-4" aria-hidden="true" />
          {isOutboundCrmRoute ? t('outbound_crm.header.back_to_crm', 'Main CRM') : 'Outbound CRM'}
        </button>
      ) : null}

      <div className="flex h-11 shrink-0 items-center gap-1 rounded-[14px] bg-[var(--input-surface)] p-1">
        {(Object.keys(localeLabels) as AppLocale[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setLocale(value)}
            aria-label={`${t('shell.language')}: ${localeLabels[value]}`}
            className={cn(
              'inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] px-2.5 text-[12.5px] transition-colors',
              locale === value
                ? 'bg-[var(--surface)] font-semibold text-[var(--foreground)] shadow-[var(--elev-seg)]'
                : 'font-medium text-[var(--muted)] hover:text-[var(--foreground)]',
            )}
          >
            {localeLabels[value]}
          </button>
        ))}
      </div>

      {user ? (
        <div className="flex shrink-0 items-center gap-2.5 pl-1">
          <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-[var(--blue-soft)] text-sm font-bold text-[var(--primary)]">
            {getInitials(user.name, user.surname)}
          </span>
          <div className="hidden min-w-0 flex-col lg:flex">
            <span className="truncate text-sm font-semibold text-[var(--foreground)]">
              {user.name} {user.surname}
            </span>
            {user.job_title?.trim() ? (
              <span className="truncate text-xs text-[var(--muted)]">{user.job_title}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={t('shell.logout')}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[var(--danger-strong)] transition-colors hover:bg-[var(--danger-dim)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none disabled:opacity-50"
        disabled={isSubmitting}
        onClick={() => void handleLogout()}
      >
        <LogOut strokeWidth={1.8} className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </header>
  )
}
