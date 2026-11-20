import type { ReactNode } from 'react'

/*
 * The Mini App's own icon set ("Pulse"): 24 px grid, rounded 1.9 px strokes and a soft tinted
 * shape behind the main line ("duo"). Drawn for CIMS; every icon follows currentColor, so it
 * works in light and dark themes and inside coloured buttons.
 */

export type IconProps = {
  size?: number
  className?: string
  strokeWidth?: number
  /** Opacity of the tinted shape (0 hides it). */
  duo?: number
}

function Svg({ size = 22, className, strokeWidth = 1.9, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  )
}

/** The tinted shape: filled with currentColor at a low opacity. */
function Duo({ d, value = 0.18 }: { d: string; value?: number }) {
  return value > 0 ? <path d={d} fill="currentColor" stroke="none" opacity={value} /> : null
}

const HANDSET = 'M6.2 3.6h2.6c.5 0 .9.3 1 .8l.9 3.1c.1.4 0 .8-.3 1.1L8.9 10a11.5 11.5 0 0 0 5.1 5.1l1.4-1.5c.3-.3.7-.4 1.1-.3l3.1.9c.5.1.8.5.8 1v2.6c0 1.1-.9 2-2 2A16.3 16.3 0 0 1 4.2 5.6c0-1.1.9-2 2-2z'

export function IcPhone({ duo, ...props }: IconProps) {
  return <Svg {...props}><Duo d={HANDSET} value={duo} /><path d={HANDSET} /></Svg>
}

export function IcPhoneIn({ duo, ...props }: IconProps) {
  return <Svg {...props}><Duo d={HANDSET} value={duo} /><path d={HANDSET} /><path d="M20.3 3.7 15.2 8.8M15.2 4.9v3.9h3.9" /></Svg>
}

export function IcPhoneOut({ duo, ...props }: IconProps) {
  return <Svg {...props}><Duo d={HANDSET} value={duo} /><path d={HANDSET} /><path d="m15.2 8.8 5.1-5.1M16.4 3.7h3.9v3.9" /></Svg>
}

export function IcPhoneMissed({ duo, ...props }: IconProps) {
  return <Svg {...props}><Duo d={HANDSET} value={duo} /><path d={HANDSET} /><path d="m15.4 3.9 4.6 4.6M20 3.9l-4.6 4.6" /></Svg>
}

/** Hang up: the handset lying down. */
export function IcHangup({ duo, ...props }: IconProps) {
  const d = 'M2.6 13.9c5.2-4.9 13.6-4.9 18.8 0 .4.4.4 1 0 1.4l-1.8 1.8c-.4.4-1 .4-1.4.1l-2.3-1.7c-.3-.2-.4-.5-.4-.8v-2.2a12 12 0 0 0-7 0v2.2c0 .3-.1.6-.4.8l-2.3 1.7c-.4.3-1 .3-1.4-.1l-1.8-1.8c-.4-.4-.4-1 0-1.4z'
  return <Svg {...props}><Duo d={d} value={duo} /><path d={d} /></Svg>
}

export function IcPin({ duo, ...props }: IconProps) {
  const body = 'M12 21.2s-6.8-5.7-6.8-11.3a6.8 6.8 0 0 1 13.6 0c0 5.6-6.8 11.3-6.8 11.3z'
  return <Svg {...props}><Duo d={body} value={duo} /><path d={body} /><circle cx="12" cy="9.9" r="2.5" /></Svg>
}

/** A pin with nothing around it — "no places yet". */
export function IcPinGhost({ duo, ...props }: IconProps) {
  const body = 'M12 18.7s-5.6-4.7-5.6-9.4a5.6 5.6 0 0 1 11.2 0c0 4.7-5.6 9.4-5.6 9.4z'
  return (
    <Svg {...props}>
      <Duo d={body} value={duo} />
      <path d={body} />
      <circle cx="12" cy="9.3" r="1.9" />
      <path d="M7.5 21.2h9" strokeDasharray="2 2.6" />
    </Svg>
  )
}

export function IcMap({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M8.8 4.4 15.2 7v13l-6.4-2.6z" value={duo} />
      <path d="M3.5 6.6 8.8 4.4 15.2 7l5.3-2.2v12.6l-5.3 2.2-6.4-2.6-5.3 2.2z" />
      <path d="M8.8 4.4v12.6M15.2 7v12.6" />
    </Svg>
  )
}

export function IcCamera({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M12 9.3a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z" value={duo} />
      <path d="M3.8 9a2.2 2.2 0 0 1 2.2-2.2h1.6l1.5-2.1h5.8l1.5 2.1H18A2.2 2.2 0 0 1 20.2 9v8.2a2.2 2.2 0 0 1-2.2 2.2H6a2.2 2.2 0 0 1-2.2-2.2z" />
      <circle cx="12" cy="12.9" r="3.6" />
      <path d="M17.2 9.8h.01" strokeWidth={2.6} />
    </Svg>
  )
}

