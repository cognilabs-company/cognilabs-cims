import { translateCurrent as tr } from '../../../../shared/i18n/translations'
import type { PermissionSet, RbacCatalogModule } from '../../../../shared/api/services/rbac.service'

const moduleFallback: Record<string, string> = {
  ceo: 'CEO dashboard', crm: 'CRM', customers: 'Customers', calls: 'Calls', projects: 'Projects', attendance: 'Attendance',
  users: 'Users', monthly_updates: 'Monthly updates', salary: 'Salary estimates', developer_kpi: 'Developer KPI',
  ai_chat: 'AI chat', ai_kanban: 'AI kanban', media_contexts: 'Media contexts', ai_integrations: 'AI integrations',
  instagram_comments: 'Instagram comments', site_statistics: 'Website stats', management_api: 'Management API',
}

const actionFallback: Record<string, string> = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', export: 'Export' }

/** Module name in the current language; unknown modules use the catalog's display name. */
export function moduleLabel(module: Pick<RbacCatalogModule, 'name' | 'display_name'> | string) {
  const name = typeof module === 'string' ? module : module.name
  const display = typeof module === 'string' ? module : module.display_name
  return tr(`rbac.module.${name}`, moduleFallback[name] ?? display ?? name)
}

export function actionLabel(action: string) {
  return tr(`rbac.action.${action}`, actionFallback[action] ?? action)
}

/** "6 modules · 18 permissions" */
export function permissionSummary(set: PermissionSet) {
  const modules = Object.values(set).filter((actions) => actions.length > 0)
  const total = modules.reduce((sum, actions) => sum + actions.length, 0)
  return tr('rbac.summary', '{{modules}} modules · {{total}} permissions', { modules: modules.length, total })
}
