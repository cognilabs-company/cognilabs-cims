import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Modal } from '../../../shared/ui/modal'
import { Textarea } from '../../../shared/ui/textarea'
import { useTranslation } from 'react-i18next'

export type MessageComposerValues = {
  receiver_id?: number
  receiver_label?: string
  subject: string
  body: string
}

type MessageComposerModalProps = {
  open: boolean
  onClose: () => void
  values: MessageComposerValues
  isBroadcast?: boolean
  isSubmitting: boolean
  onChange: (field: keyof MessageComposerValues, value: string | number | undefined) => void
  onSubmit: () => void
}

export function MessageComposerModal({
  open,
  onClose,
  values,
  isBroadcast = false,
  isSubmitting,
  onChange,
  onSubmit,
}: MessageComposerModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBroadcast ? t('ceo.messages.broadcast.title') : t('ceo.messages.single.title')}
      description={
        isBroadcast
          ? t('ceo.messages.broadcast.description')
          : t('ceo.messages.single.description')
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? t('auth.sending') : t('ceo.messages.send')}
          </Button>
        </>
      }
    >
      {!isBroadcast ? (
        <div className="rounded-xl border border-blue-500/15 bg-blue-50 px-4 py-3 text-xs text-[var(--muted-strong)] dark:bg-blue-600/10 dark:text-[var(--muted)]">
          {t('ceo.messages.receiver')}:
          <span className="ml-2 font-bold text-[var(--foreground)] dark:text-white">{values.receiver_label}</span>
        </div>
      ) : null}
      <div className="mt-4 grid gap-4">
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('ceo.messages.subject')}</span>
          <Input
            value={values.subject}
            placeholder={t('ceo.messages.subject_placeholder')}
            onChange={(event) => onChange('subject', event.target.value)}
          />
        </Label>
        <Label className="grid gap-2">
          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] dark:text-white">{t('ceo.messages.body')}</span>
          <Textarea
            rows={7}
            value={values.body}
            placeholder={t('ceo.messages.body_placeholder')}
            onChange={(event) => onChange('body', event.target.value)}
          />
        </Label>
      </div>
    </Modal>
  )
}
