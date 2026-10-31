import { Suspense, lazy, type ReactElement } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AuthLayout } from './layouts/AuthLayout'
import { RootLayout } from './layouts/RootLayout'
import { GuestRoute } from '../features/auth/components/GuestRoute'
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute'
import { RouterAuthBoundary } from './providers/RouterAuthBoundary'
import { AsyncContentLoader } from '../shared/ui/async-content-loader'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { CHUNK_RELOAD_KEY, isDynamicImportError, tryRecoverFromChunkError } from './lib/chunkRecovery'

function lazyPage<T extends string>(
  loader: () => Promise<Record<T, () => ReactElement | null>>,
  exportName: T,
) {
  return lazy(async () => {
    try {
      const module = await loader()

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY)
      }

      return {
        default: module[exportName],
      }
    } catch (error) {
      if (isDynamicImportError(error) && tryRecoverFromChunkError()) {
        return new Promise<never>(() => {})
      }

      throw error
    }
  })
}

function withPageLoader(element: ReactElement, variant: 'page' | 'panel' = 'page') {
  return (
    <Suspense fallback={<AsyncContentLoader variant={variant} />}>
      {element}
    </Suspense>
  )
}

const DashboardRedirectPage = lazyPage(
  () => import('../features/auth/pages/DashboardRedirectPage'),
  'DashboardRedirectPage',
)
const ForgotPasswordPage = lazyPage(
  () => import('../features/auth/pages/ForgotPasswordPage'),
  'ForgotPasswordPage',
)
const LoginPage = lazyPage(() => import('../features/auth/pages/LoginPage'), 'LoginPage')
const ResetPasswordPage = lazyPage(
  () => import('../features/auth/pages/ResetPasswordPage'),
  'ResetPasswordPage',
)
const VerifyEmailPage = lazyPage(
  () => import('../features/auth/pages/VerifyEmailPage'),
  'VerifyEmailPage',
)
const CeoDashboardPage = lazyPage(
  () => import('../features/ceo/pages/CeoDashboardPage'),
  'CeoDashboardPage',
)
const CeoAiChatPage = lazyPage(
  () => import('../features/ceo/pages/CeoAiChatPage'),
  'CeoAiChatPage',
)
const CimsTeamPage = lazyPage(() => import('../features/ceo/pages/CimsTeamPage'), 'CimsTeamPage')
const CeoManagementPage = lazyPage(
  () => import('../features/ceo/pages/CeoManagementPage'),
  'CeoManagementPage',
)
const CeoTeamUpdatesPage = lazyPage(
  () => import('../features/ceo/pages/CeoTeamUpdatesPage'),
  'CeoTeamUpdatesPage',
)
const CeoUsersPage = lazyPage(() => import('../features/ceo/pages/CeoUsersPage'), 'CeoUsersPage')
const WebsiteStatsPage = lazyPage(
  () => import('../features/ceo/pages/WebsiteStatsPage'),
  'WebsiteStatsPage',
)
const CeoWorkdayOverridesPage = lazyPage(
  () => import('../features/ceo/pages/CeoWorkdayOverridesPage'),
  'CeoWorkdayOverridesPage',
)
const CrmDashboardPage = lazyPage(
  () => import('../features/crm/pages/CrmDashboardPage'),
  'CrmDashboardPage',
)
const CrmArchivedPage = lazyPage(
  () => import('../features/crm/pages/CrmArchivedPage'),
  'CrmArchivedPage',
)
const MyLeadsPage = lazyPage(
  () => import('../features/crm/pages/MyLeadsPage'),
  'MyLeadsPage',
)
const CustomerDetailPage = lazyPage(
  () => import('../features/crm/pages/CustomerDetailPage'),
  'CustomerDetailPage',
)
const OutboundCrmDashboardPage = lazyPage(
  () => import('../features/outbound-crm/pages/OutboundCrmPages'),
  'OutboundCrmDashboardPage',
)
const OutboundCrmArchivedPage = lazyPage(
  () => import('../features/outbound-crm/pages/OutboundCrmPages'),
  'OutboundCrmArchivedPage',
)
const OutboundCustomerDetailPage = lazyPage(
  () => import('../features/outbound-crm/pages/OutboundCrmPages'),
  'OutboundCustomerDetailPage',
)
const OutboundCrmStatusesPage = lazyPage(
  () => import('../features/outbound-crm/pages/OutboundCrmStatusesPage'),
  'OutboundCrmStatusesPage',
)
const FaultsMemberDetailPage = lazyPage(
  () => import('../features/faults/pages/FaultsMemberDetailPage'),
  'FaultsMemberDetailPage',
)
const FaultsPage = lazyPage(() => import('../features/faults/pages/FaultsPage'), 'FaultsPage')
const MemberDashboardPage = lazyPage(
  () => import('../features/member/pages/MemberDashboardPage'),
  'MemberDashboardPage',
)
const NotFoundPage = lazyPage(() => import('../features/errors/pages/NotFoundPage'), 'NotFoundPage')
const MemberUpdatesDetailPage = lazyPage(
  () => import('../features/updateTracking/pages/MemberUpdatesDetailPage'),
  'MemberUpdatesDetailPage',
)
const UpdateTrackingPage = lazyPage(
  () => import('../features/updateTracking/pages/UpdateTrackingPage'),
  'UpdateTrackingPage',
)
const ProjectsListPage = lazyPage(
  () => import('../features/projects/pages/ProjectsListPage'),
  'ProjectsListPage',
)
const ProjectDetailPage = lazyPage(
  () => import('../features/projects/pages/ProjectDetailPage'),
  'ProjectDetailPage',
)
const BoardDetailPage = lazyPage(
  () => import('../features/projects/pages/BoardDetailPage'),
  'BoardDetailPage',
)
const CognilabsAIChatPage = lazyPage(
  () => import('../features/cognilabsai/pages/CognilabsAIChatPage'),
  'CognilabsAIChatPage',
)
const CognilabsAIIntegrationsPage = lazyPage(
  () => import('../features/cognilabsai/pages/CognilabsAIIntegrationsPage'),
  'CognilabsAIIntegrationsPage',
)
const CognilabsAIMediaContextsPage = lazyPage(
  () => import('../features/cognilabsai/pages/CognilabsAIMediaContextsPage'),
  'CognilabsAIMediaContextsPage',
)
const CognilabsAIKanbanPage = lazyPage(
  () => import('../features/cognilabsai/pages/CognilabsAIKanbanPage'),
  'CognilabsAIKanbanPage',
)
const CognilabsAICommentAutomationPage = lazyPage(
  () => import('../features/cognilabsai/pages/CognilabsAICommentAutomationPage'),
  'CognilabsAICommentAutomationPage',
)
const AuditLogsPage = lazyPage(
  () => import('../features/auditLogs/pages/AuditLogsPage'),
  'AuditLogsPage',
)
const DeveloperKpiPage = lazyPage(
  () => import('../features/developer-kpi/pages/DeveloperKpiPage'),
  'DeveloperKpiPage',
)
const AttendanceManagementPage = lazyPage(
  () => import('../features/attendance/pages/AttendanceManagementPage'),
  'AttendanceManagementPage',
)
const PersonalAttendancePage = lazyPage(
  () => import('../features/attendance/pages/PersonalAttendancePage'),
  'PersonalAttendancePage',
)

