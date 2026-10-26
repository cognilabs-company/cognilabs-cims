import { startTransition, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
      footerLinks={[]}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <AuthFeedback tone="success" message={statusMessage} />
        <AuthFeedback tone="error" message={submitError} />

        <AuthField
          label={t('auth.email', 'Email')}
          name="username"
          type="email"
          autoComplete="email"
          placeholder="user@example.com"
          value={values.username}
          error={errors.username}
          className="min-h-11"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              username: event.target.value,
            }))
          }
        />

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-[var(--foreground)] tracking-tight">{t('auth.password', 'Password')}</span>
            <Link className="text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]" to="/auth/forgot-password">
              {t('auth.forgot_password', 'Forgot password?')}
            </Link>
          </div>

          <PasswordField
            label=""
            name="password"
            autoComplete="current-password"
            placeholder={t('auth.password.enter', 'Enter your password')}
            value={values.password}
            error={errors.password}
            className="min-h-11"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
        </div>

        <Button size="lg" type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? t('auth.signing_in', 'Signing in...') : t('auth.login_button', 'Login')}
        </Button>

        <div className="text-center text-xs text-[var(--muted)]">
          {t('auth.verify_prompt', 'Email not verified?')}{' '}
          <Link className="underline underline-offset-4 transition hover:text-[var(--foreground)]" to="/auth/verify-email">
            {t('auth.verify_email', 'Verify email')}
          </Link>
        </div>
      </form>
    </AuthFormShell>
  )
}
