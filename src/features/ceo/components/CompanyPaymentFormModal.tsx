import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Modal } from '../../../shared/ui/modal'
import { Textarea } from '../../../shared/ui/textarea'
import { useTranslation } from 'react-i18next'
import { TimeField } from '../../../shared/ui/time-field'

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
      <div className="grid gap-[18px]">
        <Label className="grid gap-2">
          <span className="ui-input-label">{t('ceo.recurring.form.title')}</span>
          <Input value={values.title} onChange={(event) => onChange('title', event.target.value)} />
        </Label>

        <div className="grid gap-[18px] md:grid-cols-3">
          <Label className="grid gap-2">
            <span className="ui-input-label">{t('ceo.recurring.form.amount')}</span>
            <Input
              type="number"
              min="0"
              value={values.amount}
              onChange={(event) => onChange('amount', Number(event.target.value))}
            />
          </Label>

          <Label className="grid gap-2">
            <span className="ui-input-label">{t('ceo.recurring.form.payment_day')}</span>
            <Input
              type="number"
              min="1"
              max="31"
              value={values.paymentDay}
              onChange={(event) => onChange('paymentDay', Number(event.target.value))}
            />
          </Label>

          <Label className="grid gap-2">
            <span className="ui-input-label">{t('ceo.recurring.form.payment_time')}</span>
            <TimeField
              value={values.paymentTime}
              onValueChange={(value) => onChange('paymentTime', value)}
              aria-label={t('ceo.recurring.form.payment_time')}
            />
          </Label>
        </div>

        <Label className="grid gap-2">
          <span className="ui-input-label">{t('ceo.recurring.form.note')}</span>
          <Textarea
            value={values.note}
            onChange={(event) => onChange('note', event.target.value)}
            rows={4}
          />
        </Label>

        <Label className="flex cursor-pointer items-center gap-3 rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5 transition-colors hover:bg-[var(--blue-dim)]">
          <Checkbox
            size="sm"
            checked={values.isActive}
            onChange={(event) => onChange('isActive', event.target.checked)}
          />
          <span className="text-sm font-medium text-[var(--foreground)]">{t('ceo.recurring.form.active')}</span>
        </Label>
      </div>
    </Modal>
  )
}
