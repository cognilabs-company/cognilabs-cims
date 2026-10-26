import { Button } from '../../../shared/ui/button'
import { Label } from '../../../shared/ui/label'
import { Input } from '../../../shared/ui/input'
import { Modal } from '../../../shared/ui/modal'
import { useTranslation } from 'react-i18next'

export type PaymentFormValues = {
  project: string
  date: string
  summ: number
  payment: boolean
}

type PaymentFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  values: PaymentFormValues
  onClose: () => void
  onChange: (field: keyof PaymentFormValues, value: string | number | boolean) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export function PaymentFormModal({
  open,
  mode,
  values,
  onClose,
  onChange,
  onSubmit,
  isSubmitting,
}: PaymentFormModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('ceo.payments.form.create_title') : t('ceo.payments.form.edit_title')}
      description={t('ceo.payments.form.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? t('customers.form.submitting')
              : mode === 'create'
                ? t('ceo.payments.form.create')
                : t('ceo.payments.form.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('ceo.payments.form.project')}</span>
          <Input value={values.project} onChange={(event) => onChange('project', event.target.value)} />
        </Label>
        <div className="grid gap-4 md:grid-cols-2">
          <Label className="grid gap-2">
            <span className="text-xs font-medium text-[var(--foreground)]">{t('ceo.payments.form.date')}</span>
            <Input type="date" value={values.date} onChange={(event) => onChange('date', event.target.value)} />
          </Label>
          <Label className="grid gap-2">
            <span className="text-xs font-medium text-[var(--foreground)]">{t('ceo.payments.form.amount')}</span>
            <Input
              type="number"
              min="0"
              value={values.summ}
              onChange={(event) => onChange('summ', Number(event.target.value))}
            />
          </Label>
        </div>
        <Label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] transition hover:border-[var(--border-hover)] hover:bg-[var(--input-surface-hover)]">
          <input
            type="checkbox"
            checked={values.payment}
            onChange={(event) => onChange('payment', event.target.checked)}
            className="h-4 w-4 rounded border border-[var(--border)] accent-blue-500 dark:border-white/10"
          />
          <span className="text-xs text-[var(--muted-strong)]">{t('ceo.payments.form.already_paid')}</span>
        </Label>
      </div>
    </Modal>
  )
}
