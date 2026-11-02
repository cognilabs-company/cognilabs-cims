import type { PermissionMap } from '../../../shared/api/types'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
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
      <div className="flex flex-wrap gap-2.5">
        <Badge variant="blue">
          {t('ceo.permissions.active_count', { count: activePermissionsCount })}
        </Badge>
        <Badge variant="secondary">
          {t('ceo.permissions.available_count', { count: totalAvailablePages })}
        </Badge>
      </div>

      <div className="mt-[18px] grid gap-[18px] lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-2.5">
          {availablePermissions.map((permissionKey) => {
            const meta = getPermissionMeta(permissionKey)

            return (
              <Label
                key={permissionKey}
                className="flex cursor-pointer items-start gap-3.5 rounded-[18px] bg-[var(--accent-soft)] px-4 py-4 transition-colors hover:bg-[var(--input-surface-hover)]"
              >
                <Checkbox
                  size="sm"
                  className="mt-0.5"
                  checked={Boolean(permissions[permissionKey])}
                  onChange={(event) => onToggle(permissionKey, event.target.checked)}
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--foreground)]">{meta.label}</p>
                  <p className="mt-1 text-[13px] leading-[1.55] text-[var(--muted)]">{meta.description}</p>
                  <Badge variant="blue" size="sm" className="mt-2.5">{permissionKey}</Badge>
                </div>
              </Label>
            )
          })}
        </div>

        <div className="sticky top-0 h-fit rounded-[18px] bg-[var(--accent-soft)] p-[22px]">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">{t('ceo.permissions.active_now')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {activePermissionKeys.length > 0 ? (
              activePermissionKeys.map((permissionKey) => (
                <button
                  key={permissionKey}
                  type="button"
                  onClick={() => onRemovePermission(permissionKey)}
                  className="inline-flex items-center rounded-full bg-[var(--blue-dim)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--blue-text)] transition-colors hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]"
                >
                  {getPermissionMeta(permissionKey).label} <span className="ml-1 opacity-50">×</span>
                </button>
              ))
            ) : (
              <p className="text-[13px] text-[var(--muted)]">{t('ceo.permissions.none_active')}</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
