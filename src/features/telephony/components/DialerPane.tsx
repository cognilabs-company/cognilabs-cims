import { useEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Delete, ExternalLink, Phone } from 'lucide-react'
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

type DialerPaneProps = {
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
  extension?: string | null
  /** Mobile sheet: shows a back button. */
  onBack?: () => void
}

/** Full-height keypad shown in the right pane of the Calls page (iPhone / macOS Phone style). */
export function DialerPane({
  phone, onPhoneChange, leads, selectedLead, searching, leadError, onSelectLead, onCall, canCall, connection, extension, onBack,
}: DialerPaneProps) {
  const { t } = useLocale()
  const inputRef = useRef<HTMLInputElement>(null)
  const digits = normalizePhone(phone)
  const selectedPath = selectedLead ? leadPath(selectedLead.crm_source, selectedLead.customer_id) : null
  const ready = connection === 'Ready'

  // Focus the number field so the physical keyboard works right away (not on touch screens).
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus()
  }, [])

  function press(key: string) {
    onPhoneChange(phone + key)
    inputRef.current?.focus()
  }

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[22px] px-5 py-[clamp(10px,2.5cqh,20px)] [container-type:size]"
      style={{ background: 'var(--mp-dialer)' } as CSSProperties}
    >
      {onBack ? (
        <button type="button" onClick={onBack} className="inline-flex h-8 items-center gap-0.5 self-start rounded-full bg-[var(--mp-control)] pr-3 pl-1.5 text-[13px] font-medium text-[var(--mp-text)]">
          <ChevronLeft size={18} /> {t('telephony.recents', 'Recents')}
        </button>
      ) : null}

      {/* Every size below follows the pane's own height/width (container units), so the keypad
          always fits — no scrolling on any screen. --mp-key is the key diameter. */}
      <div
        className="mx-auto my-auto flex w-full max-w-[360px] flex-col items-center"
        style={{ '--mp-key': 'clamp(30px, min(calc((72cqh - 30px) / 6), 21cqw), 78px)' } as CSSProperties}
      >
        {/* Line state */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mp-control)] px-2.5 py-1 text-[12px] font-medium text-[var(--mp-secondary)]">
          <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-[var(--mp-green)]' : /connect/i.test(connection) ? 'bg-[var(--mp-orange)]' : 'bg-[var(--mp-red)]'}`} />
          {connectionLabel(connection)}{extension ? ` · ${t('telephony.ext', 'Ext {{ext}}', { ext: extension })}` : ''}
        </span>

        {/* Number */}
        <div className="relative mt-[clamp(4px,1.6cqh,16px)] flex w-full items-center">
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
            className="h-[clamp(30px,8cqh,56px)] w-full bg-transparent px-10 text-center text-[clamp(20px,5cqh,32px)] font-normal tracking-[0.01em] tabular-nums text-[var(--mp-text)] placeholder:text-[clamp(15px,3.2cqh,20px)] placeholder:text-[var(--mp-tertiary)] focus:outline-none"
          />
          {phone ? (
            <button
              type="button"
              aria-label={t('telephony.keypad.delete', 'Delete last digit')}
              title={t('telephony.keypad.delete', 'Delete last digit')}
              onClick={() => { onPhoneChange(phone.slice(0, -1)); inputRef.current?.focus() }}
              className="absolute right-0 grid h-9 w-9 place-items-center rounded-full text-[var(--mp-secondary)] transition-colors hover:bg-[var(--mp-control)]"
            >
              <Delete size={20} />
            </button>
          ) : null}
        </div>

        {/* Who is this number? */}
        <div className="mt-[clamp(2px,0.8cqh,8px)] h-[clamp(34px,11cqh,92px)] w-full overflow-hidden">
          {selectedLead ? (
            <div className="flex items-center gap-3 rounded-[14px] bg-[var(--mp-control)] px-3 py-2.5">
              <MacAvatar name={selectedLead.full_name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--mp-text)]">{selectedLead.full_name}</p>
                <p className="truncate text-[12px] text-[var(--mp-secondary)]">
                  {sourceLabel(selectedLead.crm_source)} · {selectedLead.status || t('telephony.keypad.no_status', 'No status')}
                </p>
              </div>
              {selectedPath ? (
                <Link
                  to={selectedPath}
                  title={t('telephony.open_lead', 'Open lead')}
                  aria-label={t('telephony.open_lead', 'Open lead')}
                  className="grid h-8 w-8 place-items-center rounded-full text-[var(--mp-blue)] hover:bg-[var(--mp-control-hover)]"
                >
                  <ExternalLink size={15} />
                </Link>
              ) : null}
            </div>
          ) : leads.length > 0 ? (
            <div className="mac-phone-scroll max-h-full overflow-y-auto rounded-[14px] bg-[var(--mp-control)] p-1">
              {leads.map((item) => (
                <button
                  type="button"
                  key={`${item.crm_source}-${item.customer_id}`}
                  onClick={() => onSelectLead(item)}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left text-[var(--mp-text)] hover:bg-[var(--mp-control-hover)]"
                >
                  <MacAvatar name={item.full_name} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{item.full_name}</span>
                    <span className="block truncate text-[11.5px] text-[var(--mp-secondary)]">{formatPhone(item.phone_number)}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--mp-secondary)]">{sourceLabel(item.crm_source)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={`pt-[clamp(4px,1.2cqh,12px)] text-center text-[12.5px] ${leadError ? 'text-[var(--mp-red)]' : 'text-[var(--mp-secondary)]'}`} role={leadError ? 'alert' : undefined}>
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
        <div className="mt-[clamp(6px,1.8cqh,16px)] grid grid-cols-3 justify-items-center gap-x-[min(calc(var(--mp-key)*0.36),26px)] gap-y-[calc(var(--mp-key)*0.2)]" data-i18n-skip="true">
          {keys.map(([digit, letters]) => (
            <button
              key={digit}
              type="button"
              onClick={() => press(digit)}
              aria-label={digit}
              className="flex flex-col items-center justify-center rounded-full bg-[var(--mp-key-bg)] text-[var(--mp-text)] transition-colors hover:bg-[var(--mp-control-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-blue)]/60"
              style={{ width: 'var(--mp-key)', height: 'var(--mp-key)' }}
            >
              <span className="leading-none font-normal" style={{ fontSize: 'calc(var(--mp-key) * 0.4)' }}>{digit}</span>
              {letters ? <span className="mt-0.5 font-semibold tracking-[0.2em] text-[var(--mp-secondary)]" style={{ fontSize: 'clamp(7px, calc(var(--mp-key) * 0.12), 9px)' }}>{letters}</span> : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCall}
          disabled={!canCall}
          aria-label={t('telephony.call', 'Call')}
          title={ready ? t('telephony.call', 'Call') : t('telephony.phone_state', 'Phone: {{state}}', { state: connectionLabel(connection) })}
          className="mt-[calc(var(--mp-key)*0.26)] grid place-items-center rounded-full bg-[var(--mp-green)] text-white shadow-[0_10px_24px_-10px_rgba(52,199,89,0.9)] transition hover:brightness-105 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          style={{ width: 'var(--mp-key)', height: 'var(--mp-key)' }}
        >
          <Phone fill="currentColor" strokeWidth={0} style={{ width: 'calc(var(--mp-key) * 0.36)', height: 'calc(var(--mp-key) * 0.36)' }} />
        </button>
      </div>
    </div>
  )
}
