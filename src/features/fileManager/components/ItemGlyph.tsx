import type { FileKind } from '../lib/items'

/**
 * Desktop-style item icons drawn as SVG: a folder (back, papers peeking out when it has content,
 * front flap that opens on hover) or a sheet of paper with a folded corner, a small pictogram of
 * the type and a coloured extension label. Colours come from `--k` (see `.fx-k-*` in the CSS).
 */
export function ItemGlyph({
  kind,
  extension = '',
  size = 48,
  system = false,
  filled = false,
  open = false,
  className,
}: {
  kind: FileKind
  extension?: string
  size?: number
  /** System folder: a small lock on the corner. */
  system?: boolean
  /** Folder with something inside: papers peek out. */
  filled?: boolean
  /** Draw the folder already open (current folder in the tree). */
  open?: boolean
  className?: string
}) {
  const tier: Tier = size < 30 ? 'xs' : size < 44 ? 'sm' : 'lg'
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`fx-glyph fx-k-${kind}${className ? ` ${className}` : ''}`}
      data-open={open || undefined}
    >
      {kind === 'folder' ? <FolderShape filled={filled} small={tier === 'xs'} /> : <PaperShape kind={kind} extension={extension} tier={tier} />}
      {system ? <LockBadge /> : null}
    </svg>
  )
}

function FolderShape({ filled, small }: { filled: boolean; small: boolean }) {
  return (
    <g className="fx-folder">
      <path className="fx-folder__back" d="M4 12.5C4 10.6 5.6 9 7.5 9h10.2c.9 0 1.7.4 2.3 1l2.6 2.7c.3.3.7.5 1.1.5h16.8c1.9 0 3.5 1.6 3.5 3.5v20.8c0 1.9-1.6 3.5-3.5 3.5h-33C5.6 41 4 39.4 4 37.5z" />
      {filled ? (
        <g className="fx-folder__papers">
          <rect x="9" y="14.5" width="29" height="18" rx="1.6" className="fx-folder__paper fx-folder__paper--2" />
          <rect x="10.5" y="16.5" width="27" height="18" rx="1.6" className="fx-folder__paper" />
        </g>
      ) : null}
      <path className="fx-folder__front" d="M4 20.5C4 18.6 5.6 17 7.5 17h33c1.9 0 3.5 1.6 3.5 3.5v17c0 1.9-1.6 3.5-3.5 3.5h-33C5.6 41 4 39.4 4 37.5z" />
      {small ? null : <path className="fx-folder__shine" d="M7.5 18.6h33" />}
    </g>
  )
}

type Tier = 'xs' | 'sm' | 'lg'

function PaperShape({ kind, extension, tier }: { kind: Exclude<FileKind, 'folder'>; extension: string; tier: Tier }) {
  const label = extension.toUpperCase().slice(0, 4)
  // Below ~44 px the letters cannot be read: the label stays as a plain coloured band.
  const labelWidth = tier === 'lg' ? Math.max(15, 6 + label.length * 5.1) : 15
  return (
    <g className="fx-paper">
      <path className="fx-paper__sheet" d="M12.5 4h16.6c.8 0 1.6.3 2.1.9l7.9 7.9c.6.6.9 1.3.9 2.1v26.6c0 1.4-1.1 2.5-2.5 2.5h-25c-1.4 0-2.5-1.1-2.5-2.5v-35C10 5.1 11.1 4 12.5 4z" />
      <path className="fx-paper__fold" d="M29.5 4.2v7.3c0 1.4 1.1 2.5 2.5 2.5h7.3" />
      {tier === 'xs' ? <SmallMark kind={kind} /> : <Pictogram kind={kind} />}
      {tier !== 'xs' && label ? (
        <g className="fx-paper__label">
          <rect x="5" y="29" width={labelWidth} height="10" rx="2.6" />
          {tier === 'lg' ? <text x={5 + labelWidth / 2} y="36.4" textAnchor="middle">{label}</text> : null}
        </g>
      ) : null}
    </g>
  )
}

/** At 16–24 px only a coloured band reads, not text. */
function SmallMark({ kind }: { kind: Exclude<FileKind, 'folder'> }) {
  if (kind === 'image') return <path className="fx-pic fx-pic--fill" d="M15 36l6-7 4 4.5 3-3 6 5.5z" />
  return <rect className="fx-pic--fill" x="14.5" y="26" width="19" height="9" rx="2" />
}

function Pictogram({ kind }: { kind: Exclude<FileKind, 'folder'> }) {
  switch (kind) {
    case 'image':
      return (
        <g className="fx-pic">
          <circle cx="30.5" cy="18.5" r="2.6" className="fx-pic--fill" />
          <path className="fx-pic--soft" d="M15 27.5l5.2-6.4c.5-.6 1.4-.6 1.9 0l3.6 4.3 2.4-2.6c.5-.5 1.3-.5 1.8 0l4.6 4.7z" />
        </g>
      )
    case 'sheet':
      return (
        <g className="fx-pic fx-pic--line">
          <rect x="15.5" y="14.5" width="18" height="12" rx="1.5" />
          <path d="M15.5 18.5h18M15.5 22.5h18M21.5 14.5v12M27.5 14.5v12" />
        </g>
      )
    case 'archive':
      return (
        <g className="fx-pic fx-pic--fill">
          <rect x="22" y="6" width="3" height="2.4" rx=".6" />
          <rect x="25" y="9.4" width="3" height="2.4" rx=".6" />
          <rect x="22" y="12.8" width="3" height="2.4" rx=".6" />
          <rect x="25" y="16.2" width="3" height="2.4" rx=".6" />
          <rect x="22.4" y="20" width="5.2" height="6" rx="1.4" />
        </g>
      )
    case 'media':
      return (
        <g className="fx-pic">
          <circle cx="24.5" cy="20" r="7" className="fx-pic--soft" />
          <path className="fx-pic--fill" d="M22.6 16.6v6.8c0 .5.5.8.9.5l5.2-3.4c.4-.2.4-.8 0-1l-5.2-3.4c-.4-.3-.9 0-.9.5z" />
        </g>
      )
    case 'pdf':
      return (
        <g className="fx-pic fx-pic--line">
          <path d="M16 14.5h11M16 18.5h17M16 22.5h17M16 26.5h9" />
        </g>
      )
    case 'doc':
    case 'text':
      return (
        <g className="fx-pic fx-pic--line">
          <path d="M16 14.5h11M16 18.5h17M16 22.5h14M16 26.5h17" />
        </g>
      )
    default:
      return (
        <g className="fx-pic fx-pic--line">
          <path d="M16 16.5h12M16 20.5h17" />
        </g>
      )
  }
}

function LockBadge() {
  return (
    <g className="fx-lock">
      <circle cx="38" cy="37" r="8.2" />
      <rect x="34.3" y="36" width="7.4" height="5.6" rx="1.3" className="fx-lock__body" />
      <path d="M35.7 36v-1.7a2.3 2.3 0 0 1 4.6 0V36" className="fx-lock__shackle" />
    </g>
  )
}