export const router = createBrowserRouter([
  {
    element: <RouterAuthBoundary />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/',
            element: <RootLayout />,
            errorElement: <RouteErrorBoundary />,
            children: [
              {
                index: true,
                element: withPageLoader(<DashboardRedirectPage />),
              },
              {
                path: 'dashboard-redirect',
                element: withPageLoader(<DashboardRedirectPage />),
              },
              {
                path: 'member/dashboard',
                element: (
                  <ProtectedRoute audience="member">
                    {withPageLoader(<MemberDashboardPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'member/attendance',
                element: (
                  <ProtectedRoute audience="member">
                    {withPageLoader(<PersonalAttendancePage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'member',
                element: (
                  <ProtectedRoute audience="member">
                    <Navigate to="/member/dashboard" replace />
                  </ProtectedRoute>
                ),
              },
              {
                path: 'ceo/dashboard',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<CeoDashboardPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'ceo/attendance',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<AttendanceManagementPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'ceo',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    <Navigate to="/ceo/dashboard" replace />
                  </ProtectedRoute>
                ),
              },
              {
                path: 'ceo/users',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<CeoUsersPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'ceo/ai',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<CeoAiChatPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'cims-team',
                element: withPageLoader(<CimsTeamPage />),
              },
              {
                path: 'ceo/cims-team',
                element: (
                  <Navigate to="/cims-team" replace />
                ),
              },
              {
                path: 'ceo/management',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<CeoManagementPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'ceo/team-updates',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<CeoTeamUpdatesPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'ceo/website-stats',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<WebsiteStatsPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'ceo/workday-overrides',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<CeoWorkdayOverridesPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'crm',
                element: (
                  <ProtectedRoute permissionKey="crm">
                    {withPageLoader(<CrmDashboardPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'crm/customers/:customerId',
                element: (
                  <ProtectedRoute permissionKey="crm">
                    {withPageLoader(<CustomerDetailPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'crm/archived',
                element: (
                  <ProtectedRoute permissionKey="crm">
                    {withPageLoader(<CrmArchivedPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'crm/my-leads',
                element: (
                  <ProtectedRoute permissionKey="crm" audience="sales_manager">
                    {withPageLoader(<MyLeadsPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'outbound-crm',
                element: (
                  <ProtectedRoute permissionKey="crm_outbound">
                    {withPageLoader(<OutboundCrmDashboardPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'outbound-crm/customers/:customerId',
                element: (
                  <ProtectedRoute permissionKey="crm_outbound">
                    {withPageLoader(<OutboundCustomerDetailPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'outbound-crm/archived',
                element: (
                  <ProtectedRoute permissionKey="crm_outbound">
                    {withPageLoader(<OutboundCrmArchivedPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'outbound-crm/statuses',
                element: (
                  <ProtectedRoute permissionKey="crm_outbound">
                    {withPageLoader(<OutboundCrmStatusesPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'faults',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<FaultsPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'faults/members/:memberId',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<FaultsMemberDetailPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'updates',
                element: (
                  <ProtectedRoute permissionKey="update_list" audience="member">
                    {withPageLoader(<UpdateTrackingPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'updates/detail',
                element: (
                  <ProtectedRoute permissionKey="update_list" audience="member">
                    {withPageLoader(<MemberUpdatesDetailPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'projects',
                element: (
                  <ProtectedRoute>
                    {withPageLoader(<ProjectsListPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'projects/:projectId',
                element: (
                  <ProtectedRoute>
                    {withPageLoader(<ProjectDetailPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'boards/:boardId',
                element: (
                  <ProtectedRoute>
                    {withPageLoader(<BoardDetailPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'cognilabsai/chat',
                element: (
                  <ProtectedRoute permissionKey="cognilabsai_chat">
                    {withPageLoader(<CognilabsAIChatPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'cognilabsai/integrations',
                element: (
                  <ProtectedRoute permissionKey="cognilabsai_integrations">
                    {withPageLoader(<CognilabsAIIntegrationsPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'cognilabsai/media-contexts',
                element: (
                  <ProtectedRoute permissionKey="cognilabsai_chat">
                    {withPageLoader(<CognilabsAIMediaContextsPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'cognilabsai/kanban',
                element: (
                  <ProtectedRoute permissionKey="cognilabsai_chat">
                    {withPageLoader(<CognilabsAIKanbanPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'cognilabsai/comment-automation',
                element: (
                  <ProtectedRoute permissionKey="cognilabsai_integrations">
                    {withPageLoader(<CognilabsAICommentAutomationPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'cognilabsai',
                element: (
                  <ProtectedRoute permissionKey="cognilabsai_chat">
                    <Navigate to="/cognilabsai/chat" replace />
                  </ProtectedRoute>
                ),
              },
              {
                path: 'audit/logs',
                element: (
                  <ProtectedRoute permissionKey="ceo">
                    {withPageLoader(<AuditLogsPage />)}
                  </ProtectedRoute>
                ),
              },
              {
                path: 'developer-kpi',
                element: (
                  <ProtectedRoute>
                    {withPageLoader(<DeveloperKpiPage />)}
                  </ProtectedRoute>
                ),
              },
            ],
          },
        ],
      },
      {
        path: '/auth',
        element: <GuestRoute />,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="login" replace />,
              },
              {
                path: 'login',
                element: withPageLoader(<LoginPage />, 'panel'),
              },
              {
                path: 'register',
                element: <Navigate to="/auth/login" replace />,
              },
              {
                path: 'verify-email',
                element: withPageLoader(<VerifyEmailPage />, 'panel'),
              },
              {
                path: 'forgot-password',
                element: withPageLoader(<ForgotPasswordPage />, 'panel'),
              },
              {
                path: 'reset-password',
                element: withPageLoader(<ResetPasswordPage />, 'panel'),
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: withPageLoader(<NotFoundPage />),
      },
    ],
  },
])
