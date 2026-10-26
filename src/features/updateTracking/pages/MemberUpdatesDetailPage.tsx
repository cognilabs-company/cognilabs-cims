import { useNavigate } from 'react-router-dom'
import { ErrorStateBlock } from '../../../shared/ui/state-block'
import { useAuth } from '../../auth/hooks/useAuth'
import { FaultsMemberDetailPage } from '../../faults/pages/FaultsMemberDetailPage'

export function MemberUpdatesDetailPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  if (!user || !Number.isFinite(user.id) || user.id <= 0) {
    return (
      <ErrorStateBlock
        eyebrow="Updates / My Detail"
        title="Member detail unavailable"
        description="Current session does not include a valid member ID."
        actionLabel="Back to dashboard"
        onAction={() => navigate('/member/dashboard')}
      />
    )
  }

  return (
    <FaultsMemberDetailPage
      memberIdOverride={user.id}
      mode="member-updates"
    />
  )
}
