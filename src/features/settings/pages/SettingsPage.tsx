import { BellDot, BellRing, PlugZap, SlidersHorizontal } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import { AccessDenied } from '../../auth/components/AccessDenied'
import { PageTabs, type PageTab } from '../../../shared/ui/page-tabs'
import { CognilabsAIIntegrationsPage } from '../../cognilabsai/pages/CognilabsAIIntegrationsPage'
import { CeoManagementPage } from '../../ceo/pages/CeoManagementPage'
import { RecallBotSettingsPage } from '../../recallBot/RecallBotSettingsPage'
import { AttendanceNotificationsSettings } from '../../attendanceNotifications/AttendanceNotificationsSettings'

/**
 * /settings — AI integrations, the Management API and the Telegram bots in one place (each tab follows its
 * RBAC module; the recall bot and attendance notifications are CEO-only in the backend, i.e. the owner in /rbac/me).
 */
export function SettingsPage() {
  const { t } = useLocale()
  const { can, user, access } = useAuth()
  // Owner in /rbac/me (or the CEO role on backends without RBAC); anyone else would only get 403s.
  const isOwner = Boolean(access?.is_owner) || user?.role === 'CEO'
  const tabs: PageTab[] = [
    ...(can('ai_integrations') ? [{ key: 'ai', label: t('nav./cognilabsai/integrations.label', 'AI integrations'), icon: PlugZap, render: () => <CognilabsAIIntegrationsPage /> }] : []),
    ...(can('management_api') ? [{ key: 'management', label: t('nav./ceo/management.label', 'Management API'), icon: SlidersHorizontal, render: () => <CeoManagementPage /> }] : []),
    ...(isOwner
      ? [
          { key: 'recall-bot', label: t('recallbot.tab', 'CRM recall bot'), icon: BellRing, render: () => <RecallBotSettingsPage /> },
          { key: 'attendance-notifications', label: t('attnotify.tab', 'Attendance notifications'), icon: BellDot, render: () => <AttendanceNotificationsSettings /> },
        ]
      : []),
  ]
  if (tabs.length === 0) return <AccessDenied module="ai_integrations / management_api / recall_bot" />
  return <PageTabs tabs={tabs} ariaLabel={t('nav./settings.label', 'Settings')} />
}
