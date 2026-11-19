import { useAuth } from '../../auth/hooks/useAuth'
import { CallQualityPanel } from '../components/CallQualityPanel'

/** /call-quality — AI grades of recorded calls (the RBAC module "call_quality"). Only the CEO edits the scripts. */
export function CallQualityPage() {
  const { user } = useAuth()
  return (
    <div className="calls-ui page-enter">
      <CallQualityPanel isCeo={user?.role === 'CEO'} />
    </div>
  )
}
