import { cn } from '../../../shared/lib/cn'
import { translateCurrent } from '../../../shared/i18n/translations'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { pickAvatarTone } from '../../../shared/ui/avatar-tone'
import { getInitials } from '../lib/format'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

type AvatarProps = {
  name?: string | null
  surname?: string | null
  imageUrl?: string | null
  size?: AvatarSize
  className?: string
  title?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
}

export function Avatar({ name, surname, imageUrl, size = 'md', className, title }: AvatarProps) {
  const displayName = [name, surname]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ') || translateCurrent('projects.unknown_user', 'Unknown user')
  const initials = getInitials(name, surname)
  const resolvedImageUrl = resolveMediaUrl(imageUrl) ?? imageUrl ?? null

  if (resolvedImageUrl) {
    return (
      <img
        src={resolvedImageUrl}
        alt={title ?? displayName}
        title={title ?? displayName}
        className={cn(
          'shrink-0 rounded-full object-cover',
          sizeClasses[size],
          className,
        )}
      />
    )
  }

  return (
    <span
      title={title ?? displayName}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        sizeClasses[size],
        pickAvatarTone(displayName),
        className,
      )}
      aria-label={title ?? displayName}
    >
      {initials}
    </span>
  )
}

type AvatarGroupProps = {
  users: Array<{ id: number; name?: string | null; surname?: string | null; email: string; profile_image?: string | null }>
  max?: number
  size?: AvatarSize
  className?: string
}

export function AvatarGroup({ users, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const visible = users.slice(0, max)
  const overflow = users.length - visible.length

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((user, idx) => (
        <div
          key={user.id}
          className="rounded-full ring-2 ring-[var(--surface)]"
          style={{ marginLeft: idx === 0 ? 0 : '-6px', zIndex: visible.length - idx }}
        >
          <Avatar name={user.name} surname={user.surname} imageUrl={user.profile_image} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--input-surface)] font-semibold text-[var(--muted-strong)] ring-2 ring-[var(--surface)] select-none',
            sizeClasses[size],
            'text-[10px]',
          )}
          style={{ marginLeft: '-6px' }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
