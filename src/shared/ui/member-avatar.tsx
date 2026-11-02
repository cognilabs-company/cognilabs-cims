import { cn } from '../lib/cn'
import { resolveMediaUrl } from '../lib/media-url'
import { pickAvatarTone } from './avatar-tone'

export type MemberAvatarSize = 'xs' | 'sm' | 'md' | 'lg'

type MemberAvatarProps = {
  name?: string | null
  surname?: string | null
  imageUrl?: string | null
  size?: MemberAvatarSize
  className?: string
  title?: string
}

const sizeClasses: Record<MemberAvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-9 w-9 text-[11px]',
  lg: 'h-12 w-12 text-sm',
}

function getDisplayName(name?: string | null, surname?: string | null) {
  return [name, surname]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim()
}

function getInitials(name?: string | null, surname?: string | null) {
  const combined = getDisplayName(name, surname)

  if (!combined) {
    return 'MB'
  }

  const initials = combined
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return initials || 'MB'
}

export function MemberAvatar({
  name,
  surname,
  imageUrl,
  size = 'md',
  className,
  title,
}: MemberAvatarProps) {
  const displayName = getDisplayName(name, surname) || 'Member'
  const initials = getInitials(name, surname)
  const resolvedImageUrl = resolveMediaUrl(imageUrl) ?? imageUrl ?? null

  if (resolvedImageUrl) {
    return (
      <img
        src={resolvedImageUrl}
        alt={title ?? displayName}
        title={title ?? displayName}
        className={cn('shrink-0 rounded-full object-cover', sizeClasses[size], className)}
      />
    )
  }

  return (
    <span
      title={title ?? displayName}
      aria-label={title ?? displayName}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold select-none',
        sizeClasses[size],
        pickAvatarTone(displayName),
        className,
      )}
    >
      {initials}
    </span>
  )
}
