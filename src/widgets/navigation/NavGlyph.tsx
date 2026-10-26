import type { SVGProps } from 'react'
import { cn } from '../../shared/lib/cn'
import type { GlyphName } from './navGlyphMap'

type NavGlyphProps = SVGProps<SVGSVGElement> & {
  name: GlyphName
}

function glyphPath(name: GlyphName) {
  switch (name) {
    case 'member':
      return (
        <>
          <circle cx="12" cy="8.25" r="3.25" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </>
      )
    case 'ai':
      return (
        <>
          <path d="M12 4.75v2.5" />
          <rect x="6.25" y="7.25" width="11.5" height="9.5" rx="3.25" />
          <circle cx="10" cy="12" r=".85" fill="currentColor" stroke="none" />
          <circle cx="14" cy="12" r=".85" fill="currentColor" stroke="none" />
          <path d="M10 14.5h4" />
          <path d="M8.5 18v1.25" />
          <path d="M15.5 18v1.25" />
          <path d="M4.75 10.5h1.5" />
          <path d="M17.75 10.5h1.5" />
        </>
      )
    case 'ceo':
      return (
        <>
          <path d="M4.75 18.25h14.5" />
          <path d="M6.25 18.25v-7l5-3.5 5 3.5v7" />
          <path d="M9.25 18.25v-4.5h3.5v4.5" />
        </>
      )
    case 'crm':
      return (
        <>
          <path d="M5.25 6.25h13.5v11.5H5.25z" />
          <path d="M8 10h8" />
          <path d="M8 13.5h5" />
          <circle cx="8.5" cy="8.5" r="1" />
        </>
      )
    case 'faults':
      return (
        <>
          <path d="M12 4.75 4.75 18h14.5L12 4.75Z" />
          <path d="M12 9v4.25" />
          <circle cx="12" cy="15.75" r=".75" fill="currentColor" stroke="none" />
        </>
      )
    case 'payment':
      return (
        <>
          <rect x="3.75" y="6.5" width="16.5" height="11" rx="2" />
          <path d="M3.75 10h16.5" />
          <path d="M7 14h3.5" />
        </>
      )
    case 'wordpress':
      return (
        <>
          <circle cx="12" cy="12" r="7.25" />
          <path d="M8.5 8.75c.7 3 2.1 6.1 3.5 8.5 1.5-2.5 2.7-5.4 3.5-8.5" />
          <path d="M9.75 8.75h4.5" />
        </>
      )
    case 'updates':
      return (
        <>
          <path d="M7.25 12l3 3 6-6" />
          <circle cx="12" cy="12" r="8" />
        </>
      )
    case 'integrations':
      return (
        <>
          <rect x="4.5" y="4.5" width="5" height="5" rx="1.2" />
          <rect x="14.5" y="4.5" width="5" height="5" rx="1.2" />
          <rect x="9.5" y="14.5" width="5" height="5" rx="1.2" />
          <path d="M9.5 7h5" />
          <path d="M12 9.5v5" />
        </>
      )
    case 'auth':
      return (
        <>
          <path d="M9.5 7.25V6a2.5 2.5 0 0 1 5 0v1.25" />
          <rect x="7.25" y="7.25" width="9.5" height="9.5" rx="2" />
          <path d="M12 11.25v2.5" />
        </>
      )
    case 'projects':
      return (
        <>
          <rect x="3.75" y="3.75" width="6" height="8" rx="1.5" />
          <rect x="14.25" y="3.75" width="6" height="4" rx="1.5" />
          <rect x="14.25" y="12.25" width="6" height="8" rx="1.5" />
          <rect x="3.75" y="16.25" width="6" height="4" rx="1.5" />
        </>
      )
    case 'cognilabsai-chat':
      return (
        <>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <circle cx="9" cy="10" r=".85" fill="currentColor" stroke="none" />
          <circle cx="12" cy="10" r=".85" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10" r=".85" fill="currentColor" stroke="none" />
        </>
      )
    case 'cognilabsai-integrations':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
        </>
      )
    case 'audit':
      return (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="13" y2="17" />
          <polyline points="9,9 10,9 11,9" />
        </>
      )
    case 'attendance':
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <circle cx="12" cy="14" r="3" />
          <path d="M12 12.5V14l1 1" />
        </>
      )
    case 'archive':
      return (
        <>
          <rect x="4" y="5" width="16" height="4" rx="1" />
          <path d="M5.5 9v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9" />
          <path d="M10 13h4" />
        </>
      )
    case 'statuses':
      return (
        <>
          <circle cx="6.5" cy="7" r="1.75" />
          <circle cx="6.5" cy="12" r="1.75" />
          <circle cx="6.5" cy="17" r="1.75" />
          <path d="M10.5 7h8M10.5 12h8M10.5 17h8" />
        </>
      )
    case 'exit':
      return (
        <>
          <path d="M10 6H6.5A1.5 1.5 0 0 0 5 7.5v9A1.5 1.5 0 0 0 6.5 18H10" />
          <path d="M14 8.5 10.5 12l3.5 3.5" />
          <path d="M10.5 12H19" />
        </>
      )
    default:
      return (
        <>
          <path d="M5 6.25h14" />
          <path d="M5 12h14" />
          <path d="M5 17.75h14" />
        </>
      )
  }
}

export function NavGlyph({ name, className, ...props }: NavGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-4 w-4 shrink-0 text-[var(--sidebar-foreground)]', className)}
      {...props}
    >
      {glyphPath(name)}
    </svg>
  )
}
