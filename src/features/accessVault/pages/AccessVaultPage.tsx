import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowClockwiseIcon, PlusIcon } from '@phosphor-icons/react'
import { Eye, KeyRound, Lock, Pencil, ScrollText, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { accessVaultService, type VaultAuditEntry, type VaultItem, type VaultItemPayload } from '../../../shared/api/services/accessVault.service'
import { calendarService, type CalendarUser } from '../../../shared/api/services/calendar.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { cn } from '../../../shared/lib/cn'
import { formatNumericDateTime } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { HeaderActions } from '../../../widgets/navigation/HeaderActions'
import { useAuth } from '../../auth/hooks/useAuth'
import { VaultEditorDialog, type VaultEditorTarget } from '../components/VaultEditorDialog'
import { VaultItemCard } from '../components/VaultItemCard'
import { VAULT_CATEGORIES, categoryOf } from '../lib/categories'

const pill = 'min-h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--elev-pill)] hover:bg-[var(--input-surface)]'
/** An opened password hides itself after this long. */
const REVEAL_MS = 30_000

type Tab = 'items' | 'audit'

function serverMessage(error: unknown) {
  const detail = (error as { details?: { detail?: unknown } } | null)?.details?.detail
  return typeof detail === 'string' ? detail : undefined
}

const auditLook: Record<string, { icon: typeof Eye; tone: string }> = {
  reveal: { icon: Eye, tone: 'var(--primary)' },
  create: { icon: KeyRound, tone: 'var(--success)' },
  update: { icon: Pencil, tone: 'var(--warning)' },
  grants: { icon: UserPlus, tone: 'var(--violet-text)' },
  delete: { icon: Trash2, tone: 'var(--danger)' },
}

function auditKind(action: string) {
  const key = action.toLowerCase()
  if (key.includes('reveal') || key.includes('view') || key.includes('open')) return 'reveal'
  if (key.includes('grant') || key.includes('access')) return 'grants'
  if (key.includes('delete') || key.includes('remove')) return 'delete'
  if (key.includes('create') || key.includes('add')) return 'create'
  return 'update'
}

function AuditList({ entries, loading, showItem }: { entries: VaultAuditEntry[] | null; loading: boolean; showItem: boolean }) {
  const { t } = useLocale()
  const label = (kind: string) => ({
    reveal: t('vault.audit.reveal', 'Opened the password'),
    create: t('vault.audit.create', 'Added'),
    update: t('vault.audit.update', 'Changed'),
    grants: t('vault.audit.grants', 'Changed who has access'),
    delete: t('vault.audit.delete', 'Deleted'),
  }[kind] ?? kind)

  if (loading && !entries) return <p className="px-1 py-6 text-center text-[13px] text-[var(--muted)]">{t('common.loading', 'Loading...')}</p>
  if (!entries?.length) return <p className="px-1 py-6 text-center text-[13px] text-[var(--muted)]">{t('vault.audit.empty', 'Nothing has happened yet.')}</p>
  return (
    <ol className="divide-y divide-[var(--border)]">
      {entries.map((entry) => {
        const kind = auditKind(entry.action)
        const look = auditLook[kind]
        return (
          <li key={entry.id} className="flex items-start gap-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]" style={{ color: look.tone, background: `color-mix(in srgb, ${look.tone} 13%, transparent)` }}>
              <look.icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-[var(--foreground)]">
                <span className="font-semibold">{entry.userName ?? t('vault.audit.someone', 'Someone')}</span>{' '}
                <span className="text-[var(--muted-strong)]">{label(kind).toLowerCase()}</span>
                {showItem && entry.itemTitle ? <> · <span className="font-medium">{entry.itemTitle}</span></> : null}
              </p>
              {entry.purpose ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">“{entry.purpose}”</p> : null}
            </div>
            <span className="shrink-0 text-[11.5px] text-[var(--muted)] tabular-nums">{entry.at ? formatNumericDateTime(entry.at) : ''}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * /vault — every company password and access, kept in CIMS. Managers add accesses and choose who may
 * open each one; everyone else sees only what was given to them. Opening a password is logged.
 */
export function AccessVaultPage() {
  const { t } = useLocale()
  const { user, access, can } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const canManage = user?.role === 'CEO' || Boolean(access?.is_owner) || can('access_vault', 'create') || can('access_vault', 'edit')

  const [tab, setTab] = useState<Tab>('items')
  const [items, setItems] = useState<VaultItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<number, string>>({})
  const [revealing, setRevealing] = useState<number | null>(null)
  const timers = useRef(new Map<number, number>())
  const [people, setPeople] = useState<CalendarUser[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [editor, setEditor] = useState<VaultEditorTarget | null>(null)
  /** Grants saved or read (detail API) in this session — the list API does not return them, so the cards show these. */
  const [savedGrants, setSavedGrants] = useState<Record<number, number[]>>({})
  const rememberGrants = useCallback((itemId: number, userIds: number[]) => setSavedGrants((current) => ({ ...current, [itemId]: userIds })), [])
  const editorKey = editor ? `${editor.mode}-${editor.mode === 'create' ? 'new' : editor.item.id}` : 'closed'
  const [saving, setSaving] = useState(false)
  const [auditItem, setAuditItem] = useState<VaultItem | null>(null)
  const [audit, setAudit] = useState<VaultAuditEntry[] | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)

  useEffect(() => {
    let alive = true
    accessVaultService.list({ includeInactive: canManage })
      .then((list) => { if (alive) { setItems(list); setFailed(false) } })
      .catch(() => { if (alive) { setFailed(true); setItems((current) => current ?? []) } })
    return () => { alive = false }
  }, [canManage, version])

  // Everyone the manager can give access to.
  useEffect(() => {
    if (!canManage) return
    let alive = true
    setPeopleLoading(true)
    calendarService.users()
      .then((list) => { if (alive) setPeople(list) })
      .catch(() => undefined)
      .finally(() => { if (alive) setPeopleLoading(false) })
    return () => { alive = false }
  }, [canManage])

  // Full audit log tab, or one item's history in a dialog.
  useEffect(() => {
    if (tab !== 'audit' && !auditItem) return
    let alive = true
    setAuditLoading(true)
    setAudit(null)
    accessVaultService.audit(auditItem?.id, 200)
      .then((list) => { if (alive) setAudit(list) })
      .catch(() => { if (alive) setAudit([]) })
      .finally(() => { if (alive) setAuditLoading(false) })
    return () => { alive = false }
  }, [auditItem, tab, version])

  useEffect(() => {
    const map = timers.current
    return () => { for (const timer of map.values()) window.clearTimeout(timer) }
  }, [])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  const hide = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setRevealed((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }, [])

  async function reveal(item: VaultItem) {
    setRevealing(item.id)
    try {
      const { secret } = await accessVaultService.reveal(item.id)
      if (!secret) throw new Error('empty')
      setRevealed((current) => ({ ...current, [item.id]: secret }))
      window.clearTimeout(timers.current.get(item.id))
      timers.current.set(item.id, window.setTimeout(() => hide(item.id), REVEAL_MS))
    } catch (error) {
      showToast({ title: t('vault.reveal_failed', 'Could not open the password'), description: serverMessage(error) ?? t('vault.reveal_failed_text', 'You may not have access to it.'), tone: 'error' })
    } finally {
      setRevealing(null)
    }
  }

  async function save(payload: VaultItemPayload, grantees: number[]) {
    if (!editor) return
    setSaving(true)
    try {
      if (editor.mode === 'create') {
        const created = await accessVaultService.create({ ...payload, granted_user_ids: grantees })
        // Older backends ignore granted_user_ids on create — set them explicitly.
        if (created && grantees.length) await accessVaultService.setGrants(created.id, grantees).catch(() => undefined)
        if (created) setSavedGrants((current) => ({ ...current, [created.id]: grantees }))
        showToast({ title: t('vault.saved_new', 'Access saved'), description: payload.title, tone: 'success' })
      } else if (editor.mode === 'edit') {
        await accessVaultService.update(editor.item.id, payload)
        hide(editor.item.id)
        showToast({ title: t('vault.saved', 'Changes saved'), tone: 'success' })
      } else {
        await accessVaultService.setGrants(editor.item.id, grantees)
        setSavedGrants((current) => ({ ...current, [editor.item.id]: grantees }))
        showToast({ title: t('vault.grants_saved', 'Access updated'), description: t('vault.people_count', '{{count}} people', { count: grantees.length }), tone: 'success' })
      }
      setEditor(null)
      reload()
    } catch (error) {
      showToast({ title: t('vault.save_failed', 'Could not save'), description: serverMessage(error), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: VaultItem) {
    const ok = await confirm({
      title: t('vault.delete_title', 'Delete “{{title}}”?', { title: item.title }),
      description: t('vault.delete_text', 'The password is removed from CIMS for everyone. Its history stays in the access log.'),
      confirmLabel: t('common.delete', 'Delete'),
      cancelLabel: t('common.cancel', 'Cancel'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await accessVaultService.remove(item.id)
      setItems((list) => list?.filter((entry) => entry.id !== item.id) ?? list)
      showToast({ title: t('vault.deleted', 'Access deleted'), tone: 'success' })
    } catch (error) {
      showToast({ title: t('vault.delete_failed', 'Could not delete'), description: serverMessage(error), tone: 'error' })
    }
  }

  const needle = search.trim().toLowerCase()
  const counts = useMemo(() => {
    const out = new Map<string, number>()
    for (const item of items ?? []) out.set(categoryOf(item.category).value, (out.get(categoryOf(item.category).value) ?? 0) + 1)
    return out
  }, [items])
  const withGrants = useCallback((item: VaultItem): VaultItem => {
    const saved = item.granteesKnown ? undefined : savedGrants[item.id]
    if (!saved) return item
    return { ...item, granteesKnown: true, grantees: saved.map((id) => ({ id, name: people.find((person) => person.id === id)?.name ?? `#${id}` })) }
  }, [savedGrants, people])
  const visible = (items ?? []).map(withGrants).filter((item) =>
    (!category || categoryOf(item.category).value === category)
    && (!needle || [item.title, item.login, item.url, item.notes].some((value) => value?.toLowerCase().includes(needle))))
  const sharedCount = (items ?? []).map(withGrants).filter((item) => item.grantees.length > 0).length

  return (
    <section className="flex flex-col gap-4">
      <h1 className="sr-only">{t('vault.page.title', 'Passwords & accesses')}</h1>
      <HeaderActions>
        <Button variant="secondary" onClick={reload} className={cn(pill, 'w-11 px-0')} aria-label={t('common.refresh', 'Refresh')} title={t('common.refresh', 'Refresh')}>
          <ArrowClockwiseIcon size={17} />
        </Button>
        {canManage ? (
          <Button onClick={() => setEditor({ mode: 'create' })} leftIcon={<PlusIcon size={16} weight="bold" />} className="min-h-11 rounded-full px-5">
            {t('vault.new', 'New access')}
          </Button>
        ) : null}
      </HeaderActions>

      {/* summary */}
      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[var(--blue-dim)] text-[var(--primary)]"><ShieldCheck size={24} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold tracking-[-0.015em] text-[var(--foreground)]">{t('vault.page.title', 'Passwords & accesses')}</p>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--muted)]">
            {canManage
              ? t('vault.page.lead_manager', 'All company passwords in one place. Give each person only the accesses they need — every opening is logged.')
              : t('vault.page.lead_member', 'Accesses the company has shared with you. Opening a password is logged.')}
          </p>
        </div>
        <dl className="flex shrink-0 gap-5">
          <div><dt className="text-[11px] text-[var(--muted)]">{t('vault.stats.total', 'Accesses')}</dt><dd className="text-[20px] font-bold tracking-[-0.02em] text-[var(--foreground)] tabular-nums">{items?.length ?? '—'}</dd></div>
          {canManage ? <div><dt className="text-[11px] text-[var(--muted)]">{t('vault.stats.shared', 'Shared')}</dt><dd className="text-[20px] font-bold tracking-[-0.02em] text-[var(--foreground)] tabular-nums">{items ? sharedCount : '—'}</dd></div> : null}
        </dl>
      </div>

      {canManage ? (
        <div role="tablist" aria-label={t('vault.page.title', 'Passwords & accesses')} className="flex w-fit gap-1 rounded-[14px] bg-[var(--surface)] p-1 ring-1 ring-[var(--border)]">
          {([['items', KeyRound, t('vault.tabs.items', 'Accesses')], ['audit', ScrollText, t('vault.tabs.audit', 'Access log')]] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold transition-colors', tab === key ? 'bg-[var(--surface-inverse)] text-white' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]')}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'audit' ? (
        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2">
          <AuditList entries={audit} loading={auditLoading} showItem />
        </div>
      ) : (
        <>
          {/* search + categories */}
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <label className="flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 lg:w-[300px]">
              <Search size={15} className="shrink-0 text-[var(--caption)]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('vault.search', 'Search by name, login or link')} aria-label={t('vault.search', 'Search by name, login or link')} className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--foreground)] placeholder:text-[var(--caption)] focus:outline-none" />
            </label>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              <button type="button" onClick={() => setCategory(null)} aria-pressed={category === null} className={cn('h-9 shrink-0 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors', category === null ? 'border-transparent bg-[var(--surface-inverse)] text-white' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] hover:text-[var(--foreground)]')}>
                {t('common.all', 'All')} <span className="ml-0.5 opacity-70 tabular-nums">{items?.length ?? 0}</span>
              </button>
              {VAULT_CATEGORIES.filter((entry) => counts.get(entry.value)).map((entry) => (
                <button key={entry.value} type="button" onClick={() => setCategory(category === entry.value ? null : entry.value)} aria-pressed={category === entry.value} className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors', category === entry.value ? 'border-transparent bg-[var(--surface-inverse)] text-white' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] hover:text-[var(--foreground)]')}>
                  <entry.icon size={13} style={category === entry.value ? undefined : { color: entry.color }} />
                  {t(entry.labelKey, entry.fallback)} <span className="opacity-70 tabular-nums">{counts.get(entry.value)}</span>
                </button>
              ))}
            </div>
          </div>

          {items === null ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[188px] animate-pulse rounded-[18px] bg-[var(--muted-surface)]" />)}
            </div>
          ) : failed && !items.length ? (
            <div className="grid place-items-center rounded-[18px] border border-dashed border-[var(--border-hover)] bg-[var(--card)] px-6 py-14 text-center">
              <p className="text-[15px] font-semibold text-[var(--foreground)]">{t('vault.failed', 'Could not load the accesses')}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>{t('common.retry', 'Retry')}</Button>
            </div>
          ) : !visible.length ? (
            <div className="grid place-items-center rounded-[18px] border border-dashed border-[var(--border-hover)] bg-[var(--card)] px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-[var(--muted-surface)] text-[var(--muted-strong)]"><Lock size={24} /></span>
              <p className="mt-4 text-[15px] font-semibold text-[var(--foreground)]">
                {items.length ? t('vault.empty_filtered', 'Nothing matches the search') : canManage ? t('vault.empty_manager', 'No accesses yet') : t('vault.empty_member', 'Nothing has been shared with you yet')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] text-[var(--muted)]">
                {items.length ? null : canManage ? t('vault.empty_manager_text', 'Add servers, social accounts, hosting and other passwords, then choose who may open each one.') : t('vault.empty_member_text', 'Ask a manager to give you the access you need.')}
              </p>
              {canManage && !items.length ? <Button className="mt-4" leftIcon={<PlusIcon size={15} weight="bold" />} onClick={() => setEditor({ mode: 'create' })}>{t('vault.new', 'New access')}</Button> : null}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => (
                <VaultItemCard
                  key={item.id}
                  item={item}
                  secret={revealed[item.id] ?? null}
                  revealing={revealing === item.id}
                  canManage={canManage && item.canManage}
                  onReveal={() => void reveal(item)}
                  onHide={() => hide(item.id)}
                  onCopySecret={() => showToast({ title: t('vault.copied', 'Password copied'), tone: 'success' })}
                  onEdit={() => setEditor({ mode: 'edit', item })}
                  onGrants={() => setEditor({ mode: 'grants', item })}
                  onAudit={() => setAuditItem(item)}
                  onDelete={() => void remove(item)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <VaultEditorDialog key={editorKey} target={editor} people={people} peopleLoading={peopleLoading} saving={saving} onClose={() => setEditor(null)} onSave={(payload, grantees) => void save(payload, grantees)} onGrantsLoaded={rememberGrants} />

      <Dialog
        open={auditItem !== null}
        onClose={() => setAuditItem(null)}
        size="lg"
        headerIcon={<ScrollText />}
        title={t('vault.audit.item_title', 'History of “{{title}}”', { title: auditItem?.title ?? '' })}
        description={t('vault.audit.item_description', 'Who opened or changed this access, and when.')}
      >
        <AuditList entries={audit} loading={auditLoading} showItem={false} />
      </Dialog>
    </section>
  )
}
