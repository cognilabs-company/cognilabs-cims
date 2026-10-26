import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { Button } from '../../../shared/ui/button'
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

function getCardImageUrl(image: { url?: string | null; url_path?: string | null }) {
  const value = image.url ?? image.url_path ?? ''
  return resolveMediaUrl(value) ?? value
}

function DetailInfoBlock({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-(--muted)">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </div>
      <div className="text-sm font-semibold text-[var(--foreground)]">{children}</div>
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

  const priorityTheme = {
    urgent: {
      accent: 'bg-[var(--danger)]',
      glow: 'shadow-[0_0_12px_var(--danger-dim)]',
      border: 'border-[var(--danger-border)]',
      text: 'text-[var(--danger-text)]'
    },
    high: {
      accent: 'bg-[var(--warning)]',
      glow: 'shadow-[0_0_12px_var(--warning-dim)]',
      border: 'border-[var(--warning-border)]',
      text: 'text-[var(--warning-text)]'
    },
    medium: {
      accent: 'bg-[var(--blue-text)]',
      glow: 'shadow-[0_0_12px_var(--blue-glow)]',
      border: 'border-[var(--blue-border)]',
      text: 'text-[var(--blue-text)]'
    },
    low: {
      accent: 'bg-[var(--muted-strong)]',
      glow: '',
      border: 'border-[var(--border)]',
      text: 'text-[var(--muted-strong)]'
    },
    default: {
      accent: 'bg-[var(--blue-text)]',
      glow: '',
      border: 'border-[var(--border)]',
      text: 'text-[var(--blue-text)]'
    }
  }[card.priority ?? 'default']

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={lt('Close')}
      />

      {/* Main Container */}
      <div className="relative z-10 flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-xl)] boards-section">
        
        {/* Top Header Decor - Neutralized blue gradient for all priorities */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[var(--blue-dim)] via-[var(--blue-dim)]/30 to-transparent opacity-60" />

        {/* Header Section */}
        <div className="relative z-10 flex flex-col gap-4 border-b border-[var(--border)] p-6 sm:px-10 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4">
                {projectName && (
                   <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--muted-strong)]">{projectName}</span>
                   </div>
                )}
                {projectName && boardName && (
                  <span className="text-[var(--border)] h-3 w-[1px] bg-current" />
                )}
                {boardName && (
                   <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--muted-strong)]">{boardName}</span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)] leading-tight">
                {card.title}
              </h2>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {canManage && (
                <div className="hidden sm:flex items-center gap-2.5">
                  <Button variant="ghost" size="sm" className="rounded-xl h-11 px-5 bg-[var(--accent-soft)] hover:bg-[var(--accent-hover)] border border-[var(--border)] text-[var(--foreground)]" onClick={onEdit}>
                    {lt('Edit')}
                  </Button>
                  <Button variant="danger" size="sm" className="rounded-xl h-11 px-5 border border-[var(--danger-border)]" onClick={onDelete}>
                    {lt('Delete')}
                  </Button>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--muted)] transition hover:bg-[var(--accent-hover)] hover:text-[var(--foreground)]"
              >
                <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-4">
             <div className={cn("flex items-center gap-2.5 px-4 py-2 rounded-xl border transition-all duration-300", 
                "bg-[var(--accent-soft)]", priorityTheme.border
             )}>
                <div className={cn("h-2.5 w-2.5 rounded-full", priorityTheme.accent, priorityTheme.glow)} />
                <span className={cn("text-xs font-bold uppercase tracking-widest", priorityTheme.text)}>
                   {priority?.label}
                </span>
             </div>

             {card.due_date && (
                <div className={cn(
                   "flex items-center gap-2.5 px-4 py-2 rounded-xl border transition-all duration-300",
                   overdue ? "bg-[var(--danger-dim)] border-[var(--danger-border)] text-[var(--danger-text)] shadow-[0_0_15px_var(--danger-dim)]" :
                   soon ? "bg-[var(--warning-dim)] border-[var(--warning-border)] text-[var(--warning-text)] shadow-[0_0_15px_var(--warning-dim)]" :
                   "bg-[var(--accent-soft)] border-[var(--border)] text-[var(--muted-strong)]"
                )}>
                   <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
                   </svg>
                   <span className="text-xs font-bold uppercase tracking-widest">
                      {lt('Due')} {formatProjectDateTime(card.due_date)}
                   </span>
                 </div>
             )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-visible">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
            
            {/* Main Column */}
            <div className="p-6 sm:p-10 space-y-6">
              
              {/* Media Viewer */}
              {selectedImage && (
                <div className="space-y-4">
                   <div className="relative group overflow-hidden rounded-xl border border-[var(--border)] bg-black/5 shadow-inner">
                      <img
                        src={getCardImageUrl(selectedImage)}
                        alt={selectedImage.filename}
                        className="h-auto max-h-[540px] w-full object-contain transition-transform duration-700 group-hover:scale-[1.01]"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between">
                         <div className="min-w-0">
                            <p className="text-base font-bold text-white truncate mb-1">{selectedImage.filename}</p>
                            <a href={getCardImageUrl(selectedImage)} target="_blank" rel="noreferrer" className="text-xs text-white/60 hover:text-white transition flex items-center gap-1.5 font-medium">
                               <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                               {lt('View original')}
                            </a>
                         </div>
                         <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl text-[11px] font-black text-white/90 tracking-tighter">
                            {selectedImageIndex + 1} / {images.length}
                         </div>
                      </div>
                   </div>

                   {images.length > 1 && (
                      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-visible scroll-smooth px-1">
                         {images.map((img, idx) => (
                            <button
                               key={img.id}
                               onClick={() => setSelectedImageIndex(idx)}
                               className={cn(
                                  "relative shrink-0 w-24 h-24 rounded-xl border-2 transition-all duration-300 overflow-hidden",
                                  idx === selectedImageIndex ? "border-[var(--blue-text)] scale-105 shadow-[var(--shadow-md)]" : "border-[var(--border)] opacity-60 hover:opacity-100 hover:scale-105"
                               )}
                            >
                               <img src={getCardImageUrl(img)} alt="" className="w-full h-full object-cover" />
                            </button>
                         ))}
                      </div>
                   )}
                </div>
              )}

              {/* Description Section */}
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <div className={cn("h-4 w-1 rounded-full", priorityTheme.accent)} />
                    <h3 className="text-xs font-black uppercase tracking-[0.25em] text-[var(--muted)]">{lt('Description')}</h3>
                 </div>
                 <div className={cn(
                    "rounded-xl p-8 bg-[var(--accent-soft)] border border-[var(--border)] shadow-sm leading-relaxed",
                    !card.description && "bg-transparent border-dashed border-[var(--border)] py-12"
                 )}>
                    {card.description ? (
                      <p className="text-[16px] text-[var(--foreground)] whitespace-pre-wrap selection:bg-[var(--blue-soft)]">
                        {card.description}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                         <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                         <p className="text-sm font-semibold tracking-wide italic">{lt('Task description is empty')}</p>
                      </div>
                    )}
                 </div>
              </div>
            </div>

            {/* Sidebar metadata */}
            <div className="lg:border-l border-[var(--border)] bg-[var(--background)]/30 p-6 sm:p-10 space-y-4">
              
              {/* Assignment Card */}
              <div className="space-y-4">
                 <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--muted)] mb-5">
                      {assignees.length > 1 ? lt('Assignees') : lt('Assignee')}
                    </h4>
                    {assignees.length > 0 ? (
                      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-5 shadow-sm">
                        <AvatarGroup users={assignees} max={4} size="sm" className="flex-wrap" />
                        <div className="space-y-2">
                          {assignees.map((assignee) => (
                            <div key={assignee.id} className="flex items-center gap-3">
                              <Avatar
                                name={assignee.name}
                                surname={assignee.surname}
                                imageUrl={assignee.profile_image}
                                size="sm"
                                className="ring-1 ring-[var(--border)]"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                                  {assignee.name} {assignee.surname}
                                </p>
                                <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                                  {assignee.job_title || lt('Member')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl border border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-3 group hover:border-[var(--border-hover)] transition-colors duration-300">
                         <div className="h-10 w-10 rounded-full bg-[var(--accent-soft)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                         </div>
                         <p className="text-[11px] font-black uppercase tracking-widest text-[var(--muted)]">{lt('Unassigned')}</p>
                      </div>
                    )}
                 </div>

                 <div className="pt-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--muted)] mb-5">{lt('Created by')}</h4>
                    <div className="flex items-center gap-3.5 px-2">
                       <Avatar
                          name={card.created_by.name}
                          surname={card.created_by.surname}
                          imageUrl={card.created_by.profile_image}
                          size="sm"
                          className="ring-1 ring-[var(--border)]"
                       />
                       <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--foreground)] truncate leading-none">{card.created_by.name} {card.created_by.surname}</p>
                          <p className="text-[9px] text-[var(--muted)] font-bold uppercase tracking-tighter mt-1">{lt('Owner')}</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Timeline Info */}
              <div className="space-y-4 pt-10 border-t border-[var(--border)]">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--muted)]">{lt('Task Timeline')}</h4>
                 <div className="grid gap-4">
                    <DetailInfoBlock 
                       label={lt('Created')} 
                       icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                    >
                       <span className="text-[var(--muted-strong)] font-medium">{formatProjectDate(card.created_at)}</span>
                    </DetailInfoBlock>
                    
                    <DetailInfoBlock 
                       label={lt('Last update')}
                       icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>}
                    >
                       <span className="text-[var(--muted-strong)] font-medium">{formatProjectDate(card.updated_at)}</span>
                    </DetailInfoBlock>

                    {card.due_date && (
                       <DetailInfoBlock 
                          label={lt('Deadline')}
                          icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                       >
                          <span className={cn("px-2 py-0.5 rounded-md text-xs font-black", 
                             overdue ? 'bg-[var(--danger-dim)] text-[var(--danger-text)] border border-[var(--danger-border)]' : 
                             soon ? 'bg-[var(--warning-dim)] text-[var(--warning-text)] border border-[var(--warning-border)]' : 
                             'text-[var(--foreground)] bg-[var(--accent-soft)]'
                          )}>
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
                <div className="space-y-4 pt-8 border-t border-[var(--border)]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--muted)]">{lt('Status history')}</h4>
                  <div className="space-y-3">
                    {statusHistory.map((entry, index) => (
                      <div key={entry.id ?? `${entry.column_id ?? 'status'}-${entry.started_at ?? index}`} className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-xs font-semibold text-[var(--foreground)]">{entry.column_name || lt('Status')}</span>
                          <span className="shrink-0 text-[11px] font-medium text-[var(--muted-strong)]">{formatDuration(entry.duration_seconds)}</span>
                        </div>
                        {entry.started_at ? <p className="mt-1 text-[10px] text-[var(--muted)]">{formatProjectDateTime(entry.started_at)}{entry.ended_at ? ` - ${formatProjectDateTime(entry.ended_at)}` : ''}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasTelegramSource ? (
                <div className="space-y-4 pt-8 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--muted)]">{lt('Telegram source')}</h4>
                    <span className="rounded-md border border-[var(--blue-border)] bg-[var(--blue-dim)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--blue-text)]">Telegram</span>
                  </div>
                  <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-4">
                    {card.telegram_source_kind ? (
                      <DetailInfoBlock label={lt('Source type')}>
                        <span className="text-[var(--muted-strong)]">{card.telegram_source_kind}</span>
                      </DetailInfoBlock>
                    ) : null}
                    {card.telegram_source_command ? (
                      <DetailInfoBlock label={lt('Command')}>
                        <code className="rounded-md bg-[var(--input-surface)] px-2 py-1 text-xs text-[var(--foreground)]">{card.telegram_source_command}</code>
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
                 <div className="sm:hidden pt-8 border-t border-[var(--border)] flex gap-3">
                    <Button variant="secondary" className="flex-1 rounded-xl h-12 font-bold" onClick={onEdit}>{lt('Edit')}</Button>
                    <Button variant="danger" className="flex-1 rounded-xl h-12 font-bold" onClick={onDelete}>{lt('Delete')}</Button>
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
