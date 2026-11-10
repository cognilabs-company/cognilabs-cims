import { startTransition, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { BrandLoader } from '../../../shared/ui/loader'
import { useAuth } from '../hooks/useAuth'

export function DashboardRedirectPage() {
  const { t } = useLocale()
  const location = useLocation()
  const navigate = useNavigate()
  const { resolveDashboardPath, status } = useAuth()

  useEffect(() => {
    if (status !== 'authenticated') {
      return
    }

    let isActive = true

    async function redirectToDashboard() {
      const destination = await resolveDashboardPath()

      if (!isActive) {
        return
      }

      const currentLocation = `${location.pathname}${location.search}${location.hash}`

      if (destination === currentLocation) {
        return
      }

      startTransition(() => navigate(destination, { replace: true }))
    }

    void redirectToDashboard()

    return () => {
      isActive = false
    }
  }, [location.hash, location.pathname, location.search, navigate, resolveDashboardPath, status])

  return (
    <div role="status" aria-live="polite" className="grid min-h-[60vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLoader size={26} />
        <div>
          <p className="text-[13.5px] font-semibold text-[var(--foreground)]">{t('auth.redirect.title', 'Opening your workspace')}</p>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">{t('auth.redirect.description', 'Picking the right dashboard for your role…')}</p>
        </div>
      </div>
    </div>
  )
}
