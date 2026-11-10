import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, FileAudio, SlidersHorizontal, Upload, UserPen, UserPlus, UserRound, X, type LucideIcon } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { CalendarField } from '../../../shared/ui/calendar-field'
import { Modal } from '../../../shared/ui/modal'
import { SelectField } from '../../../shared/ui/select-field'

export type CustomerFormValues = {
  full_name: string
  platform: string
  phone_number: string
  status: string
  username: string
  assistant_name: string
  notes: string
  recall_time: string
  clear_recall_time: boolean
  customer_type: string
  conversation_language: string
}

type StatusOption = {
  value: string
  label: string
}

type CustomerFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  customerId?: number
  values: CustomerFormValues
  statusOptions: StatusOption[]
  onClose: () => void
  onChange: (field: keyof CustomerFormValues, value: string | boolean) => void
  onFileChange: (file: File | null) => void
  onSubmit: () => void
  isSubmitting: boolean
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
        <Icon size={13} /> {title}
      </p>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[12.5px] font-medium text-[var(--muted-strong)]">{label}</span>
      {children}
    </label>
  )
}

/** Create / edit a customer: four small groups instead of one long two-column wall. Notes live in the customer view. */
export function CustomerFormModal({
  open,
  mode,
  values,
  statusOptions,
  onClose,
  onChange,
  onFileChange,
  onSubmit,
  isSubmitting,
}: CustomerFormModalProps) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')

  const conversationLanguages = [
    { value: 'uz', label: t('common.language.uz', 'Uzbek') },
    { value: 'ru', label: t('common.language.ru', 'Russian') },
    { value: 'en', label: t('common.language.en', 'English') },
  ]
  const customerTypes = [
    { value: '', label: t('common.not_set', 'Not set') },
    { value: 'local', label: t('common.scope.local', 'Local') },
    { value: 'international', label: t('common.scope.international', 'International') },
  ]

  function pickFile(file: File | null) {
    setFileName(file?.name ?? '')
    onFileChange(file)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      headerIcon={mode === 'create' ? <UserPlus /> : <UserPen />}
      title={mode === 'create'
        ? t('customers.form.title_create', 'Create customer')
        : t('customers.form.title_edit', 'Edit customer details')}
      description={mode === 'create'
        ? t('customers.form.description_create', 'Add a new lead to the CRM.')
        : values.full_name || t('customers.form.description', 'Create or update CRM records and sync them with the backend.')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={onSubmit} loading={isSubmitting}>
            {mode === 'create'
              ? t('customers.form.submit_create', 'Create customer')
              : t('customers.form.submit_edit', 'Save changes')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Section icon={UserRound} title={t('customers.form.section_contact', 'Contact')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('common.full_name', 'Full name')}>
              <Input value={values.full_name} onChange={(event) => onChange('full_name', event.target.value)} autoFocus={mode === 'create'} />
            </Field>
            <Field label={t('common.phone', 'Phone')}>
              <Input value={values.phone_number} onChange={(event) => onChange('phone_number', event.target.value)} inputMode="tel" placeholder="+998 90 123 45 67" />
            </Field>
            <Field label={t('common.username', 'Username')}>
              <Input value={values.username} onChange={(event) => onChange('username', event.target.value)} placeholder="@username" />
            </Field>
            <Field label={t('common.platform', 'Platform')}>
              <Input value={values.platform} onChange={(event) => onChange('platform', event.target.value)} placeholder="Instagram, Telegram…" />
            </Field>
          </div>
        </Section>

        <Section icon={SlidersHorizontal} title={t('customers.form.section_details', 'Status & details')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('common.status', 'Status')}>
              <SelectField
                key={`customer-status-${values.status || 'empty'}`}
                value={values.status}
                onValueChange={(value) => onChange('status', value)}
                placeholder={t('customers.form.status_placeholder', 'Select status')}
                options={statusOptions}
                searchable={statusOptions.length > 8}
                searchPlaceholder={t('common.search', 'Search')}
              />
            </Field>
            <Field label={t('common.customer_type', 'Customer type')}>
              <SelectField value={values.customer_type} onValueChange={(value) => onChange('customer_type', value)} options={customerTypes} />
            </Field>
            <Field label={t('common.conversation_language', 'Conversation language')}>
              <SelectField value={values.conversation_language} onValueChange={(value) => onChange('conversation_language', value)} options={conversationLanguages} />
            </Field>
            <Field label={t('common.assistant', 'Assistant')}>
              <Input value={values.assistant_name} onChange={(event) => onChange('assistant_name', event.target.value)} />
            </Field>
          </div>
        </Section>

        <Section icon={CalendarClock} title={t('customers.quick.recall', 'Call back')}>
          <div className="grid gap-3 sm:grid-cols-2 sm:items-center">
            <CalendarField
              mode="datetime"
              value={values.clear_recall_time ? '' : values.recall_time}
              onValueChange={(value) => { onChange('recall_time', value); if (value) onChange('clear_recall_time', false) }}
              disabled={values.clear_recall_time}
              aria-label={t('common.recall_time', 'Recall time')}
            />
            {mode === 'edit' ? (
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[var(--muted-strong)]">
                <Checkbox size="sm" checked={values.clear_recall_time} onChange={(event) => onChange('clear_recall_time', event.target.checked)} />
                {t('customers.form.clear_recall', 'Clear recall time')}
              </label>
            ) : null}
          </div>
        </Section>

        <Section icon={FileAudio} title={t('customers.form.section_audio', 'Audio recording')}>
          <input ref={fileRef} type="file" accept="audio/*" className="sr-only" tabIndex={-1} onChange={(event) => pickFile(event.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-[var(--control-border)] px-3 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[var(--blue-dim)] text-[var(--primary)]"><FileAudio size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[var(--foreground)]">{fileName || t('customers.form.no_file', 'No file chosen')}</span>
              <span className="block text-[11.5px] text-[var(--muted)]">MP3 · OGG · WAV · M4A</span>
            </span>
            {fileName ? (
              <button type="button" onClick={() => { pickFile(null); if (fileRef.current) fileRef.current.value = '' }} aria-label={t('common.clear', 'Clear')} className="grid h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            ) : null}
            <Button type="button" size="sm" variant="secondary" leftIcon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
              {t('customers.form.choose_file', 'Choose file')}
            </Button>
          </div>
        </Section>
      </div>
    </Modal>
  )
}
