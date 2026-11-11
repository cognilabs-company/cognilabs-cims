import type { CSSProperties } from 'react'
import wordmarkUrl from '../../assets/brand/logo-wordmark.png'
import squareUrl from '../../assets/brand/logo-square.png'
import { cn } from '../lib/cn'

/* The Cognilabs logo, cut from public/logo.png into transparent masks, so it
   takes the text colour of wherever it sits (dark on light, light on dark). */

const WORDMARK_RATIO = 401 / 96

function maskStyle(url: string, width: number, height: number): CSSProperties {
  return {
    width,
    height,
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'left center',
    maskPosition: 'left center',
  }
}

/** "Cognilabs" wordmark in the current text colour. */
export function BrandWordmark({ height = 20, className }: { height?: number; className?: string }) {
  return <span role="img" aria-label="Cognilabs" className={cn('inline-block shrink-0 bg-current', className)} style={maskStyle(wordmarkUrl, Math.round(height * WORDMARK_RATIO), height)} />
}

/** The official square Cognilabs logo (public/logo-org.jpg) — sidebar, login, splash. */
export function BrandMark({ size = 38, className }: { size?: number; className?: string }) {
  return (
    <img
      src={squareUrl}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      className={cn('shrink-0 object-cover shadow-[0_8px_18px_-10px_rgba(14,21,37,0.75)] ring-1 ring-black/10 select-none dark:ring-white/10', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
    />
  )
}
