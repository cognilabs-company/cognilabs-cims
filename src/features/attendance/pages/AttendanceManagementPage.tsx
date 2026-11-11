import { lazy, Suspense, type ReactNode } from 'react'
import { CalendarCheck, History, MapPin, MapPinned } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useAuth } from '../../auth/hooks/useAuth'
import { PageTabs, type PageTab } from '../../../shared/ui/page-tabs'
import { LoadingStateBlock } from '../../../shared/ui/state-block'
import { AttendanceRecordsTab } from '../components/AttendanceRecordsTab'

// The location tabs carry Leaflet; load them only when one is opened.
const LocationsTab = lazy(() => import('../components/locations/LocationsTab').then((module) => ({ default: module.LocationsTab })))
const LiveMapTab = lazy(() => import('../components/locations/LiveMapTab').then((module) => ({ default: module.LiveMapTab })))
const LocationHistoryTab = lazy(() => import('../components/locations/LocationHistoryTab').then((module) => ({ default: module.LocationHistoryTab })))

/** /ceo/attendance — FaceID records plus GPS locations, the live map and location history. */
export function AttendanceManagementPage() {
  const { t } = useLocale()
  const { can } = useAuth()
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
  ]
  return <PageTabs tabs={tabs} ariaLabel={t('attendance.loc.tabs_label', 'Attendance sections')} />
}
