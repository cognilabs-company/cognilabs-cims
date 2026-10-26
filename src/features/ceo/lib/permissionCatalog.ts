export const permissionCatalog = [
  { key: 'ceo', label: 'CEO panel', description: 'CEO dashboard, users, AI, management, team updates va payments moduli.' },
  { key: 'payment_list', label: 'Payment list', description: "To'lovlar bo'limini ko'rish va boshqarish." },
  { key: 'project_toggle', label: 'Project toggle', description: 'WordPress yoki loyiha toggle amallari.' },
  { key: 'projects', label: 'Projects', description: 'Projects, boards va kanban workflow bo‘limi.' },
  { key: 'crm', label: 'CRM', description: 'CRM customer dashboard va status boshqaruvi.' },
  { key: 'finance_list', label: 'Finance list', description: "Finance dashboard va transaction ro'yxati." },
  { key: 'update_list', label: 'Update tracking', description: "Update tracking va company stats bo'limi." },
] as const

export function getPermissionMeta(permissionKey: string) {
  return (
    permissionCatalog.find((item) => item.key === permissionKey) ?? {
      key: permissionKey,
      label: permissionKey,
      description: "Custom permission key returned by API.",
    }
  )
}
