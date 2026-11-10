import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { IconButton } from '../../../shared/ui/icon-button'
import { toneDot, tonePill, type Tone } from '../../../shared/ui/tone'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import type { CardRecord } from '../../../shared/api/services/projects.service'
import { Avatar, AvatarGroup } from './Avatar'
import { formatProjectDate, formatProjectDateTime, getPriorityConfig, isDueDateOverdue, isDueDateSoon } from '../lib/format'
import { cn } from '../../../shared/lib/cn'
import { resolveMediaUrl } from '../../../shared/lib/media-url'

type CardDetailModalProps = {
  card: CardRecord | null
  open: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  boardName?: string
  projectName?: string
  canManage?: boolean
}

const priorityTones: Record<string, Tone> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'blue',
  low: 'neutral',
}

function getCardImageUrl(image: { url?: string | null; url_path?: string | null }) {
  const value = image.url ?? image.url_path ?? ''
  return resolveMediaUrl(value) ?? value
}

function DetailInfoBlock({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--muted)]">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className="text-[13px] font-semibold text-[var(--foreground)]">{children}</div>
    </div>
  )
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined || seconds < 0) return '-'

  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const parts = [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    minutes || (!days && !hours) ? `${minutes}m` : '',
  ].filter(Boolean)

  return parts.join(' ')
}

