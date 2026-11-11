import { Gauge, Wallet } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import { AccessDenied } from '../../auth/components/AccessDenied'
import { PageTabs, type PageTab } from '../../../shared/ui/page-tabs'
import { FaultsPage } from './FaultsPage'
import { DeveloperKpiPage } from '../../developer-kpi/pages/DeveloperKpiPage'

/** /salary — salary estimates and developer KPI in one place (each tab follows its RBAC module). */
export function SalaryKpiPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const tabs: PageTab[] = [
    ...(can('salary') ? [{ key: 'salary', label: t('nav./faults.label', 'Salary estimates'), icon: Wallet, render: () => <FaultsPage /> }] : []),
    ...(can('developer_kpi') ? [{ key: 'kpi', label: t('nav./developer-kpi.label', 'Developer KPI'), icon: Gauge, render: () => <DeveloperKpiPage /> }] : []),
  ]
  if (tabs.length === 0) return <AccessDenied module="salary / developer_kpi" />
  return <PageTabs tabs={tabs} ariaLabel={t('nav./salary.label', 'Salary & KPI')} />
}
