import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Phone, PhoneOff, Mic, MicOff, ExternalLink, X, Save } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { Textarea } from '../../../shared/ui/textarea'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { leadPath, telephonyService } from '../../../shared/api/services/telephony.service'
import { useTelephony } from '../TelephonyContext'
import { formatDuration } from './telephonyFormat'

export function ActiveCallPanel() {
  const { call, lead, sessionStatus, sessionDirection, confirmedAt, muted, connection, error, answer, reject, hangup, toggleMute, clearCall } = useTelephony()
  const [now, setNow] = useState(Date.now())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  useEffect(() => {
    if (!confirmedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [confirmedAt])

  const visible = Boolean(call || sessionStatus)
  if (!visible || typeof document === 'undefined') return null

  const isIncoming = call?.direction === 'incoming' || (!call && sessionDirection === 'incoming')
  const ringing = isIncoming && (call?.status === 'ringing' || sessionStatus === 'ringing') && !confirmedAt
  const name = lead?.full_name || call?.customer_name || (isIncoming ? 'Incoming call' : 'Outgoing call')
  const number = lead?.phone_number || call?.phone_number || 'Unknown number'
  const path = leadPath(lead?.crm_source ?? call?.crm_source ?? null, lead?.customer_id ?? call?.customer_id ?? null)
  const seconds = confirmedAt ? Math.max(0, Math.floor((now - new Date(confirmedAt).getTime()) / 1000)) : 0

  async function saveNote() {
    if (!call?.id || !note.trim()) return
    setSaving(true)
    setNoteError(null)
    try {
      await telephonyService.addNote(call.id, note.trim())
      setNote('')
    } catch (cause) { setNoteError(getApiErrorMessage(cause)) }
    finally { setSaving(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/55 px-4 py-6" role="dialog" aria-modal="true" aria-label="Active phone call">
      <div className="w-full max-w-md overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-xl)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="ui-eyebrow">{isIncoming ? 'Incoming call' : 'Outgoing call'} · {connection}</p>
            <h2 className="mt-2 truncate text-xl font-bold text-[var(--foreground)]">{name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{number}</p>
          </div>
          {!sessionStatus && <button type="button" title="Close" aria-label="Close call" onClick={clearCall} className="text-[var(--muted)]"><X size={18} /></button>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {(lead?.crm_source || call?.crm_source) && <span className="rounded bg-[var(--input-surface)] px-2 py-1 font-semibold text-[var(--foreground)]">{(lead?.crm_source || call?.crm_source) === 'crm_outbound' ? 'Outbound CRM' : 'CRM'}</span>}
          {lead?.status && <span className="rounded bg-[var(--input-surface)] px-2 py-1 text-[var(--muted-strong)]">{lead.status}</span>}
          <span className="ml-auto tabular-nums text-lg font-semibold text-[var(--foreground)]">{formatDuration(seconds)}</span>
        </div>
        {path && <Link to={path} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--blue-text)] hover:underline"><ExternalLink size={14} /> Open lead</Link>}
        <div className="mt-5 flex flex-wrap gap-2">
          {ringing && <Button variant="success" onClick={answer} leftIcon={<Phone size={16} />} disabled={!sessionStatus}>Answer</Button>}
          {ringing && <Button variant="danger" onClick={reject} leftIcon={<PhoneOff size={16} />} disabled={!sessionStatus}>Reject</Button>}
          {!ringing && <Button variant="danger" onClick={hangup} leftIcon={<PhoneOff size={16} />} disabled={!sessionStatus}>Hang up</Button>}
          {!ringing && <Button variant="secondary" onClick={toggleMute} leftIcon={muted ? <MicOff size={16} /> : <Mic size={16} />} disabled={!sessionStatus}>{muted ? 'Unmute' : 'Mute'}</Button>}
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">{confirmedAt ? 'Connected' : sessionStatus === 'ringing' ? 'Ringing' : sessionStatus === 'connecting' ? 'Connecting' : 'Calling'}</p>
        {!sessionStatus && call && <p className="mt-2 text-xs text-[var(--muted)]">This call was restored after a page reload. Browser call controls are unavailable.</p>}
        {error && <p className="mt-2 text-sm text-[var(--danger-text)]" role="alert">{error}</p>}
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <label htmlFor="active-call-note" className="mb-2 block text-sm font-semibold text-[var(--foreground)]">Call note</label>
          <Textarea id="active-call-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note about this call" rows={3} />
          <Button size="sm" className="mt-2" leftIcon={<Save size={14} />} onClick={() => void saveNote()} disabled={!call?.id || !note.trim() || saving} loading={saving}>Save note</Button>
          {noteError && <p className="mt-2 text-xs text-[var(--danger-text)]" role="alert">{noteError}</p>}
        </div>
      </div>
    </div>, document.body,
  )
}
