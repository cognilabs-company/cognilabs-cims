import { createContext, createElement, useContext, type ReactNode } from 'react'
import { crmService, outboundCrmService, type CrmCustomerService } from '../../../shared/api/services/crm.service'

export type CrmScopeKind = 'crm' | 'outbound'

export type CrmScope = {
  kind: CrmScopeKind
  // API base used for customer endpoints (e.g. audio streaming URLs).
  apiBasePath: string
  // Frontend route prefix for list, archive and detail pages.
  routeBasePath: string
  // Namespaces browser storage so the two CRMs never share cached view state.
  storageKey: string
  title: string
  service: CrmCustomerService
}

export const crmScopes: Record<CrmScopeKind, CrmScope> = {
  crm: {
    kind: 'crm',
    apiBasePath: '/crm',
    routeBasePath: '/crm',
    storageKey: 'crm',
    title: 'CRM',
    service: crmService,
  },
  outbound: {
    kind: 'outbound',
    apiBasePath: '/outbound-crm',
    routeBasePath: '/outbound-crm',
    storageKey: 'outbound-crm',
    title: 'Outbound CRM',
    service: outboundCrmService,
  },
}

const CrmScopeContext = createContext<CrmScope>(crmScopes.crm)

export function CrmScopeProvider({ kind, children }: { kind: CrmScopeKind; children: ReactNode }) {
  return createElement(CrmScopeContext.Provider, { value: crmScopes[kind] }, children)
}

export function useCrmScope() {
  return useContext(CrmScopeContext)
}
