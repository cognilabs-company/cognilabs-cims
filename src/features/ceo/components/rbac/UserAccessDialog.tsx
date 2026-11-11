import { useEffect, useMemo, useState } from 'react'
import { Crown, Eraser, KeyRound } from 'lucide-react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import {
  rbacService, toSelections,
  type PermissionSet, type RbacCatalog, type RbacRole, type UserAccess, type UserAccessPayload,
} from '../../../../shared/api/services/rbac.service'
import { Button } from '../../../../shared/ui/button'
import { Dialog } from '../../../../shared/ui/dialog'
import { SelectField } from '../../../../shared/ui/select-field'
import { PermissionMatrix } from './PermissionMatrix'
import { moduleLabel, permissionSummary } from './rbacLabels'

type UserAccessDialogProps = {
  userId: number
  userName: string
  catalog: RbacCatalog
  roles: RbacRole[]
  onClose: () => void
  onSaved: (access: UserAccess) => void
}

const sameSet = (left: PermissionSet, right: PermissionSet) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...keys].every((key) => [...(left[key] ?? [])].sort().join() === [...(right[key] ?? [])].sort().join())
}

function merge(left: PermissionSet, right: PermissionSet): PermissionSet {
  const out: PermissionSet = { ...left }
  for (const [module, actions] of Object.entries(right)) out[module] = [...new Set([...(out[module] ?? []), ...actions])]
  return out
}

/** One person's access: a role plus optional direct permissions on top of it. */
export function UserAccessDialog({ userId, userName, catalog, roles, onClose, onSaved }: UserAccessDialogProps) {
  const { t } = useLocale()
  const [current, setCurrent] = useState<UserAccess | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [roleId, setRoleId] = useState('')
  const [direct, setDirect] = useState<PermissionSet>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void rbacService.user(userId).then((access) => {
      if (!active) return
      setCurrent(access)
      setRoleId(access.role_id ? String(access.role_id) : '')
      setDirect(access.direct_permissions)
    }).catch((cause: unknown) => { if (active) setLoadError(getApiErrorMessage(cause)) })
    return () => { active = false }
  }, [userId])

  const selectedRole = roles.find((role) => String(role.id) === roleId) ?? null
  // The role's permissions: from the roles list, or from the user record while their role is unchanged.
  const rolePermissions = useMemo<PermissionSet>(() => {
    if (selectedRole && Object.keys(selectedRole.permissions).length) return selectedRole.permissions
    if (current && String(current.role_id ?? '') === roleId) return current.role_permissions
    return selectedRole?.permissions ?? {}
  }, [current, roleId, selectedRole])
  const effective = useMemo(() => merge(rolePermissions, direct), [direct, rolePermissions])
  const owner = Boolean(current?.is_owner)
  const roleChanged = current !== null && String(current.role_id ?? '') !== roleId
  const directChanged = current !== null && !sameSet(current.direct_permissions, direct)

  const roleOptions = [
    { value: '', label: t('rbac.user.no_role', 'No role') },
    ...roles
      .filter((role) => role.is_active || String(role.id) === roleId)
      .map((role) => ({ value: String(role.id), label: role.display_name, hint: role.name })),
  ]

  async function save() {
    if (!current || (!roleChanged && !directChanged)) { onClose(); return }
    const payload: UserAccessPayload = { role_id: roleId ? Number(roleId) : null }
    // Only send overrides when they changed; [] clears them.
    if (directChanged) payload.direct_permissions = toSelections(direct)
    setSaving(true)
    setError(null)
    try {
      onSaved(await rbacService.updateUser(userId, payload))
    } catch (cause) {
      setError(getApiErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const effectiveModules = Object.entries(effective).filter(([, actions]) => actions.includes('view'))

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={t('rbac.user.title', 'Access · {{name}}', { name: userName })}
      description={t('rbac.user.description', 'Pick a role; add direct permissions only for exceptions.')}
      headerIcon={<KeyRound size={18} />}
      footer={(
        <>
          {current && !owner ? <span className="mr-auto hidden text-[12.5px] text-[var(--muted)] sm:inline">{permissionSummary(effective)}</span> : null}
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel', 'Cancel')}</Button>
          {!owner ? <Button onClick={() => void save()} loading={saving} disabled={!current}>{t('common.save', 'Save')}</Button> : null}
        </>
      )}
    >
      {loadError ? (
        <p role="alert" className="rounded-[12px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[13px] text-[var(--danger-text)]">{loadError}</p>
      ) : !current ? (
        <div className="space-y-3">
          <span className="skeleton block h-10 rounded-[10px]" />
          <span className="skeleton block h-64 rounded-[14px]" />
        </div>
      ) : owner ? (
        <div className="flex items-start gap-3 rounded-[14px] bg-[var(--warning-dim)] px-4 py-3.5 text-[var(--warning-text)]">
          <Crown size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[13.5px] font-semibold">{t('rbac.user.owner_title', 'Company owner')}</p>
            <p className="mt-0.5 text-[12.5px]">{t('rbac.user.owner_text', 'The owner always has full access; it cannot be changed.')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('rbac.user.role', 'Role')}</span>
              <SelectField value={roleId} onValueChange={setRoleId} options={roleOptions} searchable aria-label={t('rbac.user.role', 'Role')} />
            </label>
            <Button
              variant="secondary"
              leftIcon={<Eraser size={15} />}
              onClick={() => setDirect({})}
              disabled={Object.keys(direct).length === 0}
            >
              {t('rbac.user.clear_direct', 'Clear direct permissions')}
            </Button>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">{t('rbac.user.direct', 'Direct permissions')}</p>
              <p className="text-[12px] text-[var(--muted)]">{t('rbac.user.direct_hint', 'Locked ticks come from the role; tick more for this person only.')}</p>
            </div>
            <PermissionMatrix catalog={catalog} value={direct} onChange={setDirect} inherited={rolePermissions} />
          </div>

          <div className="rounded-[14px] bg-[var(--muted-surface)] px-3.5 py-3">
            <p className="text-[12px] font-semibold text-[var(--muted-strong)]">{t('rbac.user.effective', 'Will be able to open')}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {effectiveModules.length ? effectiveModules.map(([module, actions]) => (
                <span key={module} className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)]">
                  {moduleLabel(catalog.modules.find((item) => item.name === module) ?? module)}
                  <span className="ml-1 text-[var(--muted)]">{actions.length}</span>
                </span>
              )) : <span className="text-[12.5px] text-[var(--muted)]">{t('rbac.user.nothing', 'Nothing yet — pick a role.')}</span>}
            </div>
          </div>

          {error ? <p role="alert" className="rounded-[12px] bg-[var(--danger-dim)] px-3.5 py-2.5 text-[13px] text-[var(--danger-text)]">{error}</p> : null}
        </div>
      )}
    </Dialog>
  )
}
