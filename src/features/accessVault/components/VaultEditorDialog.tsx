import { useEffect, useState, type ReactNode } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { CalendarUser } from '../../../shared/api/services/calendar.service'
import { accessVaultService, type VaultItem, type VaultItemPayload } from '../../../shared/api/services/accessVault.service'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { SelectField } from '../../../shared/ui/select-field'
import { Textarea } from '../../../shared/ui/textarea'
import { VAULT_CATEGORIES, generatePassword } from '../lib/categories'
import { PeoplePicker } from './PeoplePicker'

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[12.5px] font-medium text-[var(--muted-strong)]">
        {label}{required ? <span className="text-[var(--danger-text)]"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-[11.5px] text-[var(--muted)]">{hint}</span> : null}
    </label>
  )
}

export type VaultEditorTarget = { mode: 'create' } | { mode: 'edit'; item: VaultItem } | { mode: 'grants'; item: VaultItem }

/**
 * New access / edit / "who has access" — one dialog. When editing, the secret field stays empty and
 * the old secret is kept unless a new one is typed.
 */
export function VaultEditorDialog({ target, people, peopleLoading, saving, onClose, onSave, onGrantsLoaded }: {
  target: VaultEditorTarget | null
  people: CalendarUser[]
  peopleLoading: boolean
  saving: boolean
  onClose: () => void
  onSave: (payload: VaultItemPayload, grantees: number[]) => void
  /** The current grants read from the detail API, so the page can show them on the card too. */
  onGrantsLoaded?: (itemId: number, userIds: number[]) => void
}) {
  const { t } = useLocale()
  const item = target && target.mode !== 'create' ? target.item : null
  // The page mounts a fresh dialog for every target (key), so the form starts from the item.
  const [title, setTitle] = useState(item?.title ?? '')
  const [category, setCategory] = useState(item?.category ?? 'server')
  const [url, setUrl] = useState(item?.url ?? '')
  const [login, setLogin] = useState(item?.login ?? '')
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [grantees, setGrantees] = useState<number[]>(() => item?.grantees.map((person) => person.id) ?? [])
  const [submitted, setSubmitted] = useState(false)

  const onlyGrants = target?.mode === 'grants'
  // The list API never carries the grants, so "who has access" reads GET /access-vault/{id} first.
  // Until that answer is in, Save stays off: PUT /grants replaces the whole list and an empty list removes everyone.
  const needsGrants = onlyGrants && item !== null && !item.granteesKnown
  const [grantsState, setGrantsState] = useState<'loading' | 'ready' | 'failed'>(needsGrants ? 'loading' : 'ready')
  const [grantsError, setGrantsError] = useState<string | null>(null)
  const [grantsAttempt, setGrantsAttempt] = useState(0)
  const [initialGrantees, setInitialGrantees] = useState<number[]>(() => item?.grantees.map((person) => person.id) ?? [])
  const itemId = item?.id ?? null

  useEffect(() => {
    if (!needsGrants || itemId === null) return
    let alive = true
    accessVaultService.get(itemId)
      .then((detail) => {
        if (!alive) return
        if (!detail.granteesKnown) throw new Error('no granted_user_ids')
        const ids = detail.grantees.map((person) => person.id)
        setGrantees(ids)
        setInitialGrantees(ids)
        setGrantsState('ready')
        onGrantsLoaded?.(itemId, ids)
      })
      .catch((cause: unknown) => {
        if (!alive) return
        setGrantsError(getApiErrorMessage(cause))
        setGrantsState('failed')
      })
    return () => { alive = false }
  }, [needsGrants, itemId, grantsAttempt, onGrantsLoaded])

  const grantsBlocked = onlyGrants && grantsState !== 'ready'
  const removesEveryone = onlyGrants && grantsState === 'ready' && grantees.length === 0 && initialGrantees.length > 0
  const creating = target?.mode === 'create'
  const titleError = submitted && !title.trim() ? t('vault.editor.title_required', 'Give the access a name.') : null
  const secretError = submitted && creating && !secret ? t('vault.editor.secret_required', 'Enter the password or key.') : null

  function submit() {
    setSubmitted(true)
    if (grantsBlocked) return
    if (!onlyGrants && (!title.trim() || (creating && !secret))) return
    onSave({
      title: title.trim(),
      category,
      login: login.trim() || null,
      url: url.trim() || null,
      notes: notes.trim() || null,
      ...(secret ? { secret } : {}),
    }, grantees)
  }

  const categoryOptions = VAULT_CATEGORIES.map((entry) => ({ value: entry.value, label: t(entry.labelKey, entry.fallback), icon: entry.icon, color: entry.color }))

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      size="lg"
      headerIcon={creating ? <Plus /> : onlyGrants ? <KeyRound /> : <Pencil />}
      title={creating ? t('vault.editor.create_title', 'New access') : onlyGrants ? t('vault.grants.title', 'Who can open “{{title}}”', { title: item?.title ?? '' }) : t('vault.editor.edit_title', 'Edit access')}
      description={onlyGrants
        ? t('vault.grants.description', 'Only the people ticked here can see and copy this password. Every opening is logged.')
        : t('vault.editor.description', 'Passwords are stored encrypted in CIMS and shown only to the people you give access to.')}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={submit} loading={saving} disabled={grantsBlocked}>{creating ? t('vault.editor.create', 'Save access') : t('common.save', 'Save')}</Button>
        </>
      )}
    >
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit() }}>
        {onlyGrants ? null : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('vault.editor.title', 'Name')} required>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus={creating} placeholder={t('vault.editor.title_placeholder', 'e.g. Production server')} aria-invalid={Boolean(titleError)} className={cn(titleError && 'border-[var(--danger)]')} />
                {titleError ? <span className="text-[11.5px] font-medium text-[var(--danger-text)]">{titleError}</span> : null}
              </Field>
              <Field label={t('vault.editor.category', 'Type')}>
                <SelectField value={category} onValueChange={setCategory} options={categoryOptions} />
              </Field>
              <Field label={t('vault.editor.url', 'Link or host')}>
                <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://… · 10.0.0.5" />
              </Field>
              <Field label={t('vault.editor.login', 'Login')}>
                <Input value={login} onChange={(event) => setLogin(event.target.value)} placeholder={t('vault.editor.login_placeholder', 'Username, email or phone')} autoComplete="off" />
              </Field>
            </div>

            <Field
              label={t('vault.editor.secret', 'Password / key')}
              required={creating}
              hint={creating ? undefined : t('vault.editor.secret_keep', 'Leave empty to keep the current password.')}
            >
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                    autoComplete="new-password"
                    placeholder={creating ? '' : '••••••••••'}
                    aria-invalid={Boolean(secretError)}
                    className={cn('pr-10 font-mono', secretError && 'border-[var(--danger)]')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((open) => !open)}
                    aria-label={showSecret ? t('auth.password.hide', 'Hide password') : t('auth.password.show', 'Show password')}
                    className="absolute top-1/2 right-1.5 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-[7px] text-[var(--muted)] hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]"
                  >
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <Button type="button" variant="secondary" leftIcon={<Sparkles size={14} />} onClick={() => { setSecret(generatePassword()); setShowSecret(true) }}>
                  {t('vault.editor.generate', 'Generate')}
                </Button>
              </div>
              {secretError ? <span className="text-[11.5px] font-medium text-[var(--danger-text)]">{secretError}</span> : null}
            </Field>

            <Field label={t('vault.editor.notes', 'Notes')}>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder={t('vault.editor.notes_placeholder', '2FA, port, who pays for it…')} />
            </Field>
          </>
        )}

        {target?.mode === 'edit' ? null : (
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-[var(--muted-strong)]">{t('vault.editor.people', 'Who has access')}</p>
            {onlyGrants && grantsState === 'loading' ? (
              <p className="flex items-center gap-2 py-6 text-[12.5px] text-[var(--muted)]"><Loader2 size={14} className="animate-spin" />{t('vault.grants.loading', 'Loading who has access…')}</p>
            ) : onlyGrants && grantsState === 'failed' ? (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[var(--danger-dim)] px-3 py-2 text-[12px] leading-[1.5] text-[var(--danger-text)]">
                <span className="min-w-0 flex-1">{t('vault.grants.load_failed', 'Could not load the current list, so it cannot be changed now.')}{grantsError ? ` (${grantsError})` : ''}</span>
                <Button type="button" variant="secondary" leftIcon={<RefreshCw size={13} />} onClick={() => { setGrantsState('loading'); setGrantsError(null); setGrantsAttempt((value) => value + 1) }}>{t('common.retry', 'Retry')}</Button>
              </div>
            ) : null}
            {removesEveryone ? (
              <p className="mb-2 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-dim)] px-3 py-2 text-[12px] leading-[1.5] text-[var(--warning-text)]">
                {t('vault.grants.remove_all_warning', 'Nobody is ticked: saving removes access for everyone except managers.')}
              </p>
            ) : null}
            {grantsBlocked ? null : <PeoplePicker people={people} selected={grantees} onChange={setGrantees} loading={peopleLoading} />}
          </div>
        )}
      </form>
    </Dialog>
  )
}
