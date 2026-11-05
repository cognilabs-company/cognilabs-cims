import { useEffect, useMemo, useState } from 'react'
import { HardDrive, RefreshCw, Search } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { ceoService, type CeoUserRecord } from '../../../shared/api/services/ceo.service'
import { telephonyService, type RecordingStorage, type TelephonyExtension } from '../../../shared/api/services/telephony.service'

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return '-'
  const unit = value >= 1024 ** 3 ? 'GB' : 'MB'
  return `${(value / (unit === 'GB' ? 1024 ** 3 : 1024 ** 2)).toFixed(1)} ${unit}`
}

export function CeoTelephonyPanel() {
  const [storage, setStorage] = useState<RecordingStorage | null>(null)
  const [serviceStatus, setServiceStatus] = useState<Record<string, unknown> | null>(null)
  const [extensions, setExtensions] = useState<TelephonyExtension[]>([])
  const [users, setUsers] = useState<CeoUserRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [newUserId, setNewUserId] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    void Promise.allSettled([telephonyService.storage(), telephonyService.status(), telephonyService.extensions(), ceoService.getDashboard()])
      .then(([storageResult, statusResult, extensionsResult, usersResult]) => {
        if (!active) return
        if (storageResult.status === 'fulfilled') setStorage(storageResult.value)
        if (statusResult.status === 'fulfilled') setServiceStatus(statusResult.value)
        if (extensionsResult.status === 'fulfilled') setExtensions(Array.isArray(extensionsResult.value) ? extensionsResult.value : extensionsResult.value.items)
        if (usersResult.status === 'fulfilled') setUsers(usersResult.value.users)
        const failure = [storageResult, statusResult, extensionsResult, usersResult].find((result) => result.status === 'rejected')
        setError(failure?.status === 'rejected' ? getApiErrorMessage(failure.reason) : null)
      })
    return () => { active = false }
  }, [version])

  const visible = useMemo(() => extensions.filter((item) => {
    if (filter === 'active' && !item.is_active) return false
    if (filter === 'inactive' && item.is_active) return false
    const text = `${item.user_name ?? ''} ${item.user_id} ${item.extension ?? ''}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  }), [extensions, filter, query])
  const availableUsers = useMemo(() => users.filter((item) =>
    ['seller', 'ceo'].includes(String(item.role).toLowerCase()) && !extensions.some((extension) => extension.user_id === item.id),
  ), [users, extensions])

  async function createExtension() {
    const userId = Number(newUserId)
    if (!Number.isInteger(userId) || userId <= 0) return
    setBusyId(userId)
    try { await telephonyService.createExtension(userId); setNewUserId(''); setVersion((value) => value + 1) }
    catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { setBusyId(null) }
  }

  async function toggleExtension(item: TelephonyExtension) {
    setBusyId(item.user_id)
    try { await telephonyService.updateExtension(item.user_id, !item.is_active); setVersion((value) => value + 1) }
    catch (cause) { setError(getApiErrorMessage(cause)) }
    finally { setBusyId(null) }
  }

  const percent = storage?.used_percent ?? 0
  const tone = percent >= 90 ? 'text-[var(--danger-text)]' : percent >= 80 ? 'text-amber-600 dark:text-amber-300' : 'text-[var(--success-text)]'
  const statusFields = serviceStatus ? Object.entries(serviceStatus).filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') : []

  return <section className="border-t border-[var(--border)] pt-7">
    <div className="mb-5 flex items-center justify-between"><h2 className="text-base font-semibold text-[var(--foreground)]">Phone system</h2><Button size="sm" variant="secondary" title="Refresh phone system" leftIcon={<RefreshCw size={15} />} onClick={() => setVersion((value) => value + 1)}>Refresh</Button></div>
    {error && <p role="alert" className="mb-4 text-sm text-[var(--danger-text)]">{error}</p>}
    <div className="grid gap-6 border-b border-[var(--border)] pb-6 md:grid-cols-2">
      <div><p className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]"><HardDrive size={15} /> Recording storage</p><p className={`mt-2 text-xl font-bold ${tone}`}>{storage ? `${percent >= 90 ? 'Critical · ' : percent >= 80 ? 'Warning · ' : ''}${percent.toFixed(1)}% used` : 'Loading...'}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--input-surface)]"><div className={`h-full ${percent >= 90 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, percent)}%` }} /></div><p className="mt-2 text-xs text-[var(--muted)]">{storage ? `${formatBytes(storage.used_bytes)} of ${formatBytes(storage.total_bytes)} · ${storage.recording_count} recordings` : 'Storage data unavailable.'}</p></div>
      <div><p className="text-xs font-semibold text-[var(--muted)]">Service status</p>{statusFields.length ? <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">{statusFields.map(([key, value]) => <div key={key}><dt className="text-xs capitalize text-[var(--muted)]">{key.replaceAll('_', ' ')}</dt><dd className="truncate font-medium text-[var(--foreground)]">{String(value)}</dd></div>)}</dl> : <p className="mt-2 text-sm text-[var(--muted)]">No status data available.</p>}</div>
    </div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-[var(--foreground)]">Extensions</h3><div className="flex flex-wrap gap-2"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><Input aria-label="Search extensions" className="min-w-[200px] pl-9" placeholder="Name or extension" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="min-w-[135px]"><SelectField value={filter} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} onValueChange={setFilter} /></div></div></div>
    <div className="mt-3 flex flex-wrap gap-2"><div className="min-w-[220px] max-w-[320px] flex-1"><SelectField value={newUserId} searchable searchPlaceholder="Search seller or CEO" placeholder="Select user" options={availableUsers.map((item) => ({ value: String(item.id), label: `${item.name} ${item.surname}`.trim() || item.email }))} onValueChange={setNewUserId} /></div><Button size="sm" onClick={() => void createExtension()} disabled={!Number.isInteger(Number(newUserId)) || Number(newUserId) <= 0 || busyId !== null}>Create extension</Button></div>
    <div className="mt-3 overflow-x-auto border-t border-[var(--border)]"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="px-3 py-3">User</th><th className="px-3 py-3">Extension</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody>{visible.map((item) => <tr key={item.user_id} className="border-b border-[var(--border)]"><td className="px-3 py-3 font-medium text-[var(--foreground)]">{item.user_name || `User #${item.user_id}`}</td><td className="px-3 py-3 text-[var(--muted-strong)]">{item.extension || '-'}</td><td className="px-3 py-3 text-[var(--muted-strong)]">{item.is_active ? 'Active' : 'Inactive'}</td><td className="px-3 py-3 text-right"><Button size="sm" variant="secondary" disabled={busyId === item.user_id} onClick={() => void toggleExtension(item)}>{item.is_active ? 'Disable' : 'Enable'}</Button></td></tr>)}</tbody></table>{visible.length === 0 && <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">No matching extensions.</p>}</div>
  </section>
}
