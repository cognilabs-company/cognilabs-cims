import type { RegistrationStatus } from '../../../shared/api/services/registrations.service'
import { useLocale } from '../../../app/hooks/useLocale'
import { Badge } from '../../../shared/ui/badge'
import { statusLabel } from '../lib/labels'

const VARIANTS = { pending: 'warning', approved: 'success', rejected: 'danger' } as const

export function RegistrationStatusBadge({ status, size = 'md', className }: { status: RegistrationStatus; size?: 'sm' | 'md'; className?: string }) {
  const { t } = useLocale()
  return (
    <Badge variant={VARIANTS[status]} size={size} dot className={className}>
      {statusLabel(t, status)}
    </Badge>
  )
}
