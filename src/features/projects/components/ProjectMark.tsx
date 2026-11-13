import { cn } from '../../../shared/lib/cn'
import { resolveMediaUrl } from '../../../shared/lib/media-url'
import { projectArt } from '../lib/projectArt'
import { projectInitial } from '../lib/projectLook'

type ProjectMarkProps = {
  projectId: number
  name: string
  image?: string | null
  /** Side in px. */
  size?: number
  className?: string
}

/**
 * A project's mark: its 3D object (the same one as on its card), else its uploaded logo, else its
 * initial on a quiet neutral tile — no per-project colours.
 */
export function ProjectMark({ projectId, name, image, size = 40, className }: ProjectMarkProps) {
  const art = projectArt(projectId)
  const logo = resolveMediaUrl(image) ?? image ?? null
  const radius = Math.round(size * 0.28)

  if (art) {
    return (
      <img
        src={art.src}
        alt=""
        decoding="async"
        draggable={false}
        className={cn('shrink-0 object-contain select-none', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn('shrink-0 object-cover ring-1 ring-[var(--border)]', className)}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center bg-[var(--input-surface)] font-semibold text-[var(--muted-strong)] ring-1 ring-[var(--border)] select-none ring-inset', className)}
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.42) }}
    >
      {projectInitial(name)}
    </span>
  )
}
