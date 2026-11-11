import type { CSSProperties } from 'react'
import wordmarkUrl from '../../assets/brand/logo-wordmark.png'
import markUrl from '../../assets/brand/logo-mark.png'
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

/** The serif "C" on a dark tile — app icon, collapsed sidebar, splash. */
export function BrandMark({ size = 38, className }: { size?: number; className?: string }) {
  const glyph = Math.round(size * 0.62)
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center bg-[#0e1525] text-white shadow-[0_8px_18px_-10px_rgba(14,21,37,0.75)] ring-1 ring-white/10', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.29) }}
    >
      <span className="block bg-current" style={{ ...maskStyle(markUrl, glyph, glyph), WebkitMaskPosition: 'center', maskPosition: 'center' }} />
    </span>
  )
}
