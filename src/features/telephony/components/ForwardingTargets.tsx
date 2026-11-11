import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Hash, Loader2, Pencil, Phone, Plus, Trash2, X } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import {
  normalizePhone, telephonyService,
  type ForwardingMode, type ForwardingTarget, type ForwardingTargetPayload, type ForwardingTargetType,
} from '../../../shared/api/services/telephony.service'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { Switch } from '../../../shared/ui/switch'
import { formatPhone } from './telephonyFormat'

const modes: ForwardingMode[] = ['always', 'busy', 'no_answer', 'offline']

type Draft = { mode: ForwardingMode; target_type: ForwardingTargetType; target: string; timeout: string }
const emptyDraft: Draft = { mode: 'always', target_type: 'phone', target: '', timeout: '20' }

const byPosition = (left: ForwardingTarget, right: ForwardingTarget) => left.position - right.position || left.id - right.id

/** The forwarding targets of one extension — any number; saved one by one through their own endpoints. */
export function ForwardingTargets({ userId, initial, disabled }: { userId: number; initial?: ForwardingTarget[]; disabled?: boolean }) {
  const { t } = useLocale()
  const [targets, setTargets] = useState<ForwardingTarget[]>(() => [...(initial ?? [])].sort(byPosition))
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | 'new' | null>(null)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void telephonyService.forwardingTargets(userId)
      .then((list) => { if (active) setTargets([...list].sort(byPosition)) })
      .catch((cause: unknown) => { if (active) setError(getApiErrorMessage(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId])

  const modeLabel: Record<ForwardingMode, string> = {
    always: t('telephony.forwarding.always', 'Always forwarded'),
    busy: t('telephony.forwarding.busy', 'Forward when busy'),
    no_answer: t('telephony.forwarding.no_answer', 'Forward if no answer'),
    offline: t('telephony.forwarding.offline', 'Forward when offline'),
  }

  function startEdit(target: ForwardingTarget | null) {
    setError(null)
    setEditingId(target ? target.id : 'new')
    setDraft(target ? { mode: target.mode, target_type: target.target_type, target: target.target, timeout: String(target.timeout_seconds) } : emptyDraft)
  }

  async function run(id: number | 'new', action: () => Promise<void>) {
    setBusyId(id)
    setError(null)
    try { await action() } catch (cause) { setError(getApiErrorMessage(cause)) } finally { setBusyId(null) }
  }

  function payloadOf(value: Draft): ForwardingTargetPayload | null {
    const target = value.target_type === 'phone' ? normalizePhone(value.target) : value.target.trim()
    const timeout = Number(value.timeout)
    if (target.length < 3 || target.length > 32) { setError(t('telephony.ext_settings.need_target', 'Enter where calls are forwarded.')); return null }
    if (!(timeout >= 5 && timeout <= 60)) { setError(t('telephony.ext_settings.bad_timeout', 'Ring time must be 5–60 seconds.')); return null }
    return { mode: value.mode, target_type: value.target_type, target, timeout_seconds: timeout }
  }

  function saveDraft() {
    const payload = payloadOf(draft)
    if (!payload || editingId === null) return
    if (editingId === 'new') {
      void run('new', async () => {
        const created = await telephonyService.addForwardingTarget(userId, { ...payload, enabled: true, position: (targets.at(-1)?.position ?? 0) + 1 })
        setTargets((current) => [...current, created].sort(byPosition))
        setEditingId(null)
      })
    } else {
      const id = editingId
      void run(id, async () => {
        const updated = await telephonyService.updateForwardingTarget(userId, id, payload)
        setTargets((current) => current.map((item) => (item.id === id ? { ...item, ...payload, ...updated } : item)).sort(byPosition))
        setEditingId(null)
      })
    }
  }

  function toggle(target: ForwardingTarget, enabled: boolean) {
    void run(target.id, async () => {
      const updated = await telephonyService.updateForwardingTarget(userId, target.id, { enabled })
      setTargets((current) => current.map((item) => (item.id === target.id ? { ...item, ...updated, enabled } : item)))
    })
  }

  function remove(target: ForwardingTarget) {
    void run(target.id, async () => {
      await telephonyService.deleteForwardingTarget(userId, target.id)
      setTargets((current) => current.filter((item) => item.id !== target.id))
    })
  }

  /** Swap positions with the neighbour (two PATCHes). */
  function move(index: number, delta: -1 | 1) {
    const a = targets[index]
    const b = targets[index + delta]
    if (!a || !b) return
    const posA = a.position === b.position ? index + 1 : a.position
    const posB = a.position === b.position ? index + 1 + delta : b.position
    void run(a.id, async () => {
      await Promise.all([
        telephonyService.updateForwardingTarget(userId, a.id, { position: posB }),
        telephonyService.updateForwardingTarget(userId, b.id, { position: posA }),
      ])
      setTargets((current) => current.map((item) => (item.id === a.id ? { ...item, position: posB } : item.id === b.id ? { ...item, position: posA } : item)).sort(byPosition))
    })
  }

  const editor = (
    <div className="grid gap-2.5 rounded-[12px] border border-[var(--blue-border)] bg-[var(--surface)] p-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-[var(--muted-strong)]">{t('telephony.ext_settings.when', 'When')}</span>
        <SelectField size="sm" value={draft.mode} onValueChange={(value) => setDraft((current) => ({ ...current, mode: value as ForwardingMode }))} options={modes.map((value) => ({ value, label: modeLabel[value] }))} aria-label={t('telephony.ext_settings.when', 'When')} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-[var(--muted-strong)]">{t('telephony.ext_settings.target_type', 'Forward to')}</span>
        <SelectField
          size="sm"
          value={draft.target_type}
          onValueChange={(value) => setDraft((current) => ({ ...current, target_type: value as ForwardingTargetType }))}
          options={[
            { value: 'phone', label: t('telephony.ext_settings.to_phone', 'Phone number') },
            { value: 'extension', label: t('telephony.ext_settings.to_extension', 'Another extension') },
          ]}
          aria-label={t('telephony.ext_settings.target_type', 'Forward to')}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-[var(--muted-strong)]">{draft.target_type === 'phone' ? t('telephony.ext_settings.to_phone', 'Phone number') : t('telephony.ext_settings.to_extension', 'Another extension')}</span>
        <Input value={draft.target} onChange={(event) => setDraft((current) => ({ ...current, target: event.target.value }))} inputMode={draft.target_type === 'phone' ? 'tel' : 'numeric'} placeholder={draft.target_type === 'phone' ? '+998901234567' : '102'} autoFocus />
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-[var(--muted-strong)]">{t('telephony.ext_settings.timeout', 'Ring for (seconds)')}</span>
        <Input type="number" min={5} max={60} value={draft.timeout} onChange={(event) => setDraft((current) => ({ ...current, timeout: event.target.value }))} />
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={() => setEditingId(null)} className="h-8 rounded-[9px] px-3 text-[13px] font-medium text-[var(--muted-strong)] hover:bg-[var(--input-surface)]">{t('common.cancel', 'Cancel')}</button>
        <button type="button" onClick={saveDraft} disabled={busyId !== null} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50">
          {busyId === editingId ? <Loader2 size={13} className="animate-spin" /> : null}
          {editingId === 'new' ? t('common.add', 'Add') : t('common.save', 'Save')}
        </button>
      </div>
    </div>
  )

  return (
    <div className={cn('space-y-2', disabled && 'opacity-60')}>
      {loading && targets.length === 0 ? (
        <span className="skeleton block h-12 rounded-[12px]" />
      ) : targets.length === 0 && editingId !== 'new' ? (
        <p className="rounded-[12px] border border-dashed border-[var(--border-hover)] px-3.5 py-3 text-center text-[12.5px] text-[var(--muted)]">{t('telephony.targets.empty', 'No forwarding numbers yet.')}</p>
      ) : null}

      <ul className="space-y-1.5">
        {targets.map((target, index) => (
          <li key={target.id}>
            {editingId === target.id ? editor : (
              <div className="flex items-center gap-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[10px]', target.enabled ? 'bg-[var(--blue-dim)] text-[var(--blue-text)]' : 'bg-[var(--input-surface)] text-[var(--muted)]')}>
                  {target.target_type === 'phone' ? <Phone size={14} /> : <Hash size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13.5px] font-semibold tabular-nums', target.enabled ? 'text-[var(--foreground)]' : 'text-[var(--muted)] line-through')}>
                    {target.target_type === 'phone' ? formatPhone(target.target) : t('telephony.ext', 'Ext {{ext}}', { ext: target.target })}
                  </span>
                  <span className="block truncate text-[11.5px] text-[var(--muted)]">
                    {modeLabel[target.mode] ?? target.mode} · {t('telephony.targets.seconds', '{{count}} s', { count: target.timeout_seconds })}
                  </span>
                </span>
                {busyId === target.id ? <Loader2 size={14} className="animate-spin text-[var(--muted)]" /> : null}
                <span className="flex shrink-0 items-center">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0 || busyId !== null} aria-label={t('grid.move_up', 'Move up')} className="grid h-7 w-6 place-items-center rounded-[7px] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"><ArrowUp size={13} /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === targets.length - 1 || busyId !== null} aria-label={t('grid.move_down', 'Move down')} className="grid h-7 w-6 place-items-center rounded-[7px] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"><ArrowDown size={13} /></button>
                  <button type="button" onClick={() => startEdit(target)} disabled={busyId !== null} aria-label={t('common.edit', 'Edit')} className="grid h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--primary)]"><Pencil size={13} /></button>
                  <button type="button" onClick={() => remove(target)} disabled={busyId !== null} aria-label={t('common.delete', 'Delete')} className="grid h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]"><Trash2 size={13} /></button>
                </span>
                <Switch size="sm" checked={target.enabled} disabled={busyId !== null} onChange={(value) => toggle(target, value)} label={t('telephony.targets.toggle', 'Forward to this number')} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {editingId === 'new' ? editor : (
        <button type="button" onClick={() => startEdit(null)} disabled={busyId !== null} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-dashed border-[var(--border-hover)] px-3 text-[13px] font-semibold text-[var(--primary)] hover:bg-[var(--blue-dim)] disabled:opacity-50">
          <Plus size={15} /> {t('telephony.targets.add', 'Add number')}
        </button>
      )}

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-[12px] bg-[var(--danger-dim)] px-3 py-2 text-[12.5px] text-[var(--danger-text)]">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label={t('common.close', 'Close')}><X size={13} /></button>
        </p>
      ) : null}
    </div>
  )
}
