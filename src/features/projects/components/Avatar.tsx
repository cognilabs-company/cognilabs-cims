import { useTheme } from '../../../app/hooks/useTheme'
import { cn } from '../../../shared/lib/cn'
import { translateCurrent } from '../../../shared/i18n/translations'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { getInitials, stringToHue } from '../lib/format'

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
  xs: 'h-5 w-5 text-[11px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
}

export function Avatar({ name, surname, imageUrl, size = 'md', className, title }: AvatarProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const displayName = [name, surname]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ') || translateCurrent('projects.unknown_user', 'Unknown user')
  const initials = getInitials(name, surname)
  const hue = stringToHue(displayName)
  const resolvedImageUrl = resolveMediaUrl(imageUrl) ?? imageUrl ?? null

  if (resolvedImageUrl) {
    return (
      <img
        src={resolvedImageUrl}
        alt={title ?? displayName}
        title={title ?? displayName}
        className={cn(
          'rounded-full object-cover',
          sizeClasses[size],
          isLight
            ? 'border border-white shadow-[0_8px_18px_rgba(15,23,42,0.10),0_0_0_1px_rgba(203,213,225,0.95)]'
            : 'border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
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
        className,
      )}
      style={{
        background: isLight
          ? `linear-gradient(180deg, hsl(${hue}, 82%, 93%), hsl(${hue}, 72%, 87%))`
          : `hsl(${hue}, 55%, 20%)`,
        color: isLight
          ? `hsl(${hue}, 68%, 28%)`
          : `hsl(${hue}, 75%, 72%)`,
        boxShadow: isLight
          ? `0 8px 18px rgba(15,23,42,0.08), 0 0 0 1px hsl(${hue}, 42%, 74%)`
          : `0 0 0 2px hsl(${hue}, 40%, 14%)`,
      }}
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
          className="ring-2 ring-[var(--surface)] rounded-full"
          style={{ marginLeft: idx === 0 ? 0 : '-6px', zIndex: visible.length - idx }}
        >
          <Avatar name={user.name} surname={user.surname} imageUrl={user.profile_image} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-semibold text-[var(--muted-strong)] ring-2 ring-[var(--surface)] select-none',
            sizeClasses[size],
          )}
          style={{ marginLeft: '-6px', fontSize: '9px' }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
