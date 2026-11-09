import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Delete, ExternalLink, Phone } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { leadPath, normalizePhone, type TelephonyLead } from '../../../shared/api/services/telephony.service'
import { MacAvatar } from './MacPrimitives'
import { connectionLabel, formatPhone, sourceLabel } from './telephonyFormat'

const keys: Array<[string, string]> = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
]

type KeypadPopoverProps = {
  phone: string
  onPhoneChange: (value: string) => void
  leads: TelephonyLead[]
  selectedLead: TelephonyLead | null
  searching: boolean
  leadError: string | null
  onSelectLead: (lead: TelephonyLead) => void
  onCall: () => void
  canCall: boolean
  connection: string
}

export function KeypadPopover({
  phone, onPhoneChange, leads, selectedLead, searching, leadError, onSelectLead, onCall, canCall, connection,
}: KeypadPopoverProps) {
  const { t } = useLocale()
  const inputRef = useRef<HTMLInputElement>(null)
  const digits = normalizePhone(phone)
  const selectedPath = selectedLead ? leadPath(selectedLead.crm_source, selectedLead.customer_id) : null
  const phoneState = t('telephony.phone_state', 'Phone: {{state}}', { state: connectionLabel(connection) })

  useEffect(() => { inputRef.current?.focus() }, [])

  function press(key: string) {
    onPhoneChange(phone + key)
    inputRef.current?.focus()
  }

  return (
    <div
      role="dialog"
      aria-label={t('telephony.keypad', 'Keypad')}
      className="mac-pop absolute top-[calc(100%+8px)] right-0 z-40 w-[300px] rounded-[22px] border border-[var(--mp-menu-border)] bg-[var(--mp-menu)] p-4 text-[var(--mp-text)] shadow-[0_24px_60px_-14px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
    >
      {/* Number field */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id="dialer-phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          aria-label={t('telephony.keypad.input_label', 'Phone number or last 4 digits')}
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && canCall) onCall() }}
          placeholder={t('telephony.keypad.enter_number', 'Enter number')}
          className="h-11 w-full bg-transparent px-8 text-center text-[24px] font-medium tracking-[0.01em] tabular-nums text-[var(--mp-text)] placeholder:text-[17px] placeholder:font-normal placeholder:text-[var(--mp-tertiary)] focus:outline-none"
        />
        {phone ? (
          <button
            type="button"
            aria-label={t('telephony.keypad.delete', 'Delete last digit')}
            title={t('telephony.keypad.delete', 'Delete last digit')}
            onClick={() => { onPhoneChange(phone.slice(0, -1)); inputRef.current?.focus() }}
            className="absolute right-0 grid h-8 w-8 place-items-center rounded-full text-[var(--mp-secondary)] hover:bg-[var(--mp-control)]"
          >
            <Delete size={18} />
          </button>
        ) : null}
      </div>

      {/* Lead match — what the number resolves to */}
      <div className="mt-1 min-h-[44px]">
        {selectedLead ? (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-[var(--mp-control)] px-2.5 py-2">
            <MacAvatar name={selectedLead.full_name} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{selectedLead.full_name}</p>
              <p className="truncate text-[11.5px] text-[var(--mp-secondary)]">
                {sourceLabel(selectedLead.crm_source)} · {selectedLead.status || t('telephony.keypad.no_status', 'No status')}
              </p>
            </div>
            {selectedPath ? (
              <Link
                to={selectedPath}
                title={t('telephony.open_lead', 'Open lead')}
                aria-label={t('telephony.open_lead', 'Open lead')}
                className="grid h-7 w-7 place-items-center rounded-full text-[var(--mp-blue)] hover:bg-[var(--mp-control-hover)]"
              >
                <ExternalLink size={14} />
              </Link>
            ) : null}
          </div>
        ) : leads.length > 0 ? (
          <div className="mac-phone-scroll max-h-[132px] overflow-y-auto rounded-[12px] bg-[var(--mp-control)] p-1">
            {leads.map((item) => (
              <button
                type="button"
                key={`${item.crm_source}-${item.customer_id}`}
                onClick={() => onSelectLead(item)}
                className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left hover:bg-[var(--mp-control-hover)]"
              >
                <MacAvatar name={item.full_name} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{item.full_name}</span>
                  <span className="block truncate text-[11.5px] text-[var(--mp-secondary)]">{formatPhone(item.phone_number)}</span>
                </span>
                <span className="shrink-0 text-[11px] text-[var(--mp-secondary)]">{sourceLabel(item.crm_source)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className={`pt-2 text-center text-[12px] ${leadError ? 'text-[var(--mp-red)]' : 'text-[var(--mp-secondary)]'}`} role={leadError ? 'alert' : undefined}>
            {leadError
              ?? (searching
                ? t('telephony.keypad.searching', 'Searching leads…')
                : digits.length >= 4
                  ? t('telephony.keypad.no_leads', 'No matching leads')
                  : t('telephony.keypad.hint', 'Type a number or the last 4 digits'))}
          </p>
        )}
      </div>

      {/* Keys */}
      <div className="mt-3 grid grid-cols-3 justify-items-center gap-x-4 gap-y-3" data-i18n-skip="true">
        {keys.map(([digit, letters]) => (
          <button
            key={digit}
            type="button"
            onClick={() => press(digit)}
            aria-label={digit}
            className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full bg-[var(--mp-control)] transition-colors hover:bg-[var(--mp-control-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60"
          >
            <span className="text-[26px] leading-none font-normal">{digit}</span>
            {letters ? <span className="mt-0.5 text-[8.5px] font-semibold tracking-[0.18em] text-[var(--mp-secondary)]">{letters}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onCall}
          disabled={!canCall}
          aria-label={t('telephony.call', 'Call')}
          title={connection === 'Ready' ? t('telephony.call', 'Call') : phoneState}
          className="grid h-[62px] w-[62px] place-items-center rounded-full bg-[var(--mp-green)] text-white shadow-[0_8px_20px_-8px_rgba(52,199,89,0.8)] transition hover:brightness-105 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Phone size={26} fill="currentColor" strokeWidth={0} />
        </button>
        {connection !== 'Ready' ? <p className="text-[11.5px] text-[var(--mp-secondary)]">{phoneState}</p> : null}
      </div>
    </div>
  )
}
