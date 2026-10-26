import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function BaseIcon({ children, strokeWidth = 1.8, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function GridIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </BaseIcon>
  )
}

export function PostIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </BaseIcon>
  )
}

export function ReelsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <path d="M2.5 8h19M8.5 2.5 11 8M14.5 2.5 17 8" />
      <path d="m10 11.5 5 3-5 3z" fill="currentColor" />
    </BaseIcon>
  )
}

export function CarouselIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="7" y="7" width="14" height="14" rx="2" fill="currentColor" stroke="none" />
      <path d="M17 4H5a2 2 0 0 0-2 2v12" />
    </BaseIcon>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
    </BaseIcon>
  )
}

export function CommentIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20.66 16.6A9 9 0 1 0 17.4 20l3.6 1z" />
    </BaseIcon>
  )
}

export function ReplyIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </BaseIcon>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M22 3 9.2 10.1" />
      <path d="M22 3 15 21l-5.8-10.9L3 7.8z" />
    </BaseIcon>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </BaseIcon>
  )
}

export function InstagramGlyph(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none" />
    </BaseIcon>
  )
}

export function ChevronIcon({ direction, ...props }: IconProps & { direction: 'left' | 'right' }) {
  return (
    <BaseIcon strokeWidth={2.2} {...props}>
      <path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </BaseIcon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <BaseIcon strokeWidth={2.2} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </BaseIcon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <BaseIcon strokeWidth={3} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </BaseIcon>
  )
}

export function ExternalIcon(props: IconProps) {
  return (
    <BaseIcon strokeWidth={2} {...props}>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </BaseIcon>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </BaseIcon>
  )
}
