import {
  FileArchiveIcon,
  FileDocIcon,
  FileIcon,
  FileImageIcon,
  FilePdfIcon,
  FileTextIcon,
  FileVideoIcon,
  FileXlsIcon,
  FolderIcon,
  LockSimpleIcon,
  type IconWeight,
} from '@phosphor-icons/react'
import type { FileKind } from '../lib/items'

const ICONS = {
  folder: FolderIcon,
  pdf: FilePdfIcon,
  doc: FileDocIcon,
  sheet: FileXlsIcon,
  image: FileImageIcon,
  text: FileTextIcon,
  archive: FileArchiveIcon,
  media: FileVideoIcon,
  file: FileIcon,
} as const

/** Tinted tile colour per kind (list rows, search results, upload panel). */
const TONES: Record<FileKind, string> = {
  folder: 'bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] text-[color-mix(in_oklab,var(--warning-text)_70%,var(--lime))]',
  pdf: 'bg-[var(--danger-dim)] text-[var(--danger-text)]',
  doc: 'bg-[var(--blue-dim)] text-[var(--blue-text)]',
  sheet: 'bg-[var(--success-dim)] text-[var(--success-text)]',
  image: 'bg-[color-mix(in_oklab,var(--primary)_12%,var(--success-dim))] text-[color-mix(in_oklab,var(--blue-text)_45%,var(--success-text))]',
  text: 'bg-[var(--muted-surface)] text-[var(--muted-strong)]',
  archive: 'bg-[var(--warning-dim)] text-[var(--warning-text)]',
  media: 'bg-[var(--danger-dim)] text-[var(--warning-text)]',
  file: 'bg-[var(--muted-surface)] text-[var(--muted-strong)]',
}

export function KindIcon({ kind, size = 18, weight = 'duotone', system = false }: { kind: FileKind; size?: number; weight?: IconWeight; system?: boolean }) {
  const Icon = system ? LockSimpleIcon : ICONS[kind]
  return <Icon size={size} weight={weight} aria-hidden="true" />
}

export function KindTile({ kind, system = false, size = 'md' }: { kind: FileKind; system?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span className={`relative grid shrink-0 place-items-center ${size === 'sm' ? 'h-8 w-8 rounded-[9px]' : 'h-10 w-10 rounded-[11px]'} ${TONES[kind]}`}>
      <KindIcon kind={kind} size={size === 'sm' ? 16 : 19} />
      {system ? (
        <span className="absolute -right-1 -bottom-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--surface)] text-[var(--muted-strong)] shadow-[var(--elev-sm)] ring-1 ring-[var(--border)]">
          <LockSimpleIcon size={9} weight="bold" />
        </span>
      ) : null}
    </span>
  )
}
