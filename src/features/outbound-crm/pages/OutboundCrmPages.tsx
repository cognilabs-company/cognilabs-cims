import { CrmArchivedPage } from '../../crm/pages/CrmArchivedPage'
import { CrmDashboardPage } from '../../crm/pages/CrmDashboardPage'
import { CustomerDetailPage } from '../../crm/pages/CustomerDetailPage'
import { CrmScopeProvider } from '../../crm/lib/crmScope'

// Outbound CRM reuses the CRM screens; the scope swaps the API base, routes and storage keys.
export function OutboundCrmDashboardPage() {
  return (
    <CrmScopeProvider kind="outbound">
      <CrmDashboardPage />
    </CrmScopeProvider>
  )
}

export function OutboundCrmArchivedPage() {
  return (
    <CrmScopeProvider kind="outbound">
      <CrmArchivedPage />
    </CrmScopeProvider>
  )
}

export function OutboundCustomerDetailPage() {
  return (
    <CrmScopeProvider kind="outbound">
      <CustomerDetailPage />
    </CrmScopeProvider>
  )
}
