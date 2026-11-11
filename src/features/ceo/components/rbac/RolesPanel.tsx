import { useState } from 'react'
import { Copy, Lock, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UsersRound } from 'lucide-react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { cn } from '../../../../shared/lib/cn'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { normalizeCatalog, rbacService, type RbacCatalog, type RbacRole } from '../../../../shared/api/services/rbac.service'
import { useConfirm } from '../../../../shared/confirm/useConfirm'
import { useToast } from '../../../../shared/toast/useToast'
import { Button } from '../../../../shared/ui/button'
import { CloneRoleDialog, RoleEditorDialog } from './RoleEditorDialog'
import { actionLabel, moduleLabel, permissionSummary } from './rbacLabels'

type RolesPanelProps = {
  catalog: RbacCatalog | null
  roles: RbacRole[]
  loading: boolean
  error: string | null
  onChanged: () => void
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

/** Roles list: what each role may do, how many people have it; create / edit / copy / delete. */
/** If GET /rbac/catalog fails, the matrix still works with the modules/actions listed in the contract. */
const FALLBACK_CATALOG = normalizeCatalog(null)

export function RolesPanel({ catalog: loadedCatalog, roles, loading, error, onChanged, canCreate, canEdit, canDelete }: RolesPanelProps) {
  const { t } = useLocale()
  const catalog = loadedCatalog ?? FALLBACK_CATALOG
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const [editing, setEditing] = useState<RbacRole | 'new' | null>(null)
  const [cloning, setCloning] = useState<RbacRole | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function remove(role: RbacRole) {
    const ok = await confirm({
      title: t('rbac.role.delete_title', 'Delete role “{{name}}”?', { name: role.display_name }),
      description: t('rbac.role.delete_text', 'A role that people still have cannot be deleted — move them to another role first.'),
      confirmLabel: t('common.delete', 'Delete'),
      tone: 'danger',
    })
    if (!ok) return
    setDeletingId(role.id)
    try {
      await rbacService.deleteRole(role.id)
      showToast({ title: t('rbac.role.deleted', 'Role deleted'), tone: 'success' })
      onChanged()
    } catch (cause) {
      showToast({ title: t('rbac.role.delete_failed', 'Could not delete the role'), description: getApiErrorMessage(cause), tone: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{t('rbac.roles.title', 'Roles')}</h2>
          <p className="text-[13px] text-[var(--muted)]">{t('rbac.roles.subtitle', 'A role is a set of permissions; give it to people on the Users tab.')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={onChanged}>{t('common.refresh', 'Refresh')}</Button>
          {canCreate ? <Button size="sm" leftIcon={<Plus size={15} />} onClick={() => setEditing('new')}>{t('rbac.role.create', 'Create role')}</Button> : null}
        </div>
      </div>

      {error ? <p role="alert" className="rounded-[14px] bg-[var(--danger-dim)] px-4 py-3 text-[13px] text-[var(--danger-text)]">{error}</p> : null}

      {loading && roles.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => <span key={index} className="skeleton block h-[180px] rounded-[18px]" />)}
        </div>
      ) : roles.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-[var(--border-hover)] px-6 py-12 text-center">
          <ShieldCheck size={28} className="mx-auto text-[var(--muted)]" />
          <p className="mt-3 text-[15px] font-semibold text-[var(--foreground)]">{t('rbac.roles.empty', 'No roles yet')}</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">{t('rbac.roles.empty_hint', 'Create the first role, e.g. “Sales operator”.')}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const modules = Object.entries(role.permissions).filter(([, actions]) => actions.length > 0)
            return (
              <article key={role.id} className={cn('flex flex-col rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_1px_2px_rgba(14,21,37,0.04)]', !role.is_active && 'opacity-70')}>
                <header className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--blue-dim)] text-[var(--primary)]">
                    {role.is_locked ? <Lock size={17} /> : <ShieldCheck size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">{role.display_name}</p>
                    <p className="truncate font-mono text-[11.5px] text-[var(--caption)]" data-i18n-skip="true">{role.name}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {role.user_count !== null ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--input-surface)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--muted-strong)]">
                        <UsersRound size={12} />{role.user_count}
                      </span>
                    ) : null}
                    {!role.is_active ? <span className="rounded-full bg-[var(--warning-dim)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-text)]">{t('rbac.role.inactive', 'Inactive')}</span> : null}
                  </div>
                </header>
                {role.description ? <p className="mt-2.5 line-clamp-2 text-[12.5px] text-[var(--muted-strong)]">{role.description}</p> : null}
                <p className="mt-3 text-[12px] font-medium text-[var(--muted)]">{role.is_locked ? t('rbac.role.full_access', 'Full access · protected') : permissionSummary(role.permissions)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {modules.slice(0, 6).map(([module, actions]) => (
                    <span key={module} title={actions.map(actionLabel).join(', ')} className="rounded-full bg-[var(--muted-surface)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)]">
                      {moduleLabel(catalog.modules.find((item) => item.name === module) ?? module)}
                    </span>
                  ))}
                  {modules.length > 6 ? <span className="rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--muted)]">+{modules.length - 6}</span> : null}
                </div>
                <footer className="mt-auto flex items-center gap-1 pt-4">
                  {canEdit && !role.is_locked ? (
                    <Button variant="secondary" size="sm" leftIcon={<Pencil size={13} />} onClick={() => setEditing(role)}>{t('common.edit', 'Edit')}</Button>
                  ) : null}
                  {canCreate ? (
                    <Button variant="ghost" size="sm" leftIcon={<Copy size={13} />} onClick={() => setCloning(role)}>{t('rbac.role.clone', 'Copy')}</Button>
                  ) : null}
                  {canDelete && !role.is_locked ? (
                    <button
                      type="button"
                      onClick={() => void remove(role)}
                      disabled={deletingId === role.id || Boolean(role.user_count)}
                      aria-label={`${t('common.delete', 'Delete')} · ${role.display_name}`}
                      title={role.user_count ? t('rbac.role.in_use', 'People still have this role') : t('common.delete', 'Delete')}
                      className="ml-auto grid h-8 w-8 place-items-center rounded-[9px] text-[var(--muted)] transition-colors hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)] disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </footer>
              </article>
            )
          })}
        </div>
      )}

      {editing ? (
        <RoleEditorDialog
          catalog={catalog}
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            showToast({ title: editing === 'new' ? t('rbac.role.created', 'Role created') : t('rbac.role.saved', 'Role saved'), tone: 'success' })
            setEditing(null)
            onChanged()
          }}
        />
      ) : null}
      {cloning ? (
        <CloneRoleDialog
          role={cloning}
          onClose={() => setCloning(null)}
          onSaved={() => {
            showToast({ title: t('rbac.role.cloned', 'Role copied'), tone: 'success' })
            setCloning(null)
            onChanged()
          }}
        />
      ) : null}
    </section>
  )
}
