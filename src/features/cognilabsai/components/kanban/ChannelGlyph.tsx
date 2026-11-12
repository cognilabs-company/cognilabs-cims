import { GlobeSimpleIcon, InstagramLogoIcon, TelegramLogoIcon, type IconWeight } from '@phosphor-icons/react'
import type { ChannelKind } from './kanbanUtils'

const GLYPHS = {
  instagram: InstagramLogoIcon,
  telegram: TelegramLogoIcon,
  website: GlobeSimpleIcon,
} as const

/** The channel's logo (Instagram / Telegram / website globe) from the Phosphor set. */
export function ChannelGlyph({ kind, size = 16, weight = 'regular', className }: { kind: ChannelKind; size?: number; weight?: IconWeight; className?: string }) {
  const Icon = GLYPHS[kind]
  return <Icon size={size} weight={weight} className={className} aria-hidden="true" />
}