export function CardDetailModal({
  card,
  open,
  onClose,
  onEdit,
  onDelete,
  boardName,
  projectName,
  canManage = true,
}: CardDetailModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const lt = translateCurrentLiteral

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    setSelectedImageIndex(0)
  }, [card?.id, open])

  if (!open || !card) return null

  const priorityConfig = getPriorityConfig()
  const priority = card.priority ? priorityConfig[card.priority] : null
  const overdue = card.due_date ? isDueDateOverdue(card.due_date) : false
  const soon = card.due_date ? isDueDateSoon(card.due_date) : false
  const assignees = Array.isArray(card.assignees) && card.assignees.length > 0
    ? card.assignees
    : card.assignee
      ? [card.assignee]
      : []
  const images = Array.isArray(card.images)
    ? card.images
    : Array.isArray(card.files)
      ? card.files
      : []
  const selectedImage = images[selectedImageIndex] ?? images[0] ?? null
  const statusHistory = [...card.status_history].sort((left, right) =>
    (right.started_at ?? '').localeCompare(left.started_at ?? ''),
  )
  const hasTelegramSource = Boolean(
    card.telegram_source_kind ||
    card.telegram_source_command ||
    card.telegram_source_chat_id ||
    card.telegram_source_message_id,
  )
  const priorityTone: Tone = priorityTones[card.priority ?? ''] ?? 'neutral'
  const dueTone: Tone = overdue ? 'danger' : soon ? 'warning' : 'neutral'

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <button
        type="button"
        className="dialog-backdrop absolute inset-0"
        onClick={onClose}
        aria-label={lt('Close')}
      />

      {/* Main Container */}
      <div className="modal-pop relative z-10 flex h-full max-h-[min(86vh,860px)] w-full max-w-[900px] flex-col overflow-hidden rounded-[20px] bg-[var(--surface)] shadow-[var(--elev-xl)] ring-1 ring-[var(--border)] boards-section">

        {/* Header Section */}
        <div className="relative z-10 flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {projectName && (
                  <span className="ui-eyebrow">{projectName}</span>
                )}
                {projectName && boardName && (
                  <span className="h-3 w-px bg-[var(--border-hover)]" />
                )}
                {boardName && (
                  <span className="ui-eyebrow">{boardName}</span>
                )}
              </div>
              <h2 className="text-[18px] leading-tight font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[20px]">
                {card.title}
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canManage && (
                <div className="hidden items-center gap-2 sm:flex">
                  <Button variant="secondary" size="sm" onClick={onEdit}>
                    {lt('Edit')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={onDelete}>
                    {lt('Delete')}
                  </Button>
                </div>
              )}
              <IconButton label={lt('Close')} size="md" onClick={onClose}>
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </IconButton>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-2.5">
            {priority ? (
              <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold', tonePill(priorityTone))}>
                <span className={cn('h-2 w-2 shrink-0 rounded-full', toneDot[priorityTone])} />
                {priority.label}
              </span>
            ) : null}

            {card.due_date && (
              <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold', tonePill(dueTone))}>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
                </svg>
                <span>
                  {lt('Due')} {formatProjectDateTime(card.due_date)}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-visible">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">

            {/* Main Column */}
            <div className="space-y-4 p-5">

              {/* Media Viewer */}
              {selectedImage && (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-[18px] bg-[var(--muted-surface)]">
                    <img
                      src={getCardImageUrl(selectedImage)}
                      alt={selectedImage.filename}
                      className="h-auto max-h-[540px] w-full object-contain"
                    />
                    <div className="flex items-end justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{selectedImage.filename}</p>
                        <a href={getCardImageUrl(selectedImage)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]">
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          {lt('View original')}
                        </a>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--muted-strong)]">
                        {selectedImageIndex + 1} / {images.length}
                      </span>
                    </div>
                  </div>

                  {images.length > 1 && (
                    <div className="flex gap-2.5 overflow-x-auto px-0.5 pb-2 custom-scrollbar-visible">
                      {images.map((img, idx) => (
                        <button
                          key={img.id}
                          onClick={() => setSelectedImageIndex(idx)}
                          className={cn(
                            'relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] transition-opacity',
                            idx === selectedImageIndex
                              ? 'ring-2 ring-[var(--primary)]'
                              : 'opacity-60 hover:opacity-100',
                          )}
                        >
                          <img src={getCardImageUrl(img)} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Description Section */}
              <div className="space-y-3">
                <h3 className="ui-section-title text-[var(--foreground)]">{lt('Description')}</h3>
                {card.description ? (
                  <div className="rounded-[14px] bg-[var(--accent-soft)] p-4">
                    <p className="text-[15px] leading-[1.7] whitespace-pre-wrap text-[var(--foreground)] selection:bg-[var(--blue-soft)]">
                      {card.description}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-[18px] bg-[var(--muted-surface)] px-6 py-10 text-[var(--muted)]">
                    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                    <p className="text-[13px] font-medium">{lt('Task description is empty')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar metadata */}
            <div className="space-y-4 bg-[var(--muted-surface)] p-5">

              {/* Assignment Card */}
              <div className="space-y-[18px]">
                <div className="space-y-3">
                  <h4 className="ui-card-label">
                    {assignees.length > 1 ? lt('Assignees') : lt('Assignee')}
                  </h4>
                  {assignees.length > 0 ? (
                    <div className="space-y-3 rounded-[18px] bg-[var(--surface)] p-4">
                      <AvatarGroup users={assignees} max={4} size="sm" className="flex-wrap" />
                      <div className="space-y-2.5">
                        {assignees.map((assignee) => (
                          <div key={assignee.id} className="flex items-center gap-2.5">
                            <Avatar
                              name={assignee.name}
                              surname={assignee.surname}
                              imageUrl={assignee.profile_image}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                                {assignee.name} {assignee.surname}
                              </p>
                              <p className="truncate text-[12.5px] text-[var(--muted)]">
                                {assignee.job_title || lt('Member')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2.5 rounded-[18px] bg-[var(--surface)] p-5">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--muted-surface)] text-[var(--muted)]">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                      </span>
                      <p className="text-[12.5px] font-medium text-[var(--muted)]">{lt('Unassigned')}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="ui-card-label">{lt('Created by')}</h4>
                  <div className="flex items-center gap-2.5 rounded-[18px] bg-[var(--surface)] p-4">
                    <Avatar
                      name={card.created_by.name}
                      surname={card.created_by.surname}
                      imageUrl={card.created_by.profile_image}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{card.created_by.name} {card.created_by.surname}</p>
                      <p className="text-[12.5px] text-[var(--muted)]">{lt('Owner')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Info */}
              <div className="space-y-3 border-t border-[var(--border-hover)] pt-[18px]">
                <h4 className="ui-card-label">{lt('Task Timeline')}</h4>
                <div className="grid gap-3.5 rounded-[18px] bg-[var(--surface)] p-4">
                  <DetailInfoBlock
                    label={lt('Created')}
                    icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                  >
                    <span className="font-medium text-[var(--muted-strong)]">{formatProjectDate(card.created_at)}</span>
                  </DetailInfoBlock>

                  <DetailInfoBlock
                    label={lt('Last update')}
                    icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>}
                  >
                    <span className="font-medium text-[var(--muted-strong)]">{formatProjectDate(card.updated_at)}</span>
                  </DetailInfoBlock>

                  {card.due_date && (
                    <DetailInfoBlock
                      label={lt('Deadline')}
                      icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                    >
                      <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', tonePill(dueTone))}>
                        {formatProjectDateTime(card.due_date)}
                      </span>
                    </DetailInfoBlock>
                  )}

                  {card.completed_at ? (
                    <DetailInfoBlock
                      label={lt('Completed')}
                      icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 4 4L19 6" /></svg>}
                    >
                      <span className="text-[var(--success-text)]">{formatProjectDateTime(card.completed_at)}</span>
                    </DetailInfoBlock>
                  ) : null}

                  {card.completion_duration_seconds !== null ? (
                    <DetailInfoBlock label={lt('Completion time')}>
                      <span className="text-[var(--muted-strong)]">{formatDuration(card.completion_duration_seconds)}</span>
                    </DetailInfoBlock>
                  ) : null}

                  {card.current_status_duration_seconds !== null ? (
                    <DetailInfoBlock label={lt('Time in current status')}>
                      <span className="text-[var(--muted-strong)]">{formatDuration(card.current_status_duration_seconds)}</span>
                    </DetailInfoBlock>
                  ) : null}
                </div>
              </div>

              {statusHistory.length > 0 ? (
                <div className="space-y-3 border-t border-[var(--border-hover)] pt-[18px]">
                  <h4 className="ui-card-label">{lt('Status history')}</h4>
                  <div className="space-y-2">
                    {statusHistory.map((entry, index) => (
                      <div key={entry.id ?? `${entry.column_id ?? 'status'}-${entry.started_at ?? index}`} className="rounded-[14px] bg-[var(--surface)] px-3.5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--foreground)]">{entry.column_name || lt('Status')}</span>
                          <span className="shrink-0 text-[12.5px] font-medium tabular-nums text-[var(--muted-strong)]">{formatDuration(entry.duration_seconds)}</span>
                        </div>
                        {entry.started_at ? <p className="mt-1 text-[12px] text-[var(--muted)]">{formatProjectDateTime(entry.started_at)}{entry.ended_at ? ` - ${formatProjectDateTime(entry.ended_at)}` : ''}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasTelegramSource ? (
                <div className="space-y-3 border-t border-[var(--border-hover)] pt-[18px]">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="ui-card-label">{lt('Telegram source')}</h4>
                    <Badge variant="blue" size="sm">Telegram</Badge>
                  </div>
                  <div className="space-y-3.5 rounded-[18px] bg-[var(--surface)] p-4">
                    {card.telegram_source_kind ? (
                      <DetailInfoBlock label={lt('Source type')}>
                        <span className="text-[var(--muted-strong)]">{card.telegram_source_kind}</span>
                      </DetailInfoBlock>
                    ) : null}
                    {card.telegram_source_command ? (
                      <DetailInfoBlock label={lt('Command')}>
                        <code className="rounded-[9px] bg-[var(--input-surface)] px-2 py-1 text-xs text-[var(--foreground)]">{card.telegram_source_command}</code>
                      </DetailInfoBlock>
                    ) : null}
                    {card.telegram_source_chat_id ? (
                      <DetailInfoBlock label={lt('Chat ID')}>
                        <span className="font-mono text-xs text-[var(--muted-strong)]">{card.telegram_source_chat_id}</span>
                      </DetailInfoBlock>
                    ) : null}
                    {card.telegram_source_message_id ? (
                      <DetailInfoBlock label={lt('Message ID')}>
                        <span className="font-mono text-xs text-[var(--muted-strong)]">{card.telegram_source_message_id}</span>
                      </DetailInfoBlock>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Mobile Actions */}
              {canManage && (
                <div className="flex gap-3 border-t border-[var(--border-hover)] pt-[18px] sm:hidden">
                  <Button variant="secondary" size="md" className="flex-1" onClick={onEdit}>{lt('Edit')}</Button>
                  <Button variant="danger" size="md" className="flex-1" onClick={onDelete}>{lt('Delete')}</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
