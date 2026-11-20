import type { CSSProperties } from 'react'
import { cn } from '../../../shared/lib/cn'

/* Small animated pieces of the Mini App (styles in miniapp.css; all of them calm down with reduced motion). */

const vars = (values: Record<string, string | number>) => values as CSSProperties

/** Boot loader: a spinning conic ring, satellites on two orbits and a glowing core. */
export function OrbitLoader({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col items-center">
      <div className="m-orbit">
        <span className="m-orbit-ring" />
        <span className="m-orbit-track" style={vars({ '--inset': '10px', '--d': '2.2s' })}><i /></span>
        <span className="m-orbit-track" style={vars({ '--inset': '18px', '--d': '3.1s', '--dir': 'reverse', '--c': 'var(--primary)' })}><i /></span>
        <span className="m-orbit-core">
          <span className="m-display text-[15px] font-bold text-[var(--m-lime)]">C</span>
        </span>
      </div>
      <p className="m-wave-text m-display mt-6 text-[13px] font-semibold tracking-[0.42em] text-[var(--muted-strong)]" aria-hidden="true">
        {'CIMS'.split('').map((char, index) => <span key={index} style={vars({ '--i': index })}>{char}</span>)}
      </p>
    </div>
  )
}

/** Shimmering placeholder block. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={cn('m-skel', className)} style={style} />
}

/** Digits roll in when they change (each digit is keyed by its value). */
export function Odometer({ value, className }: { value: string; className?: string }) {
  return (
    <span role="timer" aria-label={value} className={cn('m-odo', className)}>
      {value.split('').map((char, index) => (
        <span key={`${index}-${char}`} aria-hidden="true" className={/\d/.test(char) ? 'm-odo-d' : 'm-odo-s'}>{char}</span>
      ))}
    </span>
  )
}

/** A ring of particles flying out once (success). */
export function Burst({ count = 12, radius = 46 }: { count?: number; radius?: number }) {
  return (
    <span className="m-burst" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i
          key={index}
          style={vars({
            '--a': `${(360 / count) * index}deg`,
            '--r': `${radius + (index % 3) * 8}px`,
            '--c': index % 3 === 0 ? 'var(--primary)' : index % 3 === 1 ? 'var(--m-lime)' : 'var(--m-coral)',
            animationDelay: `${(index % 4) * 30}ms`,
          })}
        />
      ))}
    </span>
  )
}

/** A tick that draws itself. */
export function DrawnTick({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn('m-tick', className)}>
      <path d="m5 12.6 4.4 4.4L19 7.4" style={vars({ '--len': 22 })} />
    </svg>
  )
}

/** Radar sweep with pings (looking for a GPS fix). */
export function Radar({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('m-radar block', className)}>
      <span className="m-radar-sweep" />
      <span className="m-radar-ping" />
      <span className="m-radar-ping" style={vars({ '--delay': '0.9s' })} />
    </span>
  )
}

/** Three bouncing dots. */
export function Dots({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('m-dots', className)}><i /><i /><i /></span>
}

/** Two arcs turning in opposite directions. */
export function Arcs({ size = 20, className }: { size?: number; className?: string }) {
  return <span aria-hidden="true" className={cn('m-arcs', className)} style={{ width: size, height: size }}><i /><i /></span>
}

/** Voice bars while a call is connected (decorative). */
export function VoiceBars({ className }: { className?: string }) {
  const heights = [10, 18, 26, 16, 22, 12, 20]
  return (
    <span aria-hidden="true" className={cn('m-bars inline-flex items-center gap-[3px]', className)}>
      {heights.map((height, index) => <i key={index} style={{ height, animationDelay: `${index * 0.11}s`, animationDuration: `${0.8 + (index % 3) * 0.25}s` }} />)}
    </span>
  )
}
