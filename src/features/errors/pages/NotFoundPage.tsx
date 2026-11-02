import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'

export function NotFoundPage() {
  const { t } = useLocale()

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--app-canvas)] px-4 py-10">
      <div className="w-full max-w-lg rounded-[24px] bg-[var(--card)] p-[22px] text-center sm:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--blue-dim)] text-[var(--blue-text)]">
          <Compass strokeWidth={1.8} className="h-7 w-7" aria-hidden="true" />
        </span>

        <div className="mt-5 flex justify-center">
          <Badge variant="blue">{t('errors.not_found.code', 'Error 404')}</Badge>
        </div>

        <h1 className="ui-page-title mt-4 text-[var(--foreground)]">{t('errors.not_found.title', 'Page not found')}</h1>

        <p className="mx-auto mt-2.5 max-w-md text-sm text-[var(--muted)]">
          {t('errors.not_found.description', 'The requested route is not available. Please check the URL or navigate back to the dashboard.')}
        </p>

        <Button asChild className="mt-7">
          <Link to="/">{t('errors.not_found.back', 'Back to Dashboard')}</Link>
        </Button>
      </div>
    </div>
  )
}
