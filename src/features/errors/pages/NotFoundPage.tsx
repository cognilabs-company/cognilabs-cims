import { Link } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { Button } from '../../../shared/ui/button'

export function NotFoundPage() {
  const { t } = useLocale()

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-sm">
        <p className="ui-eyebrow text-blue-500">{t('errors.not_found.code', 'Error 404')}</p>
        <h1 className="ui-page-title mt-6 text-white">{t('errors.not_found.title', 'Page not found')}</h1>
        <Button asChild className="mt-10">
          <Link to="/">{t('errors.not_found.back', 'Back to Dashboard')}</Link>
        </Button>
      </div>
    </div>
  )
}
