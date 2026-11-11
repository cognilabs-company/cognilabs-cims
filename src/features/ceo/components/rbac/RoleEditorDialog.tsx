import { useState } from 'react'
import { Copy, ShieldCheck } from 'lucide-react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { rbacService, toSelections, type PermissionSet, type RbacCatalog, type RbacRole } from '../../../../shared/api/services/rbac.service'
import { Button } from '../../../../shared/ui/button'
import { Dialog } from '../../../../shared/ui/dialog'
import { Input } from '../../../../shared/ui/input'
import { Switch } from '../../../../shared/ui/switch'
import { Textarea } from '../../../../shared/ui/textarea'
import { PermissionMatrix } from './PermissionMatrix'
import { permissionSummary } from './rbacLabels'

/** "Sales operator" → "sales_operator" */
function toRoleSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100)
}

const slugPattern = /^[a-z][a-z0-9_]*$/

type RoleEditorDialogProps = {
  catalog: RbacCatalog
  /** null → create a new role. */
  role: RbacRole | null
  onClose: () => void
  onSaved: (role: RbacRole) => void
}

/** Create or edit a role: names, description, active flag and the permission matrix. */
export function RoleEditorDialog({ catalog, role, onClose, onSaved }: RoleEditorDialogProps) {
  const { t } = useLocale()
  const creating = role === null
  const [displayName, setDisplayName] = useState(role?.display_name ?? '')
  const [name, setName] = useState(role?.name ?? '')
  const [nameTouched, setNameTouched] = useState(false)
  const [description, setDescription] = useState(role?.description ?? '')
  const [active, setActive] = useState(role?.is_active ?? true)
  const [permissions, setPermissions] = useState<PermissionSet>(role?.permissions ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slug = creating ? (nameTouched ? name : toRoleSlug(displayName)) : name
  const nameValid = !creating || slugPattern.test(slug)
  const canSave = displayName.trim().length > 0 && nameValid && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const saved = creating
        ? await rbacService.createRole({ name: slug, display_name: displayName.trim(), description: description.trim() || null, permissions: toSelections(permissions) })
        : await rbacService.updateRole(role.id, { display_name: displayName.trim(), description: description.trim() || null, is_active: active, permissions: toSelections(permissions) })
      onSaved(saved.id ? saved : { ...(role ?? saved), display_name: displayName.trim(), description: description.trim() || null, is_active: active, permissions })
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
      size="xl"
      title={creating ? t('rbac.role.create_title', 'New role') : t('rbac.role.edit_title', 'Edit role · {{name}}', { name: role.display_name })}
      description={t('rbac.role.description', 'Tick what people with this role can see and do. Any action also turns on “view”.')}
      headerIcon={<ShieldCheck size={18} />}
      footer={(
        <>
          <span className="mr-auto hidden text-[12.5px] text-[var(--muted)] sm:inline">{permissionSummary(permissions)}</span>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={() => void save()} loading={saving} disabled={!canSave}>{creating ? t('rbac.role.create', 'Create role') : t('common.save', 'Save')}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('rbac.role.display_name', 'Name')}</span>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t('rbac.role.display_name_placeholder', 'Sales operator')} maxLength={255} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('rbac.role.slug', 'System name')}</span>
            <Input
              value={slug}
              onChange={(event) => { setNameTouched(true); setName(event.target.value.toLowerCase()) }}
              disabled={!creating}
              placeholder="sales_operator"
              className="font-mono"
              aria-invalid={!nameValid}
              data-i18n-skip="true"
            />
            <span className={nameValid ? 'mt-1 block text-[11.5px] text-[var(--muted)]' : 'mt-1 block text-[11.5px] text-[var(--danger-text)]'}>
              {creating ? t('rbac.role.slug_hint', 'Latin letters, digits and “_”; cannot be changed later.') : t('rbac.role.slug_locked', 'The system name cannot be changed.')}
            </span>
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('rbac.role.about', 'Description')}</span>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder={t('rbac.role.about_placeholder', 'What this role is for')} />
        </label>
        {!creating ? (
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] px-3.5 py-3">
            <span>
              <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{t('rbac.role.active', 'Role is active')}</span>
              <span className="block text-[12px] text-[var(--muted)]">{t('rbac.role.active_hint', 'An inactive role cannot be given to people.')}</span>
            </span>
            <Switch checked={active} onChange={setActive} label={t('rbac.role.active', 'Role is active')} />
          </div>
        ) : null}
        <PermissionMatrix catalog={catalog} value={permissions} onChange={setPermissions} />
        {error ? <p role="alert" className="rounded-[12px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[13px] text-[var(--danger-text)]">{error}</p> : null}
      </div>
    </Dialog>
  )
}

/** Copy a role under a new name (POST /rbac/roles/{id}/clone). */
export function CloneRoleDialog({ role, onClose, onSaved }: { role: RbacRole; onClose: () => void; onSaved: (role: RbacRole) => void }) {
  const { t } = useLocale()
  const [displayName, setDisplayName] = useState(t('rbac.role.copy_of', '{{name}} (copy)', { name: role.display_name }))
  const [name, setName] = useState(toRoleSlug(`${role.name}_copy`))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = displayName.trim().length > 0 && slugPattern.test(name)

  async function save() {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      onSaved(await rbacService.cloneRole(role.id, { name, display_name: displayName.trim() }))
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
      title={t('rbac.role.clone_title', 'Copy role')}
      description={t('rbac.role.clone_description', 'The copy gets every permission of “{{name}}”.', { name: role.display_name })}
      headerIcon={<Copy size={18} />}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={() => void save()} loading={saving} disabled={!valid}>{t('rbac.role.clone', 'Copy')}</Button>
        </>
      )}
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('rbac.role.display_name', 'Name')}</span>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoFocus />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('rbac.role.slug', 'System name')}</span>
          <Input value={name} onChange={(event) => setName(event.target.value.toLowerCase())} className="font-mono" aria-invalid={!slugPattern.test(name)} data-i18n-skip="true" />
        </label>
        {error ? <p role="alert" className="rounded-[12px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[13px] text-[var(--danger-text)]">{error}</p> : null}
      </div>
    </Dialog>
  )
}
