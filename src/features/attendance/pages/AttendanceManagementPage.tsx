import { lazy, Suspense, type ReactNode } from 'react'
import { BellDot, CalendarCheck, History, MapPin, MapPinned } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import { PageTabs, type PageTab } from '../../../shared/ui/page-tabs'
import { LoadingStateBlock } from '../../../shared/ui/state-block'
import { AttendanceRecordsTab } from '../components/AttendanceRecordsTab'
import { ManualCheckOutButton } from '../components/ManualCheckOutButton'
import { AttendanceNotificationsSettings } from '../../attendanceNotifications/AttendanceNotificationsSettings'

// The location tabs carry Leaflet; load them only when one is opened.
const LocationsTab = lazy(() => import('../components/locations/LocationsTab').then((module) => ({ default: module.LocationsTab })))
const LiveMapTab = lazy(() => import('../components/locations/LiveMapTab').then((module) => ({ default: module.LiveMapTab })))
const LocationHistoryTab = lazy(() => import('../components/locations/LocationHistoryTab').then((module) => ({ default: module.LocationHistoryTab })))

/** /ceo/attendance — FaceID records plus GPS locations, the live map, location history and (CEO) Telegram notifications. */
export function AttendanceManagementPage() {
  const { t } = useLocale()
  const { can, access, user } = useAuth()
  // Attendance notifications are CEO-only in the backend (the owner in /rbac/me).
  const isOwner = Boolean(access?.is_owner) || user?.role === 'CEO'
  const lazyTab = (node: ReactNode) => (
    <Suspense fallback={<LoadingStateBlock eyebrow={t('attendance.loc.tab_locations', 'Locations')} title={t('attendance.loc.loading_tab', 'Loading…')} />}>
      {node}
    </Suspense>
  )
  const tabs: PageTab[] = [
    { key: 'records', label: t('attendance.loc.tab_records', 'Attendance'), icon: CalendarCheck, render: () => <AttendanceRecordsTab /> },
    ...(can('attendance')
      ? [
          { key: 'locations', label: t('attendance.loc.tab_locations', 'Locations'), icon: MapPin, render: () => lazyTab(<LocationsTab />) },
          { key: 'live', label: t('attendance.loc.tab_live', 'Live map'), icon: MapPinned, render: () => lazyTab(<LiveMapTab />) },
          { key: 'history', label: t('attendance.loc.tab_history', 'Location history'), icon: History, render: () => lazyTab(<LocationHistoryTab />) },
        ]
      : []),
    ...(isOwner ? [{ key: 'notifications', label: t('attnotify.tab_short', 'Notifications'), icon: BellDot, render: () => <AttendanceNotificationsSettings /> }] : []),
  ]
  return (
    <>
      <ManualCheckOutButton />
      <PageTabs tabs={tabs} ariaLabel={t('attendance.loc.tabs_label', 'Attendance sections')} />
    </>
  )
}
