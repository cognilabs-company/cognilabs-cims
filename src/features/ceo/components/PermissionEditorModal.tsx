import type { PermissionMap } from '../../../shared/api/types'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Label } from '../../../shared/ui/label'
import { Modal } from '../../../shared/ui/modal'
import { useTranslation } from 'react-i18next'
import { getPermissionMeta } from '../lib/permissionCatalog'

type PermissionEditorModalProps = {
  open: boolean
  onClose: () => void
  userName: string
  permissions: PermissionMap
  availablePermissions: string[]
  activePermissionsCount: number
  totalAvailablePages: number
  onToggle: (permissionKey: string, nextValue: boolean) => void
  onReplaceAll: () => void
  onAddSelected: () => void
  onRemovePermission: (permissionKey: string) => void
  isSubmitting: boolean
}

export function PermissionEditorModal({
  open,
  onClose,
  userName,
  permissions,
  availablePermissions,
  activePermissionsCount,
  totalAvailablePages,
  onToggle,
  onReplaceAll,
  onAddSelected,
  onRemovePermission,
  isSubmitting,
}: PermissionEditorModalProps) {
  const { t } = useTranslation()
  const activePermissionKeys = Object.entries(permissions)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('ceo.permissions.title', { name: userName })}
      description={t('ceo.permissions.description')}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button variant="ghost" onClick={onAddSelected} disabled={isSubmitting}>
            {t('ceo.permissions.add_selected')}
          </Button>
          <Button onClick={onReplaceAll} disabled={isSubmitting}>
            {isSubmitting ? t('customers.form.submitting') : t('ceo.permissions.replace_all')}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-3">
        <Badge className="border-blue-500/20 bg-blue-50 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400">
          {t('ceo.permissions.active_count', { count: activePermissionsCount })}
        </Badge>
        <Badge className="border-[var(--border)] bg-white text-[var(--foreground)] dark:border-white/10 dark:bg-white/5 dark:text-white">
          {t('ceo.permissions.available_count', { count: totalAvailablePages })}
        </Badge>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3">
          {availablePermissions.map((permissionKey) => {
            const meta = getPermissionMeta(permissionKey)

            return (
              <Label
                key={permissionKey}
                className="flex cursor-pointer items-start gap-4 rounded-xl border border-[var(--border)] bg-white px-4 py-4 transition-colors hover:bg-[var(--card-hover)] dark:bg-white/5 dark:hover:bg-white/10"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-blue-500"
                  checked={Boolean(permissions[permissionKey])}
                  onChange={(event) => onToggle(permissionKey, event.target.checked)}
                />
                <div>
                  <p className="text-[15px] font-semibold text-[var(--foreground)] dark:text-white">{meta.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{meta.description}</p>
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-blue-500 opacity-70">{permissionKey}</p>
                </div>
              </Label>
            )
          })}
        </div>

        <div className="sticky top-0 h-fit rounded-xl border border-[var(--border)] bg-white p-6 dark:bg-white/5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">{t('ceo.permissions.active_now')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {activePermissionKeys.length > 0 ? (
              activePermissionKeys.map((permissionKey) => (
                <button
                  key={permissionKey}
                  type="button"
                  onClick={() => onRemovePermission(permissionKey)}
                  className="rounded-full border border-blue-500/30 bg-blue-600/10 px-3 py-1.5 text-[13px] font-semibold text-blue-400 transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                >
                  {getPermissionMeta(permissionKey).label} <span className="ml-1 opacity-50">×</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-(--muted)">{t('ceo.permissions.none_active')}</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