/** Switch between the front and back camera. */
export function IcFlip(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.6 11.2A7.5 7.5 0 0 1 17.9 7" />
      <path d="M18.3 3.6V7.4h-3.8" />
      <path d="M19.4 12.8A7.5 7.5 0 0 1 6.1 17" />
      <path d="M5.7 20.4v-3.8h3.8" />
    </Svg>
  )
}

export function IcImage({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M20.2 15.8 16 11.6 7.4 20.2h10.6a2.2 2.2 0 0 0 2.2-2.2z" value={duo} />
      <rect x="3.8" y="4.6" width="16.4" height="15.6" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20.2 15.8-4.2-4.2-8.6 8.6" />
    </Svg>
  )
}

export function IcClose(props: IconProps) {
  return <Svg {...props}><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" /></Svg>
}

export function IcCheck(props: IconProps) {
  return <Svg {...props}><path d="m5 12.6 4.4 4.4L19 7.4" /></Svg>
}

export function IcCheckCircle({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" value={duo} />
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.3 2.6 2.6 5-5.2" />
    </Svg>
  )
}

export function IcWarning({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" value={duo} />
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.6v5.2" />
      <path d="M12 16.3h.01" strokeWidth={2.6} />
    </Svg>
  )
}

export function IcRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4.2v4.5h-4.5" />
    </Svg>
  )
}

export function IcCalendar({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M3.8 10.2h16.4V8a3 3 0 0 0-3-3H6.8a3 3 0 0 0-3 3z" value={duo} />
      <rect x="3.8" y="5" width="16.4" height="15.4" rx="3" />
      <path d="M3.8 10.2h16.4M8.2 3v3.6M15.8 3v3.6" />
      <path d="M15.6 15.2h.01" strokeWidth={2.8} />
    </Svg>
  )
}

export function IcChevronLeft(props: IconProps) {
  return <Svg {...props}><path d="m14.5 5.8-6.2 6.2 6.2 6.2" /></Svg>
}

export function IcChevronRight(props: IconProps) {
  return <Svg {...props}><path d="m9.5 5.8 6.2 6.2-6.2 6.2" /></Svg>
}

export function IcChevronDown(props: IconProps) {
  return <Svg {...props}><path d="m5.8 9.5 6.2 6.2 6.2-6.2" /></Svg>
}

/** GPS fix. */
export function IcTarget({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M12 5.4a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2z" value={duo} />
      <circle cx="12" cy="12" r="6.6" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
      <path d="M12 2.6v2.8M12 18.6v2.8M2.6 12h2.8M18.6 12h2.8" />
    </Svg>
  )
}

/** Settings as two sliders. */
export function IcSliders(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7.2h8.4M17.6 7.2H20M4 16.8h2.4M11.6 16.8H20" />
      <circle cx="15" cy="7.2" r="2.4" />
      <circle cx="9" cy="16.8" r="2.4" />
    </Svg>
  )
}

/** Check in: stepping through a door. */
export function IcArrive({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M13.2 4h4.4a2.2 2.2 0 0 1 2.2 2.2v11.6a2.2 2.2 0 0 1-2.2 2.2h-4.4z" value={duo} />
      <path d="M13.2 4h4.4a2.2 2.2 0 0 1 2.2 2.2v11.6a2.2 2.2 0 0 1-2.2 2.2h-4.4" />
      <path d="M3.6 12h10.2M10.2 8.4l3.6 3.6-3.6 3.6" />
    </Svg>
  )
}

/** Check out: leaving through a door. */
export function IcLeave({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M10.8 4H6.4a2.2 2.2 0 0 0-2.2 2.2v11.6A2.2 2.2 0 0 0 6.4 20h4.4z" value={duo} />
      <path d="M10.8 4H6.4a2.2 2.2 0 0 0-2.2 2.2v11.6A2.2 2.2 0 0 0 6.4 20h4.4" />
      <path d="M10 12h10.4M16.8 8.4l3.6 3.6-3.6 3.6" />
    </Svg>
  )
}

export function IcClock({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" value={duo} />
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2V12l3.2 2" />
    </Svg>
  )
}

/** Call history. */
export function IcHistory(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.8 12a8.4 8.4 0 1 0 2.5-6" />
      <path d="M3.6 4.2v4.2h4.2" />
      <path d="M12 7.6V12l3 2" />
    </Svg>
  )
}

export function IcKeypad({ duo, ...props }: IconProps) {
  const dots = [6, 12, 18].flatMap((y) => [6, 12, 18].map((x) => [x, y] as const))
  return (
    <Svg {...props}>
      {dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" fill="currentColor" fillOpacity={duo ?? 0.18} />
      ))}
    </Svg>
  )
}

export function IcBackspace({ duo, ...props }: IconProps) {
  const d = 'M9.2 5H19a2.2 2.2 0 0 1 2.2 2.2v9.6A2.2 2.2 0 0 1 19 19H9.2l-6.4-7z'
  return <Svg {...props}><Duo d={d} value={duo} /><path d={d} /><path d="m12.2 9.4 5.2 5.2M17.4 9.4l-5.2 5.2" /></Svg>
}

