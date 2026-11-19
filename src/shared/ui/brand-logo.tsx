import type { CSSProperties } from 'react'
import wordmarkUrl from '../../assets/brand/logo-wordmark.png'
import { cn } from '../lib/cn'

/* The Cognilabs wordmark (our own lettering, cut from public/logo.png into a
   transparent mask), so it takes the text colour of wherever it sits. There is
   no picture logo any more: the name alone is the brand. */

const WORDMARK_RATIO = 401 / 96
/* Width of the leading "C" relative to the wordmark height. */
const MONOGRAM_RATIO = 0.6

function maskStyle(url: string, width: number, height: number, size = 'contain'): CSSProperties {
  return {
    width,
    height,
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: size,
    maskSize: size,
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

/** Just the "C" of the wordmark, for tight spots such as the collapsed sidebar rail. */
export function BrandMonogram({ height = 26, className }: { height?: number; className?: string }) {
  return <span role="img" aria-label="Cognilabs" className={cn('inline-block shrink-0 bg-current', className)} style={maskStyle(wordmarkUrl, Math.round(height * MONOGRAM_RATIO), height, 'auto 100%')} />
}
