import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Modal } from '../../../shared/ui/modal'
import { useTranslation } from 'react-i18next'

export type CompanyPaymentFormValues = {
  title: string
  amount: number
  paymentDay: number
  paymentTime: string
  note: string
  isActive: boolean
}

type CompanyPaymentFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  values: CompanyPaymentFormValues
  onClose: () => void
  onChange: (field: keyof CompanyPaymentFormValues, value: string | number | boolean) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export function CompanyPaymentFormModal({
  open,
  mode,
  values,
  onClose,
  onChange,
  onSubmit,
  isSubmitting,
}: CompanyPaymentFormModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create'
        ? t('ceo.recurring.form.create_title')
        : t('ceo.recurring.form.edit_title')}
      description={t('ceo.recurring.form.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? t('customers.form.submitting')
              : mode === 'create'
                ? t('ceo.recurring.form.create')
                : t('ceo.recurring.form.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('ceo.recurring.form.title')}</span>
          <Input value={values.title} onChange={(event) => onChange('title', event.target.value)} />
        </Label>

        <div className="grid gap-4 md:grid-cols-3">
          <Label className="grid gap-2">
            <span className="text-xs font-medium text-[var(--foreground)]">{t('ceo.recurring.form.amount')}</span>
            <Input
              type="number"
              min="0"
              value={values.amount}
              onChange={(event) => onChange('amount', Number(event.target.value))}
            />
          </Label>

          <Label className="grid gap-2">
            <span className="text-xs font-medium text-[var(--foreground)]">{t('ceo.recurring.form.payment_day')}</span>
            <Input
              type="number"
              min="1"
              max="31"
              value={values.paymentDay}
              onChange={(event) => onChange('paymentDay', Number(event.target.value))}
            />
          </Label>

          <Label className="grid gap-2">
            <span className="text-xs font-medium text-[var(--foreground)]">{t('ceo.recurring.form.payment_time')}</span>
            <Input
              type="time"
              value={values.paymentTime}
              onChange={(event) => onChange('paymentTime', event.target.value)}
            />
          </Label>
        </div>

        <Label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('ceo.recurring.form.note')}</span>
          <textarea
            value={values.note}
            onChange={(event) => onChange('note', event.target.value)}
            rows={4}
            className="min-h-24 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] outline-none transition focus:border-[var(--border-hover)] focus:bg-[var(--input-surface-hover)]"
          />
        </Label>

        <Label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] transition hover:border-[var(--border-hover)] hover:bg-[var(--input-surface-hover)]">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => onChange('isActive', event.target.checked)}
            className="h-4 w-4 rounded border border-[var(--border)] accent-blue-500 dark:border-white/10"
          />
          <span className="text-xs text-[var(--muted-strong)]">{t('ceo.recurring.form.active')}</span>
        </Label>
      </div>
    </Modal>
  )
}
