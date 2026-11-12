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
import { ItemGlyph } from './ItemGlyph'

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

/** Line icon of a kind (dialog headers). */
export function KindIcon({ kind, size = 18, weight = 'duotone', system = false }: { kind: FileKind; size?: number; weight?: IconWeight; system?: boolean }) {
  const Icon = system ? LockSimpleIcon : ICONS[kind]
  return <Icon size={size} weight={weight} aria-hidden="true" />
}

/** The explorer's file icon at list size (upload panel, pickers). */
export function KindTile({ kind, extension, system = false, size = 'md' }: { kind: FileKind; extension?: string; system?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span className="grid shrink-0 place-items-center">
      <ItemGlyph kind={kind} extension={extension} system={system} size={size === 'sm' ? 30 : 36} />
    </span>
  )
}
