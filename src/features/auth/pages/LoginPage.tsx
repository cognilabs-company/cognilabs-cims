import { startTransition, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2, LockKeyhole, LogIn, Mail, TriangleAlert } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { authService } from '../../../shared/api/services/auth.service'
import { Button } from '../../../shared/ui/button'
import { AuthFeedback } from '../components/AuthFeedback'
import { AuthField } from '../components/AuthField'
import { AuthFormShell } from '../components/AuthFormShell'
import { PasswordField } from '../components/PasswordField'
import { useAuth } from '../hooks/useAuth'
import { extractFieldErrors, getErrorMessage } from '../lib/formErrors'
import { validateLogin } from '../lib/validators'

type LoginValues = {
  username: string
  password: string
}

export function LoginPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const { acceptTokens } = useAuth()
  const initialMessage = useMemo(() => {
    const state = location.state as { statusMessage?: string } | null
    return state?.statusMessage ?? ''
  }, [location.state])

  const [values, setValues] = useState<LoginValues>({
    username: '',
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [statusMessage, setStatusMessage] = useState(initialMessage)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const trackCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState('CapsLock'))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateLogin(values)
    setErrors(validationErrors)
    setSubmitError('')
    setStatusMessage('')

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await authService.login(values)
      await acceptTokens(response)

      startTransition(() => navigate('/', { replace: true }))
    } catch (error) {
      setErrors(extractFieldErrors(error))
      setSubmitError(getErrorMessage(error, t('auth.login_failed', 'Login failed. Check your email or password and try again.')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthFormShell
      eyebrow={t('auth.login.eyebrow', 'Login')}
      title={t('auth.login.title', 'Login to your account')}
      description={t('auth.login.description', 'Enter your email below to login to your account.')}
      icon={<LogIn size={22} strokeWidth={2} />}
      footerLinks={[]}
    >
      <form className="grid gap-[18px]" onSubmit={handleSubmit}>
        <AuthFeedback tone="success" message={statusMessage} />
        <AuthFeedback tone="error" message={submitError} />

        <AuthField
          label={t('auth.email', 'Email')}
          name="username"
          type="email"
          autoComplete="email"
          placeholder="user@example.com"
          leadingIcon={<Mail size={17} />}
          className="min-h-12 rounded-[13px] text-[14.5px]"
          value={values.username}
          error={errors.username}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              username: event.target.value,
            }))
          }
        />

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="ui-input-label">{t('auth.password', 'Password')}</span>
            <Link
              className="text-[12.5px] font-semibold text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
              to="/auth/forgot-password"
            >
              {t('auth.forgot_password', 'Forgot password?')}
            </Link>
          </div>

          <PasswordField
            label=""
            name="password"
            autoComplete="current-password"
            placeholder={t('auth.password.enter', 'Enter your password')}
            leadingIcon={<LockKeyhole size={17} />}
            className="min-h-12 rounded-[13px] text-[14.5px]"
            onKeyUp={trackCaps}
            onKeyDown={trackCaps}
            onBlur={() => setCapsLock(false)}
            value={values.password}
            error={errors.password}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
        </div>

        {capsLock ? (
          <p className="-mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--warning-text)]">
            <TriangleAlert size={14} /> {t('auth.caps_lock', 'Caps Lock is on')}
          </p>
        ) : null}

        <Button size="lg" type="submit" disabled={isSubmitting} className="group/submit mt-1 h-12 w-full rounded-[13px] text-[15px] font-semibold shadow-[var(--elev-primary)]">
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
          {isSubmitting ? t('auth.signing_in', 'Signing in...') : t('auth.login_button', 'Login')}
          {!isSubmitting ? <ArrowRight size={18} className="transition-transform duration-200 group-hover/submit:translate-x-1" /> : null}
        </Button>

        <div className="border-t border-[var(--border)] pt-4 text-center text-[12.5px] text-[var(--muted)]">
          {t('auth.verify_prompt', 'Email not verified?')}{' '}
          <Link
            className="font-semibold text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
            to="/auth/verify-email"
          >
            {t('auth.verify_email', 'Verify email')}
          </Link>
        </div>
      </form>
    </AuthFormShell>
  )
}
