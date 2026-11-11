import { useState, type ReactNode } from 'react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { PermissionSet, RbacCatalog, RbacCatalogModule } from '../../../shared/api/services/rbac.service'
import { cn } from '../../../shared/lib/cn'
import { Checkbox } from '../../../shared/ui/checkbox'
import type { Translate } from '../lib/labels'

type PermissionMatrixProps = {
  catalog: RbacCatalog
  value: PermissionSet
  onChange: (next: PermissionSet) => void
  /** What the chosen role already grants (shown as a hint, direct permissions add on top). */
  rolePermissions: PermissionSet
  disabled?: boolean
}

function actionLabel(t: Translate, action: string) {
  switch (action) {
    case 'view': return t('registrations.action.view', 'View')
    case 'create': return t('registrations.action.create', 'Create')
    case 'edit': return t('registrations.action.edit', 'Edit')
    case 'delete': return t('registrations.action.delete', 'Delete')
    case 'export': return t('registrations.action.export', 'Export')
    default: return action
  }
}

const availableActions = (module: RbacCatalogModule, all: string[]) => (module.actions.length ? module.actions : all)

/** Direct permissions: modules × actions from /rbac/catalog. */
export function PermissionMatrix({ catalog, value, onChange, rolePermissions, disabled }: PermissionMatrixProps) {
  const { t } = useLocale()
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const modules = catalog.modules.filter((module) => !needle || module.name.toLowerCase().includes(needle) || module.display_name.toLowerCase().includes(needle))
  const groups: Array<{ group: string; modules: RbacCatalogModule[] }> = []
  for (const module of modules) {
    const name = module.group ?? ''
    const bucket = groups.find((entry) => entry.group === name)
    if (bucket) bucket.modules.push(module)
    else groups.push({ group: name, modules: [module] })
  }
  const selectedCount = Object.values(value).reduce((sum, actions) => sum + actions.length, 0)

  function toggle(module: string, action: string) {
    const current = value[module] ?? []
    const nextActions = current.includes(action) ? current.filter((item) => item !== action) : [...current, action]
    const next = { ...value, [module]: nextActions }
    if (!nextActions.length) delete next[module]
    onChange(next)
  }

  function toggleRow(module: RbacCatalogModule) {
    const actions = availableActions(module, catalog.actions)
    const current = value[module.name] ?? []
    const next = { ...value }
    if (actions.every((action) => current.includes(action))) delete next[module.name]
    else next[module.name] = [...actions]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex h-9 min-w-0 flex-1 items-center">
          <MagnifyingGlassIcon size={14} className="pointer-events-none absolute left-2.5 text-[var(--muted)]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('registrations.approve.search_modules', 'Search modules…')}
            aria-label={t('registrations.approve.search_modules', 'Search modules…')}
            className="control-field h-9 w-full rounded-[10px] pr-3 pl-8 text-[12.5px] placeholder:text-[var(--caption)]"
          />
        </label>
        <span className="text-[12px] text-[var(--muted)] tabular-nums">{t('registrations.approve.selected', '{{count}} selected', { count: selectedCount })}</span>
        {selectedCount ? (
          <button type="button" onClick={() => onChange({})} disabled={disabled} className="h-8 rounded-[8px] px-2 text-[12px] font-semibold text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
            {t('registrations.approve.clear', 'Clear')}
          </button>
        ) : null}
      </div>

      <div className="max-h-[320px] overflow-auto rounded-[14px] border border-[var(--border)]">
        <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[12.5px]">
          <thead className="sticky top-0 z-[2]">
            <tr>
              <th scope="col" className="sticky left-0 z-[3] border-b border-[var(--border)] bg-[var(--muted-surface)] px-3 py-2 text-left font-semibold text-[var(--muted-strong)]">
                {t('registrations.approve.module', 'Module')}
              </th>
              {catalog.actions.map((action) => (
                <th key={action} scope="col" className="w-[68px] border-b border-[var(--border)] bg-[var(--muted-surface)] px-1 py-2 text-center font-semibold text-[var(--muted-strong)]">
                  {actionLabel(t, action)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr><td colSpan={catalog.actions.length + 1} className="px-3 py-6 text-center text-[var(--muted)]">{t('registrations.common.nothing_found', 'Nothing found')}</td></tr>
            ) : groups.map(({ group, modules: groupModules }) => (
              <GroupRows key={group || '—'} group={group} showHeader={groups.length > 1 && Boolean(group)} span={catalog.actions.length + 1}>
                {groupModules.map((module) => {
                  const actions = availableActions(module, catalog.actions)
                  const current = value[module.name] ?? []
                  const fromRole = rolePermissions[module.name] ?? []
                  return (
                    <tr key={module.name} className="group/row">
                      <th scope="row" className="sticky left-0 z-[1] border-b border-[var(--border-subtle)] bg-[var(--card)] px-3 py-1.5 text-left font-normal group-hover/row:bg-[var(--card-hover)]">
                        <button type="button" onClick={() => toggleRow(module)} disabled={disabled} className="block max-w-[220px] text-left" title={t('registrations.approve.toggle_row', 'Select / clear the whole row')}>
                          <span className="block truncate text-[12.5px] font-semibold text-[var(--foreground)]">{module.display_name}</span>
                          {module.display_name !== module.name ? <code className="block truncate font-mono text-[10.5px] text-[var(--muted)]">{module.name}</code> : null}
                        </button>
                      </th>
                      {catalog.actions.map((action) => {
                        const available = actions.includes(action)
                        const viaRole = fromRole.includes(action)
                        return (
                          <td key={action} className={cn('border-b border-[var(--border-subtle)] px-1 py-1.5 text-center group-hover/row:bg-[var(--card-hover)]', viaRole && 'bg-[var(--success-dim)]/60')}>
                            {available ? (
                              <label className="relative inline-grid h-8 w-8 cursor-pointer place-items-center" title={viaRole ? t('registrations.approve.via_role', 'Already granted by the role') : undefined}>
                                <Checkbox
                                  size="sm"
                                  checked={current.includes(action)}
                                  onChange={() => toggle(module.name, action)}
                                  disabled={disabled}
                                  aria-label={`${module.display_name}: ${actionLabel(t, action)}`}
                                />
                                {viaRole ? <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[var(--success-text)]" aria-hidden="true" /> : null}
                              </label>
                            ) : (
                              <span className="text-[var(--caption)]" aria-hidden="true">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </GroupRows>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-text)]" aria-hidden="true" />
        {t('registrations.approve.legend', 'Green — the chosen role already gives this. Ticks add direct permissions on top of the role.')}
      </p>
    </div>
  )
}

function GroupRows({ group, showHeader, span, children }: { group: string; showHeader: boolean; span: number; children: ReactNode }) {
  return (
    <>
      {showHeader ? (
        <tr>
          <td colSpan={span} className="border-b border-[var(--border-subtle)] bg-[var(--background)] px-3 pt-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
            {group}
          </td>
        </tr>
      ) : null}
      {children}
    </>
  )
}
