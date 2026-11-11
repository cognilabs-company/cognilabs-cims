import { useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { RegistrationField } from '../../../shared/api/services/registrations.service'
import { Button } from '../../../shared/ui/button'
import { usePickedFiles } from '../lib/usePickedFiles'
import { emptyValue, type FormValues } from '../lib/values'
import { FieldInput } from './FieldInput'

/** The builder's "Preview" tab: the form exactly as applicants see it (fill it in to try, nothing is sent). */
export function PreviewForm({ title, description, fields }: { title: string; description: string; fields: RegistrationField[] }) {
  const { t } = useLocale()
  const [values, setValues] = useState<FormValues>({})
  const { files, add, remove } = usePickedFiles()

  return (
    <div className="min-h-full bg-[var(--app-canvas)] px-3 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto w-full max-w-[560px] rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-sm)] sm:p-7">
        <p className="text-[11.5px] font-semibold tracking-[0.06em] text-[var(--primary)] uppercase">{t('registrations.editor.preview_badge', 'Preview')}</p>
        <h3 className="mt-1 text-[21px] leading-tight font-bold tracking-[-0.02em] text-[var(--foreground)]" data-i18n-skip="true">
          {title.trim() || t('registrations.editor.untitled', 'Untitled link')}
        </h3>
        {description.trim() ? <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-[var(--muted-strong)]" data-i18n-skip="true">{description}</p> : null}
        <div className="mt-6 flex flex-col gap-5">
          {fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              idPrefix="preview"
              value={values[field.key] ?? emptyValue(field)}
              onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              files={files[field.key]}
              onAddFiles={(list) => add(field.key, list)}
              onRemoveFile={(id) => remove(field.key, id)}
            />
          ))}
        </div>
        <Button type="button" size="lg" className="mt-7 w-full" disabled>
          {t('registrations.form.submit', 'Submit application')}
        </Button>
        <p className="mt-2 text-center text-[11.5px] text-[var(--muted)]">{t('registrations.editor.preview_note', 'Preview only — nothing is sent.')}</p>
      </div>
    </div>
  )
}
