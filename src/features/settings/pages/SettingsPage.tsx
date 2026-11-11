import { PlugZap, SlidersHorizontal } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import { AccessDenied } from '../../auth/components/AccessDenied'
import { PageTabs, type PageTab } from '../../../shared/ui/page-tabs'
import { CognilabsAIIntegrationsPage } from '../../cognilabsai/pages/CognilabsAIIntegrationsPage'
import { CeoManagementPage } from '../../ceo/pages/CeoManagementPage'

/** /settings — AI integrations and the Management API in one place (each tab follows its RBAC module). */
export function SettingsPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const tabs: PageTab[] = [
    ...(can('ai_integrations') ? [{ key: 'ai', label: t('nav./cognilabsai/integrations.label', 'AI integrations'), icon: PlugZap, render: () => <CognilabsAIIntegrationsPage /> }] : []),
    ...(can('management_api') ? [{ key: 'management', label: t('nav./ceo/management.label', 'Management API'), icon: SlidersHorizontal, render: () => <CeoManagementPage /> }] : []),
  ]
  if (tabs.length === 0) return <AccessDenied module="ai_integrations / management_api" />
  return <PageTabs tabs={tabs} ariaLabel={t('nav./settings.label', 'Settings')} />
}
