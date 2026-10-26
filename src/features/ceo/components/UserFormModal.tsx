import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Modal } from '../../../shared/ui/modal'
import { Button } from '../../../shared/ui/button'
import { SelectField, type SelectFieldOption } from '../../../shared/ui/select-field'
import type { UserPayload } from '../../../shared/api/services/ceo.service'
import { useTranslation } from 'react-i18next'

export type UserFormValues = UserPayload & {
  password: string
}

type UserFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  values: UserFormValues
  roleOptions: SelectFieldOption[]
  isRolesLoading?: boolean
  onClose: () => void
  onChange: (field: keyof UserFormValues, value: string | boolean | number) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export function UserFormModal({
  open,
  mode,
  values,
  roleOptions,
  isRolesLoading = false,
  onClose,
  onChange,
  onSubmit,
  isSubmitting,
}: UserFormModalProps) {
  const { t } = useTranslation()
  const currentRole = values.role?.trim() ?? ''
  const currentRoleNormalized = currentRole.toLowerCase()
  const currentRoleInList = roleOptions.some(
    (option) => option.value.toLowerCase() === currentRoleNormalized,
  )
  const availableRoleOptions: SelectFieldOption[] =
    currentRole && !currentRoleInList
      ? [...roleOptions, { value: currentRole, label: currentRole }]
      : roleOptions
  const taskDisciplineOptions: SelectFieldOption[] = [
    { value: '', label: t('ceo.users.form.task_discipline_none', 'Not assigned') },
    { value: 'Frontend', label: t('ceo.users.form.task_discipline_frontend', 'Frontend') },
    { value: 'Backend', label: t('ceo.users.form.task_discipline_backend', 'Backend') },
  ]
  const currentJobTitle = values.job_title?.trim() ?? ''
  const currentJobTitleInList = taskDisciplineOptions.some(
    (option) => option.value.toLowerCase() === currentJobTitle.toLowerCase(),
  )
  const availableTaskDisciplineOptions =
    currentJobTitle && !currentJobTitleInList
      ? [...taskDisciplineOptions, { value: currentJobTitle, label: currentJobTitle }]
      : taskDisciplineOptions

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('ceo.users.form.create_title') : t('ceo.users.form.edit_title')}
      description={t('ceo.users.form.description')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? t('customers.form.submitting')
              : mode === 'create'
                ? t('ceo.users.form.create')
                : t('common.save_changes')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('auth.email')}</span>
          <Input value={values.email} placeholder="user@example.com" onChange={(event) => onChange('email', event.target.value)} />
        </Label>
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('ceo.users.form.company_code')}</span>
          <Input
            value={values.company_code}
            placeholder={t('ceo.users.form.company_code_placeholder')}
            onChange={(event) => onChange('company_code', event.target.value)}
          />
        </Label>
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('profile.name')}</span>
          <Input value={values.name} placeholder={t('ceo.users.form.name_placeholder')} onChange={(event) => onChange('name', event.target.value)} />
        </Label>
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('profile.surname')}</span>
          <Input value={values.surname} placeholder={t('ceo.users.form.surname_placeholder')} onChange={(event) => onChange('surname', event.target.value)} />
        </Label>
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('ceo.users.form.task_discipline', 'Task discipline')}</span>
          <SelectField
            value={currentJobTitle}
            onValueChange={(value) => onChange('job_title', value)}
            options={availableTaskDisciplineOptions}
            placeholder={t('ceo.users.form.task_discipline_placeholder', 'Choose frontend or backend')}
            className="min-h-12 rounded-xl px-4"
          />
          <span className="text-[11px] leading-4 text-[var(--muted)]">{t('ceo.users.form.task_discipline_hint', 'Used to route Telegram tasks to frontend or backend team members.')}</span>
        </Label>
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">
            {mode === 'edit' ? t('ceo.users.form.password_optional') : t('auth.password')}
          </span>
          <Input
            type="password"
            placeholder={t('ceo.users.form.password_placeholder')}
            value={values.password}
            onChange={(event) => onChange('password', event.target.value)}
          />
        </Label>
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('auth.register.telegram_id')}</span>
          <Input
            value={values.telegram_id ?? ''}
            placeholder={t('auth.register.telegram_placeholder')}
            onChange={(event) => onChange('telegram_id', event.target.value)}
          />
        </Label>
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('ceo.users.form.default_salary')}</span>
          <Input
            type="number"
            min="0"
            value={values.default_salary ?? 0}
            onChange={(event) => onChange('default_salary', Number(event.target.value))}
          />
        </Label>
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('profile.role')}</span>
          <SelectField
            value={values.role}
            onValueChange={(value) => onChange('role', value)}
            options={availableRoleOptions}
            placeholder={isRolesLoading ? t('ceo.users.form.roles_loading', 'Loading roles...') : t('ceo.users.form.role_placeholder', 'Select a role')}
            disabled={isRolesLoading && availableRoleOptions.length === 0}
            className="min-h-12 rounded-xl px-4"
          />
        </Label>
      </div>

      <Label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] transition hover:border-[var(--border-hover)] hover:bg-[var(--input-surface-hover)]">
        <input
          type="checkbox"
          checked={values.is_active}
          onChange={(event) => onChange('is_active', event.target.checked)}
          className="h-4 w-4 rounded border border-[var(--border)] accent-blue-500 dark:border-white/10"
        />
        <span className="text-xs font-bold text-[var(--foreground)] dark:text-white">{t('ceo.users.form.active')}</span>
      </Label>
    </Modal>
  )
}
