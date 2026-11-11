import { useEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Delete, ExternalLink, Phone, Search } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { leadPath, normalizePhone, type TelephonyLead } from '../../../shared/api/services/telephony.service'
import { MacAvatar } from './MacPrimitives'
import { connectionLabel, formatPhone, sourceLabel } from './telephonyFormat'

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

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

/** Keypad in the right pane of the Calls page. Sizes follow the pane (container units), so it never scrolls. */
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] bg-[var(--surface)] ring-1 ring-[var(--border)] [container-type:size]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex h-9 items-center gap-1 rounded-[11px] pr-3 pl-1.5 text-[13.5px] font-medium text-[var(--foreground)] hover:bg-[var(--input-surface)]">
            <ChevronLeft size={18} /> {t('telephony.back', 'Back')}
          </button>
        ) : (
          <p className="px-1.5 text-[14px] font-semibold text-[var(--foreground)]">{t('telephony.dial', 'Dial a number')}</p>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--input-surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--muted-strong)]">
          <span className={cn('h-1.5 w-1.5 rounded-full', ready ? 'bg-[var(--success)]' : /connect/i.test(connection) ? 'bg-[var(--warning)]' : 'bg-[var(--danger)]')} />
          {connectionLabel(connection)}{extension ? ` · ${t('telephony.ext', 'Ext {{ext}}', { ext: extension })}` : ''}
        </span>
      </div>

      <div
        className="mx-auto flex min-h-0 w-full max-w-[340px] flex-1 flex-col justify-center px-5 py-[clamp(8px,2.4cqh,22px)]"
        style={{ '--key-h': 'clamp(36px, calc((100cqh - 360px) / 4), 66px)' } as CSSProperties}
      >
        {/* number */}
        <div className="relative flex items-center rounded-[16px] bg-[var(--muted-surface)] ring-1 ring-[var(--border)] focus-within:ring-2 focus-within:ring-[var(--primary)]">
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
            className="h-[clamp(44px,9cqh,60px)] w-full bg-transparent px-12 text-center text-[clamp(19px,4.2cqh,26px)] font-semibold tracking-[0.02em] tabular-nums text-[var(--foreground)] placeholder:text-[15px] placeholder:font-normal placeholder:text-[var(--caption)] focus:outline-none"
          />
          {phone ? (
            <button
              type="button"
              aria-label={t('telephony.keypad.delete', 'Delete last digit')}
              title={t('telephony.keypad.delete', 'Delete last digit')}
              onClick={() => { onPhoneChange(phone.slice(0, -1)); inputRef.current?.focus() }}
              className="absolute right-2 grid h-9 w-9 place-items-center rounded-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--input-surface-hover)] hover:text-[var(--foreground)]"
            >
              <Delete size={19} />
            </button>
          ) : null}
        </div>

        {/* who is this number? */}
        <div className="mt-2 h-[clamp(40px,12cqh,96px)] overflow-hidden">
          {selectedLead ? (
            <div className="flex items-center gap-3 rounded-[14px] bg-[var(--blue-dim)] px-3 py-2.5">
              <MacAvatar name={selectedLead.full_name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--foreground)]">{selectedLead.full_name}</p>
                <p className="truncate text-[12px] text-[var(--muted-strong)]">
                  {sourceLabel(selectedLead.crm_source)} · {selectedLead.status || t('telephony.keypad.no_status', 'No status')}
                </p>
              </div>
              {selectedPath ? (
                <Link to={selectedPath} title={t('telephony.open_lead', 'Open lead')} aria-label={t('telephony.open_lead', 'Open lead')} className="grid h-8 w-8 place-items-center rounded-[10px] text-[var(--blue-text)] hover:bg-[var(--blue-soft)]">
                  <ExternalLink size={15} />
                </Link>
              ) : null}
            </div>
          ) : leads.length > 0 ? (
            <div className="calls-scroll max-h-full overflow-y-auto rounded-[14px] bg-[var(--muted-surface)] p-1 ring-1 ring-[var(--border)]">
              {leads.map((item) => (
                <button
                  type="button"
                  key={`${item.crm_source}-${item.customer_id}`}
                  onClick={() => onSelectLead(item)}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left text-[var(--foreground)] hover:bg-[var(--row-hover)]"
                >
                  <MacAvatar name={item.full_name} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{item.full_name}</span>
                    <span className="block truncate text-[11.5px] text-[var(--muted)]">{formatPhone(item.phone_number)}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--muted)]">{sourceLabel(item.crm_source)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={cn('flex items-center justify-center gap-1.5 pt-2 text-center text-[12.5px]', leadError ? 'text-[var(--danger-text)]' : 'text-[var(--muted)]')} role={leadError ? 'alert' : undefined}>
              {!leadError ? <Search size={13} /> : null}
              {leadError
                ?? (searching
                  ? t('telephony.keypad.searching', 'Searching leads…')
                  : digits.length >= 4
                    ? t('telephony.keypad.no_leads', 'No matching leads')
                    : t('telephony.keypad.hint', 'Type a number or the last 4 digits'))}
            </p>
          )}
        </div>

        {/* keys */}
        <div className="mt-[clamp(4px,1.4cqh,12px)] grid grid-cols-3 gap-2" data-i18n-skip="true">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              aria-label={key}
              className="grid place-items-center rounded-[16px] bg-[var(--input-surface)] text-[var(--foreground)] transition-[background-color,transform] hover:bg-[var(--input-surface-hover)] active:scale-[0.97] active:bg-[var(--blue-dim)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:outline-none"
              style={{ height: 'var(--key-h)' }}
            >
              <span className="leading-none font-semibold" style={{ fontSize: 'clamp(17px, calc(var(--key-h) * 0.38), 24px)' }}>{key}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCall}
          disabled={!canCall}
          title={ready ? t('telephony.call', 'Call') : t('telephony.phone_state', 'Phone: {{state}}', { state: connectionLabel(connection) })}
          className="mt-3 inline-flex shrink-0 items-center justify-center gap-2 rounded-[16px] bg-[var(--success)] text-[15px] font-semibold text-white shadow-[0_12px_26px_-14px_rgba(23,146,74,0.9)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          style={{ height: 'clamp(42px, calc(var(--key-h) * 0.9), 54px)' }}
        >
          <Phone size={18} fill="currentColor" strokeWidth={0} /> {t('telephony.call', 'Call')}
        </button>
      </div>
    </div>
  )
}
