import { startTransition, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { authService } from '../../../shared/api/services/auth.service'
import { Button } from '../../../shared/ui/button'
import { AuthFeedback } from '../components/AuthFeedback'
import { AuthField } from '../components/AuthField'
import { AuthFormShell } from '../components/AuthFormShell'
import { PasswordField } from '../components/PasswordField'
import { extractFieldErrors, getErrorMessage } from '../lib/formErrors'
import { validateResetPassword } from '../lib/validators'

type ResetValues = {
  email: string
  code: string
  new_password: string
  confirm_password: string
}

export function ResetPasswordPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const initialMessage = useMemo(() => {
    const state = location.state as { statusMessage?: string } | null
    return state?.statusMessage ?? ''
  }, [location.state])

  const [values, setValues] = useState<ResetValues>({
    email: searchParams.get('email') ?? '',
    code: '',
    new_password: '',
    confirm_password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [statusMessage, setStatusMessage] = useState(initialMessage)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateResetPassword(values)
    setErrors(validationErrors)
    setSubmitError('')
    setStatusMessage('')

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await authService.resetPassword({
        email: values.email,
        code: values.code,
        new_password: values.new_password,
      })

      startTransition(() =>
        navigate('/auth/login', {
          replace: true,
            state: {
            statusMessage: response.message || t('auth.reset.success', 'Password successfully updated. You can now log in.'),
          },
        }),
      )
    } catch (error) {
      setErrors(extractFieldErrors(error))
      setSubmitError(getErrorMessage(error, t('auth.reset.failed', 'Failed to update password.')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthFormShell
      eyebrow={t('auth.recovery.eyebrow', 'Account Recovery')}
      title={t('auth.reset.title', 'Reset your password')}
      description={t('auth.reset.description', 'Enter the verification code from your email and set a new password.')}
      footerLinks={[{ label: t('auth.back_to_login', 'Back to login'), to: '/auth/login' }]}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-[var(--border)] bg-[var(--muted-surface)] p-1">
          <Link
            to="/auth/forgot-password"
            className="rounded-md px-3 py-1.5 text-center text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
          >
            {t('auth.forgot_password_tab', 'Forgot Password')}
          </Link>
          <span className="rounded-md bg-[var(--card)] px-3 py-1.5 text-center text-xs font-medium text-[var(--foreground)]">
            {t('auth.reset_password_tab', 'Reset Password')}
          </span>
        </div>

        <AuthFeedback tone="info" message={statusMessage} />
        <AuthFeedback tone="error" message={submitError} />

        <AuthField
          label={t('auth.email', 'Email')}
          name="email"
          type="email"
          placeholder="user@example.com"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
        />

        <AuthField
          label={t('auth.reset.code', 'Reset code')}
          name="code"
          placeholder={t('auth.reset.code_placeholder', 'Code from email')}
          value={values.code}
          error={errors.code}
          onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <PasswordField
            label={t('auth.reset.new_password', 'New password')}
            name="new_password"
            autoComplete="new-password"
            placeholder={t('auth.reset.new_password_placeholder', 'New password')}
            value={values.new_password}
            error={errors.new_password}
            onChange={(event) => setValues((current) => ({ ...current, new_password: event.target.value }))}
          />
          <PasswordField
            label={t('auth.reset.confirm_password', 'Confirm password')}
            name="confirm_password"
            autoComplete="new-password"
            placeholder={t('auth.reset.confirm_password_placeholder', 'Confirm password')}
            value={values.confirm_password}
            error={errors.confirm_password}
            onChange={(event) => setValues((current) => ({ ...current, confirm_password: event.target.value }))}
          />
        </div>

        <Button size="lg" type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? t('auth.reset.updating', 'Updating...') : t('auth.reset.button', 'Reset password')}
        </Button>
      </form>
    </AuthFormShell>
  )
}
