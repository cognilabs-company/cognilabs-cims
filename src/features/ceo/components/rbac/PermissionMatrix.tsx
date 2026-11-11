import { Lock } from 'lucide-react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { cn } from '../../../../shared/lib/cn'
import { Checkbox } from '../../../../shared/ui/checkbox'
import type { PermissionSet, RbacCatalog } from '../../../../shared/api/services/rbac.service'
import { actionLabel, moduleLabel } from './rbacLabels'

type PermissionMatrixProps = {
  catalog: RbacCatalog
  value: PermissionSet
  onChange?: (next: PermissionSet) => void
  /** Permissions that come from elsewhere (the user's role): shown ticked and locked. */
  inherited?: PermissionSet
  readOnly?: boolean
  className?: string
}

/** Modules × actions grid. Any action ticks "view" too; unticking "view" clears the row. */
export function PermissionMatrix({ catalog, value, onChange, inherited, readOnly = false, className }: PermissionMatrixProps) {
  const { t } = useLocale()
  const actions = catalog.actions
  const allowedFor = (moduleName: string) => {
    const declared = catalog.modules.find((module) => module.name === moduleName)?.actions ?? []
    return declared.length ? declared : actions
  }
  const has = (module: string, action: string) => value[module]?.includes(action) ?? false
  const locked = (module: string, action: string) => inherited?.[module]?.includes(action) ?? false

  function setRow(module: string, nextActions: string[]) {
    if (!onChange) return
    const next = { ...value }
    if (nextActions.length) next[module] = actions.filter((action) => nextActions.includes(action))
    else delete next[module]
    onChange(next)
  }

  function toggle(module: string, action: string) {
    const current = value[module] ?? []
    if (current.includes(action)) {
      // Without "view" nothing else makes sense.
      setRow(module, action === 'view' ? [] : current.filter((item) => item !== action))
    } else {
      setRow(module, [...new Set([...current, action, ...(action === 'view' ? [] : ['view'])])])
    }
  }

  function toggleRow(module: string) {
    const allowed = allowedFor(module)
    const full = allowed.every((action) => has(module, action) || locked(module, action))
    setRow(module, full ? [] : allowed.filter((action) => !locked(module, action)))
  }

  function toggleColumn(action: string) {
    if (!onChange) return
    const modules = catalog.modules.filter((module) => allowedFor(module.name).includes(action))
    const full = modules.every((module) => has(module.name, action) || locked(module.name, action))
    const next = { ...value }
    for (const module of modules) {
      const current = next[module.name] ?? []
      const updated = full
        ? (action === 'view' ? [] : current.filter((item) => item !== action))
        : [...new Set([...current, action, 'view'])]
      if (updated.length) next[module.name] = actions.filter((item) => updated.includes(item))
      else delete next[module.name]
    }
    onChange(next)
  }

  return (
    <div className={cn('overflow-hidden rounded-[14px] border border-[var(--border)]', className)}>
      <div className="max-h-[min(52vh,520px)] overflow-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th scope="col" className="border-b border-[var(--border)] bg-[var(--muted-surface)] px-3.5 py-2.5 text-left text-[12px] font-semibold text-[var(--muted-strong)]">
                {t('rbac.matrix.module', 'Module')}
              </th>
              {actions.map((action) => (
                <th key={action} scope="col" className="w-[84px] border-b border-[var(--border)] bg-[var(--muted-surface)] px-1 py-1.5 text-center">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleColumn(action)}
                    title={t('rbac.matrix.toggle_column', 'Toggle for every module')}
                    className="rounded-[7px] px-2 py-1 text-[12px] font-semibold text-[var(--muted-strong)] transition-colors enabled:hover:bg-[var(--surface)] enabled:hover:text-[var(--primary)] disabled:cursor-default"
                  >
                    {actionLabel(action)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.modules.map((module, index) => {
              const allowed = allowedFor(module.name)
              const rowCount = allowed.filter((action) => has(module.name, action) || locked(module.name, action)).length
              return (
                <tr key={module.name} className={cn(index % 2 === 1 && 'bg-[var(--row-zebra)]')}>
                  <th scope="row" className="border-b border-[var(--border-subtle)] px-3.5 py-2 text-left font-normal">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggleRow(module.name)}
                      title={t('rbac.matrix.toggle_row', 'Toggle every action')}
                      className="flex w-full min-w-0 items-center gap-2 text-left disabled:cursor-default"
                    >
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', rowCount === 0 ? 'bg-[var(--control-border)]' : rowCount === allowed.length ? 'bg-[var(--success)]' : 'bg-[var(--warning)]')} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[var(--foreground)]">{moduleLabel(module)}</span>
                        <span className="block truncate font-mono text-[11px] text-[var(--caption)]" data-i18n-skip="true">{module.name}</span>
                      </span>
                    </button>
                  </th>
                  {actions.map((action) => {
                    const supported = allowed.includes(action)
                    const fromRole = locked(module.name, action)
                    const checked = fromRole || has(module.name, action)
                    return (
                      <td key={action} className="border-b border-[var(--border-subtle)] px-1 py-2 text-center">
                        {supported ? (
                          <span className="relative inline-grid place-items-center" title={fromRole ? t('rbac.matrix.from_role', 'Comes from the role') : undefined}>
                            <Checkbox
                              size="sm"
                              checked={checked}
                              disabled={readOnly || fromRole}
                              onChange={() => toggle(module.name, action)}
                              aria-label={`${moduleLabel(module)} · ${actionLabel(action)}`}
                              className="h-[20px] w-[20px] disabled:opacity-100"
                              style={fromRole ? { ['--checkbox-on' as string]: 'var(--track)' } : undefined}
                            />
                            {fromRole ? <Lock size={9} className="pointer-events-none absolute -right-1.5 -bottom-1 text-[var(--muted)]" aria-hidden="true" /> : null}
                          </span>
                        ) : (
                          <span className="text-[var(--caption)]" aria-hidden="true">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
