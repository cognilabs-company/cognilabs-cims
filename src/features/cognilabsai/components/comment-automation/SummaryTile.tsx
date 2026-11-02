import type { ReactNode } from 'react'
import { StatCard } from '../../../../shared/ui/stat-card'
import type { Tone } from '../../../../shared/ui/tone'

const accentTone: Record<'default' | 'danger' | 'blue' | 'success', Tone> = {
  default: 'neutral',
  danger: 'danger',
  blue: 'blue',
  success: 'success',
}

export function SummaryTile({
  label,
  value,
  hint,
  accent = 'default',
  icon,
  solid = false,
}: {
  label: string
  value: string | number
  hint?: string
  accent?: keyof typeof accentTone
  icon?: ReactNode
  solid?: boolean
}) {
  return (
    <StatCard
      label={label}
      value={value}
      hint={hint}
      icon={icon}
      iconTone={accentTone[accent]}
      solid={solid}
    />
  )
}
