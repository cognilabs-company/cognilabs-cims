import {
  ChatCircleIcon,
  FacebookLogoIcon,
  GlobeIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  PhoneIcon,
  TelegramLogoIcon,
  YoutubeLogoIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Facebook, Globe, Instagram, Linkedin, MessageCircle, Phone, Send, Youtube, type LucideIcon } from 'lucide-react'

type PlatformKind = 'instagram' | 'telegram' | 'facebook' | 'youtube' | 'linkedin' | 'phone' | 'web' | 'other'

function platformKind(value: string): PlatformKind {
  const key = value.toLowerCase()
  if (key.includes('insta')) return 'instagram'
  if (key.includes('telegram') || key === 'tg') return 'telegram'
  if (key.includes('facebook') || key === 'fb') return 'facebook'
  if (key.includes('youtube')) return 'youtube'
  if (key.includes('linkedin')) return 'linkedin'
  if (key.includes('phone') || key.includes('call') || key.includes('tel')) return 'phone'
  if (key.includes('web') || key.includes('site') || key.includes('sayt')) return 'web'
  return 'other'
}

const platformVisuals: Record<PlatformKind, { icon: LucideIcon; color: string }> = {
  instagram: { icon: Instagram, color: '#E1306C' },
  telegram: { icon: Send, color: '#229ED9' },
  facebook: { icon: Facebook, color: '#1877F2' },
  youtube: { icon: Youtube, color: '#FF0033' },
  linkedin: { icon: Linkedin, color: '#0A66C2' },
  phone: { icon: Phone, color: '#17924A' },
  web: { icon: Globe, color: '#2B59FF' },
  other: { icon: MessageCircle, color: '#8A90A2' },
}

const platformKpiIcons: Record<PlatformKind, Icon> = {
  instagram: InstagramLogoIcon,
  telegram: TelegramLogoIcon,
  facebook: FacebookLogoIcon,
  youtube: YoutubeLogoIcon,
  linkedin: LinkedinLogoIcon,
  phone: PhoneIcon,
  web: GlobeIcon,
  other: ChatCircleIcon,
}

/** Icon + brand colour for a lead source shown in the Customers table. */
export function platformVisual(value: string): { icon: LucideIcon; color: string } {
  return { ...platformVisuals[platformKind(value)] }
}

/** Phosphor icon of a lead source — KPI tiles (rendered duotone by MetricTile / StatCard). */
export function platformKpiIconFor(value: string): Icon {
  return platformKpiIcons[platformKind(value)]
}
