import { useState, type ReactNode } from 'react'
import { Monitor, PhoneForwarded, Settings2, Smartphone } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import {
  normalizePhone, telephonyService,
  type ForwardingMode, type ForwardingTargetType, type OutboundMode, type TelephonyExtension, type TelephonyExtensionUpdate,
} from '../../../shared/api/services/telephony.service'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { Switch } from '../../../shared/ui/switch'

type Props = {
  extension: TelephonyExtension
  onClose: () => void
  onSaved: (next: TelephonyExtension) => void
}

const forwardingModes: ForwardingMode[] = ['always', 'busy', 'no_answer', 'offline']

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11.5px] text-[var(--muted)]">{hint}</span> : null}
    </label>
  )
}

function ToggleRow({ icon, title, text, checked, onChange }: { icon: ReactNode; title: string; text: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] px-3.5 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--input-surface)] text-[var(--muted-strong)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{title}</span>
        <span className="block text-[12px] text-[var(--muted)]">{text}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

/** Mobile calling and call forwarding for one extension (PATCH /telephony/extensions/{user_id}). */
export function ExtensionSettingsDialog({ extension, onClose, onSaved }: Props) {
  const { t } = useLocale()
  const [active, setActive] = useState(extension.is_active !== false)
  const [mode, setMode] = useState<OutboundMode>(extension.outbound_mode === 'mobile' ? 'mobile' : 'webrtc')
  const [mobile, setMobile] = useState(extension.mobile_number ?? '')
  const [forwarding, setForwarding] = useState(Boolean(extension.forwarding_enabled))
  const [forwardMode, setForwardMode] = useState<ForwardingMode>((forwardingModes as string[]).includes(extension.forwarding_mode ?? '') ? extension.forwarding_mode as ForwardingMode : 'always')
  const [targetType, setTargetType] = useState<ForwardingTargetType>(extension.forwarding_target_type === 'extension' ? 'extension' : 'phone')
  const [target, setTarget] = useState(extension.forwarding_target ?? '')
  const [timeout, setTimeoutSeconds] = useState(String(extension.forwarding_timeout_seconds ?? 20))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mobileDigits = normalizePhone(mobile)
  const timeoutValue = Number(timeout)
  const problems = [
    mode === 'mobile' && (mobileDigits.length < 7 || mobileDigits.length > 32) ? t('telephony.ext_settings.need_mobile', 'Enter the mobile number for mobile mode.') : null,
    forwarding && (target.trim().length < 3 || target.trim().length > 32) ? t('telephony.ext_settings.need_target', 'Enter where calls are forwarded.') : null,
    forwarding && forwardMode === 'no_answer' && !(timeoutValue >= 5 && timeoutValue <= 60) ? t('telephony.ext_settings.bad_timeout', 'Ring time must be 5–60 seconds.') : null,
  ].filter(Boolean)

  const modeLabels: Record<ForwardingMode, string> = {
    always: t('telephony.forwarding.always', 'Always forwarded'),
    busy: t('telephony.forwarding.busy', 'Forward when busy'),
    no_answer: t('telephony.forwarding.no_answer', 'Forward if no answer'),
    offline: t('telephony.forwarding.offline', 'Forward when offline'),
  }

  async function save() {
    if (problems.length) { setError(String(problems[0])); return }
    const payload: TelephonyExtensionUpdate = {
      is_active: active,
      outbound_mode: mode,
      mobile_number: mobileDigits ? mobileDigits : null,
      forwarding_enabled: forwarding,
      ...(forwarding ? {
        forwarding_mode: forwardMode,
        forwarding_target_type: targetType,
        forwarding_target: targetType === 'phone' ? normalizePhone(target) : target.trim(),
        forwarding_timeout_seconds: forwardMode === 'no_answer' ? timeoutValue : undefined,
      } : {}),
    }
    setSaving(true)
    setError(null)
    try {
      const next = await telephonyService.updateExtension(extension.user_id, payload)
      onSaved({ ...extension, ...payload, ...(next && typeof next === 'object' ? next : {}) })
    } catch (cause) {
      setError(getApiErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('telephony.ext_settings.title', 'Line settings · {{name}}', { name: extension.user_name || `#${extension.user_id}` })}
      description={t('telephony.ext_settings.description', 'Extension {{ext}} — how this person makes and receives calls.', { ext: extension.extension ?? '—' })}
      headerIcon={<Settings2 size={18} />}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={() => void save()} loading={saving}>{t('common.save', 'Save')}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <ToggleRow
          icon={<Settings2 size={17} />}
          title={t('telephony.ext_settings.active', 'Extension is active')}
          text={t('telephony.ext_settings.active_hint', 'Turned off, the person cannot make or receive calls.')}
          checked={active}
          onChange={setActive}
        />

        <div>
          <p className="mb-1.5 text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('telephony.ext_settings.outbound', 'Outgoing calls')}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('telephony.ext_settings.outbound', 'Outgoing calls')}>
            {([
              ['webrtc', Monitor, t('telephony.mode.webrtc', 'In the browser'), t('telephony.mode.webrtc_hint', 'Headset on the computer (WebRTC)')],
              ['mobile', Smartphone, t('telephony.mode.mobile', 'Via mobile phone'), t('telephony.mode.mobile_hint', 'The phone rings first, then the customer')],
            ] as const).map(([value, Icon, title, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'flex items-start gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-[border-color,box-shadow,background-color]',
                  mode === value ? 'border-[var(--primary)] bg-[var(--blue-dim)] shadow-[0_0_0_1px_var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--input-surface)]',
                )}
              >
                <Icon size={18} className={cn('mt-0.5 shrink-0', mode === value ? 'text-[var(--primary)]' : 'text-[var(--muted)]')} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{title}</span>
                  <span className="block text-[11.5px] leading-snug text-[var(--muted)]">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <Field
          label={t('telephony.ext_settings.mobile', 'Mobile number')}
          hint={mode === 'mobile'
            ? t('telephony.ext_settings.mobile_hint', 'This phone rings first; the customer still sees the company number and the call is recorded.')
            : t('telephony.ext_settings.mobile_optional', 'Optional — needed for mobile mode or forwarding to the phone.')}
        >
          <Input type="tel" inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="998901234567" aria-invalid={mode === 'mobile' && mobileDigits.length < 7} />
        </Field>

        <ToggleRow
          icon={<PhoneForwarded size={17} />}
          title={t('telephony.ext_settings.forwarding', 'Call forwarding')}
          text={t('telephony.ext_settings.forwarding_hint', 'Send incoming calls to another extension or phone.')}
          checked={forwarding}
          onChange={setForwarding}
        />

        {forwarding ? (
          <div className="grid gap-3 rounded-[14px] bg-[var(--muted-surface)] p-3.5 sm:grid-cols-2">
            <Field label={t('telephony.ext_settings.when', 'When')}>
              <SelectField value={forwardMode} onValueChange={(value) => setForwardMode(value as ForwardingMode)} options={forwardingModes.map((value) => ({ value, label: modeLabels[value] }))} aria-label={t('telephony.ext_settings.when', 'When')} />
            </Field>
            <Field label={t('telephony.ext_settings.target_type', 'Forward to')}>
              <SelectField
                value={targetType}
                onValueChange={(value) => setTargetType(value as ForwardingTargetType)}
                options={[
                  { value: 'phone', label: t('telephony.ext_settings.to_phone', 'Phone number') },
                  { value: 'extension', label: t('telephony.ext_settings.to_extension', 'Another extension') },
                ]}
                aria-label={t('telephony.ext_settings.target_type', 'Forward to')}
              />
            </Field>
            <Field label={targetType === 'phone' ? t('telephony.ext_settings.to_phone', 'Phone number') : t('telephony.ext_settings.to_extension', 'Another extension')}>
              <Input
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                inputMode={targetType === 'phone' ? 'tel' : 'numeric'}
                placeholder={targetType === 'phone' ? '998901234567' : '102'}
              />
            </Field>
            {forwardMode === 'no_answer' ? (
              <Field label={t('telephony.ext_settings.timeout', 'Ring for (seconds)')} hint="5–60">
                <Input type="number" min={5} max={60} value={timeout} onChange={(event) => setTimeoutSeconds(event.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : null}

        {error ? <p role="alert" className="rounded-[12px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[13px] text-[var(--danger-text)]">{error}</p> : null}
      </div>
    </Dialog>
  )
}
