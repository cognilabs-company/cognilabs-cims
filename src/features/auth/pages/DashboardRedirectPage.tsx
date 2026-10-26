import { startTransition, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { Card } from '../../../shared/ui/card'
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
    <div className="grid min-h-[55vh] place-items-center">
      <Card className="max-w-xl p-10 text-center border-none bg-transparent">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-500">{t('auth.redirect.eyebrow', 'Redirecting')}</p>
        <h1 className="ui-page-title mt-6 text-white">{t('auth.redirect.title', 'Accessing Dashboard')}</h1>
        <p className="mt-6 text-sm font-medium leading-relaxed text-zinc-500">
          {t('auth.redirect.description', 'We are determining the best entry point for your account role. One moment...')}
        </p>
      </Card>
    </div>
  )
}
