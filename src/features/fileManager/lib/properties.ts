import type { FmFolder, FmItem } from '../../../shared/api/services/fileManager.service'
import type { AppLocale } from '../../../shared/i18n/translations'
import { formatShortDateTime } from '../../../shared/lib/format'
import { totalSize, typeLabel } from './explorer'
import { formatBytes, isUploadSource, sourceLabel, type Translate } from './items'

export type PropertyRow = { id: string; label: string; value: string }

type Ctx = {
  t: Translate
  locale: AppLocale
  /** "All files / Registrations" — where the listed items are (null for search results: each item's own path is used). */
  location: string | null
  /** Properties dialog: sizes also in bytes. */
  detailed?: boolean
}

function sizeText(size: number | null, ctx: Ctx) {
  if (size === null || !Number.isFinite(size)) return ''
  const pretty = formatBytes(size)
  return ctx.detailed && size >= 1024
    ? `${pretty} (${ctx.t('files.props.bytes', '{{value}} bytes', { value: size.toLocaleString(ctx.locale === 'en' ? 'en-US' : ctx.locale === 'ru' ? 'ru-RU' : 'uz-UZ') })})`
    : pretty
}

function counts(files: number, folders: number, t: Translate) {
  return t('files.props.counts', 'Files: {{files}}, folders: {{folders}}', { files, folders })
}

function push(rows: PropertyRow[], id: string, label: string, value: string | null | undefined) {
  if (value) rows.push({ id, label, value })
}

/** Rows of the details pane / Properties for one or more selected items. */
export function itemRows(items: FmItem[], ctx: Ctx): PropertyRow[] {
  const { t, locale } = ctx
  const rows: PropertyRow[] = []
  if (items.length === 1) {
    const item = items[0]
    push(rows, 'type', t('files.column.type', 'Type'), typeLabel(item, t))
    if (item.kind === 'folder' && (item.fileCount !== null || item.folderCount !== null)) {
      push(rows, 'contains', t('files.props.contains', 'Contains'), counts(item.fileCount ?? 0, item.folderCount ?? 0, t))
    }
    push(rows, 'size', t('files.column.size', 'Size'), sizeText(item.size, ctx))
    push(rows, 'location', t('files.column.location', 'Location'), ctx.location ?? item.path)
    push(rows, 'modified', t('files.column.modified_long', 'Date modified'), item.updatedAt ? formatShortDateTime(item.updatedAt, locale) : null)
    push(rows, 'created', t('files.props.created', 'Created'), item.createdAt ? formatShortDateTime(item.createdAt, locale) : null)
    if (item.sourceType && !isUploadSource(item.sourceType)) push(rows, 'source', t('files.filter.source', 'Source'), sourceLabel(item.sourceType, t))
    if (item.kind === 'file') push(rows, 'by', t('files.props.uploaded_by', 'Uploaded by'), item.uploadedBy)
    if (item.system) push(rows, 'attrs', t('files.props.attributes', 'Attributes'), t('files.props.protected', 'Protected — cannot be renamed, moved or deleted'))
    return rows
  }
  const files = items.filter((item) => item.kind === 'file').length
  push(rows, 'contains', t('files.props.selected', 'Selected'), counts(files, items.length - files, t))
  push(rows, 'size', t('files.props.total_size', 'Total size'), sizeText(totalSize(items), ctx))
  push(rows, 'location', t('files.column.location', 'Location'), ctx.location)
  return rows
}

/** Rows for the open folder itself (nothing selected / Properties on empty space). */
export function folderRows(folder: FmFolder | null, listing: { folders: number; files: number; filesSize: number | null }, ctx: Ctx): PropertyRow[] {
  const { t, locale } = ctx
  const rows: PropertyRow[] = []
  push(rows, 'type', t('files.column.type', 'Type'), folder ? typeLabel(folder, t) : t('files.kind.storage', 'Private storage'))
  push(rows, 'contains', t('files.props.contains', 'Contains'), counts(listing.files, listing.folders, t))
  push(rows, 'size', t('files.props.files_size', 'Size of files here'), sizeText(folder?.size ?? listing.filesSize, ctx))
  push(rows, 'location', t('files.column.location', 'Location'), ctx.location)
  push(rows, 'modified', t('files.column.modified_long', 'Date modified'), folder?.updatedAt ? formatShortDateTime(folder.updatedAt, locale) : null)
  push(rows, 'created', t('files.props.created', 'Created'), folder?.createdAt ? formatShortDateTime(folder.createdAt, locale) : null)
  if (folder?.system) push(rows, 'attrs', t('files.props.attributes', 'Attributes'), t('files.props.protected', 'Protected — cannot be renamed, moved or deleted'))
  return rows
}
