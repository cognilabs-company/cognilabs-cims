import { Link, Outlet, useLocation } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
import { translateCurrentLiteral } from '../../shared/i18n/translations'

const routeCopy = {
  '/auth/login': {
    eyebrow: 'Cognilabs CIMS',
    title: 'Secure access for your operations team.',
    description:
      'A focused login surface with animated depth, session-safe entry, and no extra register clutter in the header.',
    badge: 'Live access portal',
  },
  '/auth/forgot-password': {
    eyebrow: 'Recovery Flow',
    title: 'Recover credentials without leaving the secure zone.',
    description:
      'Password recovery stays inside the same protected auth surface so users can reset access without distraction.',
    badge: 'Reset support',
  },
  '/auth/reset-password': {
    eyebrow: 'Recovery Flow',
    title: 'Set a new password and get back into the workspace.',
    description:
      'Verification and password update are kept in one controlled flow with the same visual shell and security hints.',
    badge: 'Password reset',
  },
  '/auth/verify-email': {
    eyebrow: 'Verification Flow',
    title: 'Activate the account and move straight into the app.',
    description:
      'Email verification is presented in the same immersive auth environment, without tabs competing for attention.',
    badge: 'Email check',
  },
} as const

const previewStats = [
  { label: 'Session control', value: 'Realtime token guard' },
  { label: 'Permission model', value: 'Role-based access' },
  { label: 'Recovery', value: 'Verify and reset ready' },
  { label: 'Environment', value: 'Single workspace entry' },
]

export function AuthLayout() {
  const { locale } = useLocale()
  const location = useLocation()
  const copy = routeCopy[location.pathname as keyof typeof routeCopy] ?? routeCopy['/auth/login']
  const isLoginRoute = location.pathname === '/auth/login'
  const routeAnimationKey = `${location.pathname}${location.search}`
  const tr = (en: string, uz: string, ru: string) => {
    if (locale === 'ru') return ru
    if (locale === 'uz') return uz
    return en
  }
  const tl = (value: string) => translateCurrentLiteral(value)
  const badgeText = (() => {
    switch (copy.badge) {
      case 'Live access portal':
        return tr('Live access portal', 'Jonli kirish portali', 'Портал прямого доступа')
      case 'Reset support':
        return tr('Reset support', 'Tiklash yordami', 'Поддержка восстановления')
      case 'Password reset':
        return tr('Password reset', 'Parolni tiklash', 'Сброс пароля')
      default:
        return tl(copy.badge)
    }
  })()
  const panelEyebrow = isLoginRoute
    ? tl('Direct access')
    : tr('Support flow', 'Yordam oqimi', 'Сценарий поддержки')
  const panelDescription = isLoginRoute
    ? tr(
        'Use your work credentials to continue into the platform.',
        'Platformaga davom etish uchun ish akkauntingiz maʼlumotlaridan foydalaning.',
        'Используйте рабочие учётные данные, чтобы продолжить вход в платформу.',
      )
    : tr(
        'The extra header buttons are removed, but recovery and verification remain available here.',
        'Headerdagi qo‘shimcha tugmalar olib tashlangan, lekin tiklash va tasdiqlash shu yerda mavjud.',
        'Дополнительные кнопки в шапке убраны, но восстановление и подтверждение по-прежнему доступны здесь.',
      )

  void panelDescription

  return (
    <div className="auth-portal">
      <div className="auth-portal__glow auth-portal__glow--primary" />
      <div className="auth-portal__glow auth-portal__glow--secondary" />

      <div className="auth-stage">
        <section className="auth-visual-panel order-2 lg:order-1">
          <div key={`visual-${routeAnimationKey}`} className="auth-route-pane auth-route-pane--visual">
            <div className="relative z-10 max-w-xl">
              <p className="ui-eyebrow text-cyan-300/80">{tl(copy.eyebrow)}</p>
              <h1 className="ui-page-title mt-5 max-w-xl text-[var(--foreground)]">{tl(copy.title)}</h1>
            </div>

            <div className="auth-preview-card">
              <div className="auth-preview-card__grid" />

              <div className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="ui-eyebrow text-cyan-300/75">{badgeText}</p>
                    <h2 className="ui-section-title mt-3 max-w-sm text-[var(--foreground)]">
                      {tl('Permissions, sessions, and recovery stay inside one motion-driven surface.')}
                    </h2>
                  </div>
                  <span className="ui-card-label rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-1.5 text-cyan-200">
                    {tl('Online')}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {previewStats.map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                      <p className="ui-card-label text-[var(--muted)]">{tl(item.label)}</p>
                      <p className="ui-body mt-2 font-semibold text-[var(--foreground)]">
                        {item.value === 'Realtime token guard'
                          ? tr('Realtime token guard', 'Realtime token himoyasi', 'Защита токена в реальном времени')
                          : item.value === 'Role-based access'
                            ? tr('Role-based access', 'Rolga asoslangan kirish', 'Доступ по ролям')
                            : item.value === 'Verify and reset ready'
                              ? tr('Verify and reset ready', 'Tasdiqlash va tiklash tayyor', 'Подтверждение и сброс готовы')
                              : tr('Single workspace entry', 'Yagona workspace kirishi', 'Единая точка входа в рабочее пространство')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-form-panel order-1 lg:order-2">
          <div className="auth-form-wrap">
            <div key={`form-${routeAnimationKey}`} className="auth-route-pane auth-route-pane--form">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="ui-eyebrow text-slate-400">
                    {panelEyebrow}
                  </p>
                </div>

                {!isLoginRoute ? (
                  <Link
                    to="/auth/login"
                    className="ui-button-text rounded-full border border-[var(--border)] bg-[var(--muted-surface)] px-4 py-2 text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
                  >
                    {tl('Back to login')}
                  </Link>
                ) : null}
              </div>

              <Outlet />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
