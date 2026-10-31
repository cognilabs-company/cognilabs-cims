import { startTransition, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppShell } from '../../app/hooks/useAppShell'
import { useLocale } from '../../app/hooks/useLocale'
import { useTheme } from '../../app/hooks/useTheme'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { env } from '../../shared/config/env'
import { navigationItems } from '../../shared/config/navigation'
import { type AppLocale, localeLabels } from '../../shared/i18n/translations'
import { useToast } from '../../shared/toast/useToast'
import { Badge } from '../../shared/ui/badge'
import { Button } from '../../shared/ui/button'
import { cn } from '../../shared/lib/cn'
import { hasPermission } from '../../shared/lib/permissions'
import { NavGlyph } from './NavGlyph'
import { getNavigationGlyphName } from './navGlyphMap'

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.22 4.22l1.06 1.06M14.72 14.72l1.06 1.06M4.22 15.78l1.06-1.06M14.72 5.28l1.06-1.06" />
    </svg>
  )
}

function OutboundIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16h9a1.5 1.5 0 0 0 1.5-1.5V12" />
      <path d="M11 4h5v5M16 4l-7 7" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M17.5 12A7.5 7.5 0 0 1 8 2.5a7.502 7.502 0 1 0 9.5 9.5Z" />
    </svg>
  )
}

const headerMetaChipClassName =
  'ui-button-text min-h-9 rounded-xl px-3 tracking-[0.04em] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]'

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { locale, setLocale, t } = useLocale()
  const { logout, user } = useAuth()
  const { showToast } = useToast()
  const { isSidebarCollapsed, toggleSidebar, toggleSidebarCollapsed } = useAppShell()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 960px)').matches : false,
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

    const mediaQuery = window.matchMedia('(max-width: 960px)')
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

  const { theme, toggleTheme } = useTheme()
  const routeLabel = currentItem ? t(`nav.${currentItem.to}.label`, currentItem.label) : env.appName

  return (
    <header className="relative z-10 border-b border-(--border) bg-(--shell-header-bg) px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {shouldShowSidebarToggle ? (
            <button
              type="button"
              onClick={handleSidebarToggle}
              aria-label={t('shell.toggle_navigation')}
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-(--border) bg-(--muted-surface) text-(--foreground) transition-colors hover:border-(--border-hover) hover:bg-(--accent-soft) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35"
            >
              <span className="relative h-4 w-4">
                <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-[6px] rounded-full bg-current" />
                <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 rounded-full bg-current" />
                <span className="absolute left-0 top-1/2 h-0.5 w-4 translate-y-[5px] rounded-full bg-current" />
              </span>
            </button>
          ) : null}
          <div className="min-w-0">
            {!hideRouteContext ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-500 shadow-sm">
                  <NavGlyph name={getNavigationGlyphName(currentItem?.to ?? location.pathname)} />
                </div>
                <div className="min-w-0">
                  <p className="ui-body truncate font-bold text-(--foreground) tracking-tight">
                    {routeLabel}
                  </p>
                </div>
              </div>
            ) : null}
            {user ? (
              <p className={cn('ui-helper font-semibold text-(--muted)', !hideRouteContext && 'mt-1.5')}>
                {user.name} {user.surname}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full md:w-auto md:justify-end">
          <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-(--border) bg-(--accent-soft) p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:w-auto md:flex-nowrap">
            {showCrmSwitch ? (
              <button
                type="button"
                onClick={() => navigate(isOutboundCrmRoute ? '/crm' : '/outbound-crm')}
                aria-pressed={isOutboundCrmRoute}
                className={cn(
                  'ui-button-text inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35',
                  isOutboundCrmRoute
                    ? 'border-(--blue-border) bg-(--blue-soft) text-(--blue-text) hover:border-(--border-hover)'
                    : 'border-(--border) bg-(--muted-surface) text-(--foreground) hover:border-(--blue-border) hover:bg-(--blue-soft) hover:text-(--blue-text)',
                )}
              >
                <OutboundIcon />
                {isOutboundCrmRoute ? t('outbound_crm.header.back_to_crm', 'Main CRM') : 'Outbound CRM'}
              </button>
            ) : null}
            {user?.job_title?.trim() ? (
              <Badge className={cn(headerMetaChipClassName, 'border-(--border) bg-(--muted-surface) text-(--muted-strong)')}>
                {user.job_title}
              </Badge>
            ) : null}
            <div className="flex items-center rounded-xl border border-(--border) bg-(--muted-surface) p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              {(Object.keys(localeLabels) as AppLocale[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLocale(value)}
                  aria-label={`${t('shell.language')}: ${localeLabels[value]}`}
                  className={cn(
                    'ui-button-text inline-flex min-h-8 min-w-9 items-center justify-center rounded-lg px-2 tracking-[0.08em] transition-colors',
                    locale === value
                      ? 'bg-white text-black shadow-[0_1px_2px_rgba(0,0,0,0.20)]'
                      : 'text-(--muted) hover:bg-(--accent-soft) hover:text-(--foreground)',
                  )}
                >
                  {localeLabels[value]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('shell.switch_to_light') : t('shell.switch_to_dark')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--border) bg-(--muted-surface) text-(--muted) transition-colors hover:bg-(--accent-soft) hover:text-(--foreground)"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <Button
              variant="secondary"
              size="md"
              className="min-h-10 rounded-xl border-(--border) bg-(--muted-surface) px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
              disabled={isSubmitting}
              onClick={() => void handleLogout()}
            >
              {isSubmitting ? t('shell.logging_out') : t('shell.logout')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
