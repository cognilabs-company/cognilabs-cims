import { Link } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'

/** Shown when RBAC has no "view" for the page's module. */
export function AccessDenied({ module }: { module: string }) {
  const { t } = useLocale()
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="max-w-[420px] text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--warning-dim)] text-[var(--warning-text)]">
          <ShieldOff size={24} />
        </span>
        <h1 className="mt-4 text-[18px] font-semibold text-[var(--foreground)]">{t('rbac.denied.title', 'No access to this page')}</h1>
        <p className="mt-1.5 text-[13.5px] text-[var(--muted)]">
          {t('rbac.denied.text', 'Your role does not include the “{{permission}}” permission. Ask an administrator to add it.', { permission: `${module} · view` })}
        </p>
        <Link to="/dashboard-redirect" className="mt-5 inline-flex h-10 items-center rounded-[11px] bg-[var(--primary)] px-4 text-[13.5px] font-semibold text-white hover:bg-[var(--primary-hover)]">
          {t('rbac.denied.home', 'Go to my home page')}
        </Link>
      </div>
    </div>
  )
}