export function IcMic({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" value={duo} />
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.6 11a6.4 6.4 0 0 0 12.8 0M12 17.4v3.4" />
    </Svg>
  )
}

export function IcMicOff({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" value={duo} />
      <path d="M15 10V6a3 3 0 0 0-5.6-1.5M9 9v2a3 3 0 0 0 4.8 2.4" />
      <path d="M18.4 11a6.4 6.4 0 0 1-.9 3.3M5.6 11a6.4 6.4 0 0 0 9.6 5.5M12 17.4v3.4M3.8 3.8l16.4 16.4" />
    </Svg>
  )
}

export function IcNote({ duo, ...props }: IconProps) {
  const d = 'M4.2 19.8h3.9L19.3 8.6a2.2 2.2 0 0 0-3.1-3.1L5 16.7z'
  return <Svg {...props}><Duo d={d} value={duo} /><path d={d} /><path d="m14.6 7.1 3.1 3.1M13.4 19.8h6.4" /></Svg>
}

export function IcSearch(props: IconProps) {
  return <Svg {...props}><circle cx="10.8" cy="10.8" r="6.6" /><path d="m15.8 15.8 4.6 4.6" /></Svg>
}

/** Telegram-style paper plane (generic). */
export function IcSend({ duo, ...props }: IconProps) {
  const d = 'M20.8 3.2 3.4 10.1c-.8.3-.8 1.4 0 1.7l5.2 2 2 5.2c.3.8 1.4.8 1.7 0z'
  return <Svg {...props}><Duo d={d} value={duo} /><path d={d} /><path d="m8.6 13.8 5.2-5.2" /></Svg>
}

export function IcArrowLeft(props: IconProps) {
  return <Svg {...props}><path d="M19 12H5.4M11 6.2 5.2 12l5.8 5.8" /></Svg>
}

export function IcArrowRight(props: IconProps) {
  return <Svg {...props}><path d="M5 12h13.6M13 6.2l5.8 5.8-5.8 5.8" /></Svg>
}

/** The night close at 03:00. */
export function IcMoon({ duo, ...props }: IconProps) {
  const d = 'M19.8 14.6A8.2 8.2 0 0 1 9.4 4.2a8.2 8.2 0 1 0 10.4 10.4z'
  return <Svg {...props}><Duo d={d} value={duo} /><path d={d} /><path d="M16.6 3.6v2.6M15.3 4.9h2.6" /></Svg>
}

export function IcGlobe(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3z" />
    </Svg>
  )
}

export function IcPlus(props: IconProps) {
  return <Svg {...props}><path d="M12 5.2v13.6M5.2 12h13.6" /></Svg>
}

export function IcTrash({ duo, ...props }: IconProps) {
  const d = 'M6.4 7.2 7.3 19a1.6 1.6 0 0 0 1.6 1.4h6.2a1.6 1.6 0 0 0 1.6-1.4l.9-11.8z'
  return <Svg {...props}><Duo d={d} value={duo} /><path d="M4.4 7.2h15.2M9.4 7.2V4.8c0-.5.4-.9.9-.9h3.4c.5 0 .9.4.9.9v2.4" /><path d={d} /><path d="M10.2 11v5.4M13.8 11v5.4" /></Svg>
}

export function IcPencil(props: IconProps) {
  return <Svg {...props}><path d="M4.2 19.8h3.9L19.3 8.6a2.2 2.2 0 0 0-3.1-3.1L5 16.7z" /><path d="m14.6 7.1 3.1 3.1" /></Svg>
}

export function IcArrowUp(props: IconProps) {
  return <Svg {...props}><path d="M12 19V5.4M6.2 11 12 5.2l5.8 5.8" /></Svg>
}

export function IcArrowDown(props: IconProps) {
  return <Svg {...props}><path d="M12 5v13.6M6.2 13l5.8 5.8 5.8-5.8" /></Svg>
}

export function IcHash(props: IconProps) {
  return <Svg {...props}><path d="M9.6 4 7.8 20M16.2 4l-1.8 16M4.8 9h15M4.2 15h15" /></Svg>
}

/** A quarter arc; spin it with a class. */
export function IcSpinner(props: IconProps) {
  return <Svg {...props}><path d="M12 3.4a8.6 8.6 0 1 0 8.6 8.6" /></Svg>
}

/** People on the live map. */
export function IcPeople({ duo, ...props }: IconProps) {
  return (
    <Svg {...props}>
      <Duo d="M9 12.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z" value={duo} />
      <circle cx="9" cy="9" r="3.4" />
      <path d="M3.2 19.6c.7-3 3-4.8 5.8-4.8s5.1 1.8 5.8 4.8" />
      <path d="M15.4 5.8a3.2 3.2 0 0 1 0 6.3M17.6 15.2c1.6.6 2.7 2.1 3.2 4.4" />
    </Svg>
  )
}
