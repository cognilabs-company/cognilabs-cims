import { useState } from 'react'
import type { CommentAutomationMedia } from '../../../../shared/api/services/cognilabsai.service'
import { cn } from '../../../../shared/lib/cn'
import { InstagramGlyph } from './icons'
import { INSTAGRAM_GRADIENT, getPreviewUrl } from './shared'

function MediaImageContent({
  src,
  fit,
  className,
}: {
  src: string | null
  fit: 'cover' | 'contain'
  className?: string
}) {
  const [hasFailed, setHasFailed] = useState(false)

  if (!src || hasFailed) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ background: INSTAGRAM_GRADIENT }}>
        <InstagramGlyph className="h-1/4 max-h-12 w-1/4 max-w-12 text-white/90" data-keep-color="true" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setHasFailed(true)}
      className={cn(fit === 'cover' ? 'object-cover' : 'object-contain', className)}
    />
  )
}

export function MediaImage({
  media,
  fit = 'cover',
  className,
}: {
  media: CommentAutomationMedia
  fit?: 'cover' | 'contain'
  className?: string
}) {
  const src = getPreviewUrl(media)
  return <MediaImageContent key={src ?? media.media_id} src={src} fit={fit} className={className} />
}
