import { startTransition, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import { authService } from '../../../shared/api/services/auth.service'
import { Button } from '../../../shared/ui/button'
import { AuthFeedback } from '../components/AuthFeedback'
import { AuthField } from '../components/AuthField'
import { AuthFormShell } from '../components/AuthFormShell'
import { extractFieldErrors, getErrorMessage } from '../lib/formErrors'
import { validateEmailOnly } from '../lib/validators'

export function ForgotPasswordPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateEmailOnly(email)
    setErrors(validationErrors)
    setSubmitError('')

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await authService.forgotPassword(email)
      startTransition(() =>
        navigate(`/auth/reset-password?email=${encodeURIComponent(email)}`, {
          replace: true,
            state: {
            statusMessage: response.message || t('auth.reset_code_sent', 'A reset code has been sent. Please enter your new password.'),
          },
        }),
      )
    } catch (error) {
      setErrors(extractFieldErrors(error))
      setSubmitError(getErrorMessage(error, t('auth.send_reset_failed', 'Failed to send reset code.')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthFormShell
      eyebrow={t('auth.recovery.eyebrow', 'Account Recovery')}
      title={t('auth.recovery.title', 'Recover your account')}
      description={t('auth.recovery.description', 'Request a reset code or switch to password reset if you already received one.')}
      footerLinks={[{ label: t('auth.back_to_login', 'Back to login'), to: '/auth/login' }]}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-[var(--border)] bg-[var(--muted-surface)] p-1">
          <span className="rounded-md bg-[var(--card)] px-3 py-1.5 text-center text-xs font-medium text-[var(--foreground)]">
            {t('auth.forgot_password_tab', 'Forgot Password')}
          </span>
          <Link
            to="/auth/reset-password"
            className="rounded-md px-3 py-1.5 text-center text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
          >
            {t('auth.reset_password_tab', 'Reset Password')}
          </Link>
        </div>

        <AuthFeedback tone="error" message={submitError} />

        <AuthField
          label={t('auth.email', 'Email')}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="user@example.com"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Button size="lg" type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? t('auth.sending', 'Sending...') : t('auth.send_reset_code', 'Send reset code')}
        </Button>
      </form>
    </AuthFormShell>
  )
}
