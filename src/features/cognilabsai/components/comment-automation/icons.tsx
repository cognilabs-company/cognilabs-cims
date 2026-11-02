import type { SVGProps } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Film,
  Grid3x3,
  Image,
  Images,
  MessageCircle,
  Play,
  Reply,
  Send,
  Settings2,
  X,
} from 'lucide-react'

type IconProps = SVGProps<SVGSVGElement>

export function GridIcon(props: IconProps) {
  return <Grid3x3 strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function PostIcon(props: IconProps) {
  return <Image strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function ReelsIcon(props: IconProps) {
  return <Film strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function CarouselIcon(props: IconProps) {
  return <Images strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function PlayIcon(props: IconProps) {
  return <Play strokeWidth={1.8} fill="currentColor" aria-hidden="true" {...props} />
}

export function CommentIcon(props: IconProps) {
  return <MessageCircle strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function ReplyIcon(props: IconProps) {
  return <Reply strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function SendIcon(props: IconProps) {
  return <Send strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function AlertIcon(props: IconProps) {
  return <CircleAlert strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function InstagramGlyph(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ChevronIcon({ direction, ...props }: IconProps & { direction: 'left' | 'right' }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight

  return <Icon strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function CloseIcon(props: IconProps) {
  return <X strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function CheckIcon(props: IconProps) {
  return <Check strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function ExternalIcon(props: IconProps) {
  return <ArrowUpRight strokeWidth={1.8} aria-hidden="true" {...props} />
}

export function SettingsIcon(props: IconProps) {
  return <Settings2 strokeWidth={1.8} aria-hidden="true" {...props} />
}
