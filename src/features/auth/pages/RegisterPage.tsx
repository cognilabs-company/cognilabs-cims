import { startTransition, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocale } from '../../../app/hooks/useLocale'
import type { RegisterPayload } from '../../../shared/api/services/auth.service'
import { authService } from '../../../shared/api/services/auth.service'
import { Button } from '../../../shared/ui/button'
import { Label } from '../../../shared/ui/label'
import { SelectField } from '../../../shared/ui/select-field'
import { AuthFeedback } from '../components/AuthFeedback'
import { AuthField } from '../components/AuthField'
import { AuthFormShell } from '../components/AuthFormShell'
import { PasswordField } from '../components/PasswordField'
import { extractFieldErrors, getErrorMessage } from '../lib/formErrors'
import { validateRegister } from '../lib/validators'

const initialValues: RegisterPayload = {
  email: '',
  name: '',
  surname: '',
  password: '',
  company_code: 'oddiy',
  telegram_id: '',
  job_title: '',
  role: 'Customer',
}

export function RegisterPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [values, setValues] = useState<RegisterPayload>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateRegister(values)
    setErrors(validationErrors)
    setSubmitError('')

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      await authService.register({
        ...values,
        telegram_id: values.telegram_id?.trim() || undefined,
        job_title: values.job_title?.trim() || undefined,
      })

      startTransition(() =>
        navigate(`/auth/verify-email?email=${encodeURIComponent(values.email)}`, {
          replace: true,
            state: {
            statusMessage: t('auth.register.success', 'Registration successful. Please enter the code sent to your email.'),
          },
        }),
      )
    } catch (error) {
      setErrors(extractFieldErrors(error))
      setSubmitError(getErrorMessage(error, t('auth.register.failed', 'Registration failed.')))
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleOptions = [
    { value: 'Customer', label: t('auth.role.customer', 'Customer') },
    { value: 'SalesManager', label: t('auth.role.sales_manager', 'Sales Manager') },
    { value: 'Finance', label: t('auth.role.finance', 'Finance') },
    { value: 'CEO', label: t('auth.role.ceo', 'CEO') },
  ]

  return (
    <AuthFormShell
      eyebrow={t('auth.register.eyebrow', 'Auth / Register')}
      title={t('auth.register.title', 'Create new account')}
      description={t('auth.register.description', 'Register with your email, company code, and role to join the workspace.')}
      footerLinks={[
        { label: t('auth.login_button', 'Login'), to: '/auth/login' },
        { label: t('auth.verify_email', 'Verify email'), to: '/auth/verify-email' },
      ]}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <AuthFeedback tone="error" message={submitError} />

        <div className="grid gap-4 md:grid-cols-2">
          <AuthField
            label={t('auth.email', 'Email')}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="user@example.com"
            value={values.email}
            error={errors.email}
            onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          />
          <AuthField
            label={t('auth.register.company_code', 'Company code')}
            name="company_code"
            placeholder="oddiy"
            value={values.company_code}
            error={errors.company_code}
            onChange={(event) => setValues((current) => ({ ...current, company_code: event.target.value }))}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AuthField
            label={t('auth.register.name', 'Name')}
            name="name"
            autoComplete="given-name"
            placeholder="Ibrohim"
            value={values.name}
            error={errors.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
          />
          <AuthField
            label={t('auth.register.surname', 'Surname')}
            name="surname"
            autoComplete="family-name"
            placeholder="Ibrohimjonov"
            value={values.surname}
            error={errors.surname}
            onChange={(event) => setValues((current) => ({ ...current, surname: event.target.value }))}
          />
        </div>

        <PasswordField
          label={t('auth.password', 'Password')}
          name="password"
          autoComplete="new-password"
          placeholder={t('auth.register.password_placeholder', 'Minimum 6 characters')}
          value={values.password}
          error={errors.password}
          onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <AuthField
            label={t('auth.register.telegram_id', 'Telegram ID')}
            name="telegram_id"
            placeholder={t('auth.register.telegram_placeholder', '@username or ID')}
            value={values.telegram_id}
            error={errors.telegram_id}
            onChange={(event) => setValues((current) => ({ ...current, telegram_id: event.target.value }))}
          />
          <AuthField
            label={t('auth.register.job_title', 'Job title')}
            name="job_title"
            placeholder={t('auth.register.job_title_placeholder', 'Sales Manager')}
            value={values.job_title ?? ''}
            error={errors.job_title}
            onChange={(event) => setValues((current) => ({ ...current, job_title: event.target.value }))}
          />

          <Label className="grid gap-2">
            <span className="text-xs font-bold text-white tracking-tight">{t('auth.register.role', 'Role')}</span>
            <SelectField
              value={values.role}
              onValueChange={(value) => setValues((current) => ({ ...current, role: value }))}
              options={roleOptions}
              className="min-h-12 rounded-xl px-4"
            />
          </Label>
        </div>

        <Button size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('auth.register.processing', 'Processing...') : t('auth.register.button', 'Register')}
        </Button>
      </form>
    </AuthFormShell>
  )
}
