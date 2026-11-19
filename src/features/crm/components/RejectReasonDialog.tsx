import { useState } from 'react'
import { CircleX } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Textarea } from '../../../shared/ui/textarea'
import { REJECTION_PRESETS, rejectionReasonError } from '../lib/rejection'
import type { RejectionRequest } from '../lib/useRejectionReason'

/** The reason chips + textarea, shared by the dialog and the customer form. */
export function RejectionReasonField({ value, onChange, autoFocus, error }: {
  value: string
  onChange: (next: string) => void
  autoFocus?: boolean
  error?: string | null
}) {
  const { t } = useLocale()
  const presets = REJECTION_PRESETS.map((preset) => t(preset.key, preset.fallback))
  const current = value.trim()

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('customers.reject.presets', 'Common reasons')}>
        {presets.map((label) => {
          const selected = current === label
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? '' : label)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                selected
                  ? 'border-[var(--danger)] bg-[var(--danger-dim)] text-[var(--danger-text)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoFocus={autoFocus}
        rows={3}
        maxLength={500}
        aria-invalid={Boolean(error)}
        placeholder={t('customers.reject.placeholder', 'Why did the lead say no? What did they answer?')}
        className={cn(error && 'border-[var(--danger)]')}
      />
      <div className="flex items-center justify-between gap-3 text-[11.5px]">
        <span className={error ? 'font-medium text-[var(--danger-text)]' : 'text-[var(--muted)]'}>
          {error ?? t('customers.reject.hint', 'The reason is saved on the lead and shown in its card.')}
        </span>
        <span className="shrink-0 text-[var(--caption)] tabular-nums">{value.length}/500</span>
      </div>
    </div>
  )
}

/**
 * Asks why a lead is rejected. Mount it with `key={request.id}` so every question starts empty;
 * `onResolve(reason)` with the text, or `onResolve(null)` when cancelled.
 */
export function RejectReasonDialog({ request, onResolve }: { request: RejectionRequest | null; onResolve: (reason: string | null) => void }) {
  const { t } = useLocale()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const error = touched ? rejectionReasonError(reason, t) : null

  function submit() {
    setTouched(true)
    if (rejectionReasonError(reason, t)) return
    onResolve(reason.trim())
  }

  return (
    <Dialog
      open={request !== null}
      onClose={() => onResolve(null)}
      tone="danger"
      headerIcon={<CircleX />}
      title={t('customers.reject.title', 'Reject {{name}}?', { name: request?.name ?? '' })}
      description={t('customers.reject.description', 'A lead cannot be rejected without a reason. It helps the team see why deals are lost.')}
      footer={(
        <>
          <Button variant="secondary" onClick={() => onResolve(null)}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="danger" onClick={submit}>{t('customers.reject.confirm', 'Reject lead')}</Button>
        </>
      )}
    >
      <form onSubmit={(event) => { event.preventDefault(); submit() }}>
        <p className="mb-2 text-[12.5px] font-semibold text-[var(--foreground)]">{t('customers.reject.label', 'Reason for rejection')} <span className="text-[var(--danger-text)]">*</span></p>
        <RejectionReasonField value={reason} onChange={setReason} autoFocus error={error} />
      </form>
    </Dialog>
  )
}
