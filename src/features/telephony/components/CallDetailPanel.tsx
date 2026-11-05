import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Save, X } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { Textarea } from '../../../shared/ui/textarea'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { leadPath, telephonyService, type TelephonyCallDetail } from '../../../shared/api/services/telephony.service'
import { formatCallDate, formatDuration, statusLabel, statusTone } from './telephonyFormat'
import { RecordingPlayer } from './RecordingPlayer'

export function CallDetailPanel({ callId, onClose }: { callId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<TelephonyCallDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void telephonyService.call(callId).then((result) => { if (active) setDetail(result) })
      .catch((cause: unknown) => { if (active) setError(getApiErrorMessage(cause)) })
    return () => { active = false }
  }, [callId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function saveNote() {
    if (!note.trim()) return
    setSaving(true)
    setError(null)
    try {
      await telephonyService.addNote(callId, note.trim())
      setDetail(await telephonyService.call(callId))
      setNote('')
    } catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { setSaving(false) }
  }

  const path = detail ? leadPath(detail.lead?.crm_source ?? detail.crm_source, detail.lead?.customer_id ?? detail.customer_id) : null

  return (
    <div className="fixed inset-0 z-[125]" role="dialog" aria-modal="true" aria-label="Call details">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close call details" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-[var(--surface)] shadow-[var(--elev-xl)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <div><p className="ui-eyebrow">Call #{callId}</p><h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">Call details</h2></div>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-[var(--muted)]"><X size={19} /></button>
        </div>
        <div className="space-y-6 p-5">
          {error && <p role="alert" className="text-sm text-[var(--danger-text)]">{error}</p>}
          {!detail && !error && <p className="text-sm text-[var(--muted)]">Loading call...</p>}
          {detail && <>
            <section className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-[var(--border)] pb-5 text-sm">
              <div className="col-span-2"><p className="text-xs text-[var(--muted)]">Customer</p><p className="mt-1 font-semibold text-[var(--foreground)]">{detail.lead?.full_name || detail.customer_name || 'Unknown customer'}</p></div>
              <div><p className="text-xs text-[var(--muted)]">Phone</p><p className="mt-1 text-[var(--foreground)]">{detail.phone_number}</p></div>
              <div><p className="text-xs text-[var(--muted)]">Status</p><span className={`mt-1 inline-flex rounded px-2 py-0.5 text-xs font-semibold ${statusTone(detail.status)}`}>{statusLabel(detail.status)}</span></div>
              <div><p className="text-xs text-[var(--muted)]">Direction</p><p className="mt-1 capitalize text-[var(--foreground)]">{detail.direction}</p></div>
              <div><p className="text-xs text-[var(--muted)]">Talk time</p><p className="mt-1 tabular-nums text-[var(--foreground)]">{formatDuration(detail.talk_seconds)}</p></div>
              <div><p className="text-xs text-[var(--muted)]">Started</p><p className="mt-1 text-[var(--foreground)]">{formatCallDate(detail.started_at)}</p></div>
              <div><p className="text-xs text-[var(--muted)]">Seller</p><p className="mt-1 text-[var(--foreground)]">{detail.user_name || '-'}</p></div>
              {detail.hangup_cause && <div className="col-span-2"><p className="text-xs text-[var(--muted)]">Hangup cause</p><p className="mt-1 text-[var(--foreground)]">{detail.hangup_cause}</p></div>}
              {path && <Link to={path} onClick={onClose} className="col-span-2 inline-flex items-center gap-1.5 font-semibold text-[var(--blue-text)] hover:underline"><ExternalLink size={14} /> Open lead</Link>}
            </section>
            {detail.has_recording && <section className="border-b border-[var(--border)] pb-5"><h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Recording</h3><RecordingPlayer callId={callId} /></section>}
            <section><h3 className="text-sm font-semibold text-[var(--foreground)]">Notes</h3>
              <div className="mt-3 space-y-3">{detail.notes?.length ? detail.notes.map((item) => <div key={item.id} className="border-b border-[var(--border)] pb-3"><p className="whitespace-pre-wrap text-sm text-[var(--foreground)]">{item.note}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.created_by_name || 'User'} · {formatCallDate(item.created_at)}</p></div>) : <p className="text-sm text-[var(--muted)]">No notes yet.</p>}</div>
              <label htmlFor="call-detail-note" className="mt-5 mb-2 block text-xs font-semibold text-[var(--muted)]">Add note</label>
              <Textarea id="call-detail-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write a call note" />
              <Button className="mt-2" size="sm" leftIcon={<Save size={14} />} disabled={!note.trim() || saving} loading={saving} onClick={() => void saveNote()}>Save note</Button>
            </section>
          </>}
        </div>
      </div>
    </div>
  )
}
