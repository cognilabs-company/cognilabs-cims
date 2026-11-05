import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Label } from '../../../shared/ui/label'
import { Input } from '../../../shared/ui/input'
import { CalendarField } from '../../../shared/ui/calendar-field'
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
      <div className="grid gap-[18px]">
        <Label className="grid gap-2">
          <span className="ui-input-label">{t('ceo.payments.form.project')}</span>
          <Input value={values.project} onChange={(event) => onChange('project', event.target.value)} />
        </Label>
        <div className="grid gap-[18px] md:grid-cols-2">
          <Label className="grid gap-2">
            <span className="ui-input-label">{t('ceo.payments.form.date')}</span>
            <CalendarField value={values.date} onValueChange={(value) => onChange('date', value)} />
          </Label>
          <Label className="grid gap-2">
            <span className="ui-input-label">{t('ceo.payments.form.amount')}</span>
            <Input
              type="number"
              min="0"
              value={values.summ}
              onChange={(event) => onChange('summ', Number(event.target.value))}
            />
          </Label>
        </div>
        <Label className="flex cursor-pointer items-center gap-3 rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5 transition-colors hover:bg-[var(--blue-dim)]">
          <Checkbox
            size="sm"
            checked={values.payment}
            onChange={(event) => onChange('payment', event.target.checked)}
          />
          <span className="text-sm font-medium text-[var(--foreground)]">{t('ceo.payments.form.already_paid')}</span>
        </Label>
      </div>
    </Modal>
  )
}
