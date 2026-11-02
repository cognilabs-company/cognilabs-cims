import { createPortal } from 'react-dom'
import React, { useEffect, useMemo, useState } from 'react'
import { cn } from '../../../shared/lib/cn'
import { useTranslation } from 'react-i18next'
import { useCrmScope } from '../lib/crmScope'
import type { CustomerSummary } from '../../../shared/api/types'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import {
  formatUsernameHandle,
  getCustomerDisplayMeta,
  getCustomerDisplayName,
  getCustomerDisplayPlatform,
} from '../../../shared/lib/customer-display'
import { formatNumericDate, formatNumericDateTime } from '../../../shared/lib/format'
import { useAuth } from '../../auth/hooks/useAuth'
import { Alert } from '../../../shared/ui/alert'
import { Badge, StatusBadge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { IconButton } from '../../../shared/ui/icon-button'
import { Input } from '../../../shared/ui/input'
import { Card } from '../../../shared/ui/card'
import { MemberAvatar } from '../../../shared/ui/member-avatar'
import { SectionTitle } from '../../../shared/ui/section-title'
import { Textarea } from '../../../shared/ui/textarea'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { isNotFoundError } from '../../../shared/lib/api-error'
import { resolveCustomerAudioUrl } from '../lib/customerAudio'
import { getCustomerActionErrorMessage, getCustomerUnavailableMessage, getCustomerUnavailableTitle } from '../lib/customerErrors'
import { getRecallTimeTone, getRecallTimeToneClasses } from '../lib/recallTime'
import { AudioPlayerCard } from './AudioPlayerCard'

type MergedCustomerNote = {
  id: number | string
  note: string
  created_by?: number
  created_by_full_name: string
  created_at: string | null
  isAi?: boolean
}

function formatCustomerNotes(notes?: string | null) {
  if (!notes) {
    return []
  }

  const normalizedNotes = notes
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')

  const segmentedNotes = normalizedNotes
    .replace(/\s+(?=\([^)]+\)\s+\d{1,2}[./]\d{1,2}[./]\d{2,4}\b)/g, '\n\n')
    .replace(
      /\s+(?=\d{1,2}[./]\d{1,2}[./]\d{2,4}\s+\d{1,2}(?::|\.)\d{2}(?:\s?[APMapm]{2})?\s+\([^)]+\)\s+)/g,
      '\n\n',
    )
    .replace(
      /\s+(?=\d{1,2}[./]\d{1,2}[./]\d{2,4}\s+\d{1,2}(?::|\.)\d{2}(?:\s?[APMapm]{2})?\s+[A-ZА-ЯЁ][\p{L}.'-]*(?:\s+[A-ZА-ЯЁ][\p{L}.'-]*){0,2}\s+)/gu,
      '\n\n',
    )
    .replace(
      /\s+(?=\d{1,2}(?::|\.)\d{2}(?:\s?[APMapm]{2})?\s+\d{1,2}[./]\d{1,2}[./]\d{2,4}\s+[A-ZА-ЯЁ][\p{L}.'-]*(?:\s+[A-ZА-ЯЁ][\p{L}.'-]*){0,2}\b)/gu,
      '\n\n',
    )
    .replace(
      /\s+(?=(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{1,2}:\d{2}(?:\s+\([^)]+\))?)/g,
      '\n\n',
    )
    .replace(
      /([.!?])\s+(?=\d{1,2}[./]\d{1,2}[./]\d{2,4}\s+(?:Today|Tomorrow|Yesterday|Call|Called|Need|Meeting|Spoke|Contacted|Lead)\b)/g,
      '$1\n\n',
    )
    .replace(/\n{3,}/g, '\n\n')

  return segmentedNotes
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function formatConversationLanguageLabel(
  t: (key: string, fallback: string) => string,
  value?: string | null,
) {
  const normalized = (value ?? '').trim().toLowerCase()

  if (normalized === 'uz' || normalized === 'ru' || normalized === 'en') {
    return t(`common.language.${normalized}`, value ?? normalized)
  }

  return value || '-'
}

function CustomerAudioPanel({ audioSource, customerName }: { audioSource: string; customerName: string }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      <AudioPlayerCard src={audioSource} name={customerName} />

      <div className="flex flex-wrap gap-2.5">
        <Button variant="secondary" size="sm" asChild>
          <a href={audioSource} target="_blank" rel="noreferrer">
            {t('common.open_audio', 'Open audio')}
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={audioSource} download>
            {t('common.download', 'Download')}
          </a>
        </Button>
      </div>
    </div>
  )
}

export function CustomerDetailContent({
  customer,
  audioSource,
  onOpenChat,
  hideActions = false,
}: {
  customer: CustomerSummary
  audioSource: string | null
  onOpenChat?: () => void
  hideActions?: boolean
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { user: currentUser } = useAuth()
  const { service: crmService } = useCrmScope()
  const customerName = getCustomerDisplayName(customer)
  const formattedNotes = formatCustomerNotes(customer.notes)
  const recallTone = getRecallTimeTone(customer.recall_time)
  const recallTimeClasses = recallTone
    ? getRecallTimeToneClasses(recallTone)
    : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]'

  // Additional notes from API
  const notesQuery = useAsyncData(() => crmService.getAdditionalNotes(customer.id), [customer.id], { enabled: Boolean(customer.id) })
  const [showAddInput, setShowAddInput] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<number | string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editingEnabled, setEditingEnabled] = useState(false)

  const aiNotes = formattedNotes.map((text, idx) => ({ id: `ai-${idx}`, note: text, created_by_full_name: 'Cognilabs AI', created_at: null, isAi: true }))
  const additionalNotes = notesQuery.data?.items ?? []
  const mergedNotes = [...aiNotes, ...additionalNotes]

  async function handleAddNote() {
    if (!newNote.trim() || !customer.id) return
    setIsAdding(true)
    try {
      await crmService.addAdditionalNote(customer.id, newNote.trim())
      setNewNote('')
      setShowAddInput(false)
      void notesQuery.refetch()
      showToast({ title: t('common.added', 'Added'), tone: 'success' })
    } catch (error) {
      showToast({ title: t('common.error', 'Error'), description: getCustomerActionErrorMessage(error, t), tone: 'error' })
    } finally {
      setIsAdding(false)
    }
  }

  async function handleUpdateNote(noteId: number) {
    if (!editingContent.trim() || !customer.id) return
    try {
      await crmService.updateAdditionalNote(customer.id, Number(noteId), editingContent.trim())
      setEditingNoteId(null)
      void notesQuery.refetch()
      showToast({ title: t('common.updated', 'Updated'), tone: 'success' })
    } catch (error) {
      showToast({ title: t('common.error', 'Error'), description: getCustomerActionErrorMessage(error, t), tone: 'error' })
    }
  }

  async function handleDeleteNote(noteId: number) {
    const ok = await confirm({
      title: t('common.delete_confirm', 'Are you sure?'),
      description: t('customers.notes.delete_description', 'This note will be permanently removed.'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await crmService.deleteAdditionalNote(customer.id, noteId)
      void notesQuery.refetch()
      showToast({ title: t('common.deleted', 'Deleted'), tone: 'success' })
    } catch (error) {
      showToast({ title: t('common.error', 'Error'), description: getCustomerActionErrorMessage(error, t), tone: 'error' })
    }
  }

  return (
    <section className="space-y-[18px]">
      <Card className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <MemberAvatar name={customerName} size="lg" />

            <div className="min-w-0">
              <p className="ui-eyebrow">
                {t('customers.detail.header_eyebrow', 'CRM / Customer')}
              </p>
              <h2 className="mt-1.5 text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
                {customerName}
              </h2>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                {getCustomerDisplayMeta(customer)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={customer.status} />
                {customer.assistant_name ? <Badge variant="violet">{customer.assistant_name}</Badge> : null}
                {customer.conversation_language ? (
                  <Badge variant="secondary">
                    {formatConversationLanguageLabel((key, fallback) => t(key, fallback), customer.conversation_language)}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          {!hideActions && (
            <div className="flex flex-wrap gap-2.5">
              {onOpenChat ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onOpenChat}
                  leftIcon={
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M14 10a1.33 1.33 0 0 1-1.33 1.33H4.67L2 14V3.33A1.33 1.33 0 0 1 3.33 2h9.34A1.33 1.33 0 0 1 14 3.33z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  {t('customers.detail.go_to_chat', "Suhbatga o'tish")}
                </Button>
              ) : null}
              {audioSource ? (
                <Button variant="secondary" size="sm" asChild>
                  <a href={audioSource} target="_blank" rel="noreferrer">
                    {t('common.open_audio', 'Open audio')}
                  </a>
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-4">
            <p className="ui-card-label">{t('common.platform', 'Platform')}</p>
            <p className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{getCustomerDisplayPlatform(customer) || '-'}</p>
          </div>
          <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-4">
            <p className="ui-card-label">{t('common.username', 'Username')}</p>
            <p className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{formatUsernameHandle(customer.username) || '-'}</p>
          </div>
          <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-4">
            <p className="ui-card-label">{t('customers.table.recall', 'Recall time')}</p>
            <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${recallTimeClasses}`}>
              {formatNumericDateTime(customer.recall_time)}
            </p>
          </div>
          <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-4">
            <p className="ui-card-label">{t('common.created', 'Created')}</p>
            <p className="mt-2 text-[17px] font-semibold tracking-[-0.01em] tabular-nums text-[var(--foreground)]">{formatNumericDate(customer.created_at)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-[18px] lg:grid-cols-2">
        {/* 1. AI Summary Card */}
        <Card className="flex flex-col gap-4">
          <SectionTitle
            title={t('customers.detail.ai_summary.title', 'AI summary')}
            description={t('customers.detail.ai_summary.description', 'CRM-generated summary.')}
          />
          {customer.aisummary ? (
            <p className="whitespace-pre-wrap rounded-[18px] bg-[var(--accent-soft)] p-[18px] text-sm leading-6 text-[var(--muted-strong)]">{customer.aisummary}</p>
          ) : (
            <EmptyStateBlock
              eyebrow={t('customers.detail.ai_summary.title', 'AI summary')}
              title={t('customers.detail.ai_summary.empty_title', 'No AI summary')}
              description={t('customers.detail.ai_summary.empty_description', 'AI summary is not available.')}
            />
          )}
        </Card>

        {/* 2. Profile Card */}
        <Card className="flex flex-col gap-4">
          <SectionTitle
            title={t('customers.detail.profile.title', 'Profile')}
            description={t('customers.detail.profile.description', 'Core contact and routing metadata.')}
          />
          <div className="grid gap-2.5">
            <div className="flex items-start justify-between gap-4 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3">
              <span className="text-sm text-[var(--muted)]">{t('common.phone', 'Phone')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">{customer.phone_number ?? customer.phone ?? '-'}</span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3">
              <span className="text-sm text-[var(--muted)]">{t('common.platform', 'Platform')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">{getCustomerDisplayPlatform(customer) || '-'}</span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3">
              <span className="text-sm text-[var(--muted)]">{t('customers.detail.audio_file_id', 'Audio file ID')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">{customer.audio_file_id || '-'}</span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3">
              <span className="text-sm text-[var(--muted)]">{t('common.assistant', 'Assistant')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">{customer.assistant_name || '-'}</span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3">
              <span className="text-sm text-[var(--muted)]">{t('common.conversation_language', 'Conversation language')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">
                {formatConversationLanguageLabel((key, fallback) => t(key, fallback), customer.conversation_language)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3">
              <span className="text-sm text-[var(--muted)]">{t('common.recall_time', 'Recall time')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${recallTimeClasses}`}>
                  {formatNumericDateTime(customer.recall_time)}
                </span>
              </span>
            </div>
          </div>
        </Card>

        {/* Lead Response Metrics */}
        {customer.lead_response_metrics && (
          <Card className="flex flex-col gap-4 lg:col-span-2">
            <SectionTitle
              title={t('customers.detail.lead_response.title', 'Lead javob vaqti')}
              description={t('customers.detail.lead_response.description', `SLA: ${customer.lead_response_metrics.response_limit_minutes} daqiqa`)}
            />
            {customer.lead_response_metrics.message && (
              <Alert
                tone={
                  customer.lead_response_metrics.is_late_response
                    ? 'danger'
                    : customer.lead_response_metrics.status_changed
                      ? 'success'
                      : 'warning'
                }
              >
                {customer.lead_response_metrics.message}
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5">
                <p className="ui-card-label">Javob vaqti</p>
                <p className={cn('mt-1.5 text-[20px] font-bold tracking-[-0.02em]',
                  customer.lead_response_metrics.is_late_response ? 'text-[var(--danger-text)]' : 'text-[var(--success-text)]'
                )}>
                  {customer.lead_response_metrics.response_human ?? '-'}
                </p>
              </div>
              <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5">
                <p className="ui-card-label">Holat</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {!customer.lead_response_metrics.status_changed && (
                    <Badge variant="warning" size="sm">
                      Hali bog'lanilmagan
                    </Badge>
                  )}
                  {customer.lead_response_metrics.status_changed && !customer.lead_response_metrics.is_late_response && (
                    <Badge variant="success" size="sm">
                      O'z vaqtida
                    </Badge>
                  )}
                  {customer.lead_response_metrics.is_late_response && (
                    <Badge variant="danger" size="sm">
                      Kech bog'lanildi
                    </Badge>
                  )}
                  {customer.lead_response_metrics.status_changed_without_note && (
                    <Badge variant="warning" size="sm">
                      Note yozilmadi
                    </Badge>
                  )}
                </div>
              </div>
              {customer.lead_response_metrics.note_human && (
                <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5">
                  <p className="ui-card-label">Note vaqti</p>
                  <p className="mt-1.5 text-[20px] font-bold tracking-[-0.02em] text-[var(--blue-text)]">{customer.lead_response_metrics.note_human}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 3. Notes Card (Operator + Additional Notes combined) */}
        <Card className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionTitle
              title={t('customers.detail.notes.title', 'Notes')}
              description={t('customers.detail.notes.description', 'All notes and communications.')}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant={editingEnabled ? 'secondary' : 'ghost'} onClick={() => setEditingEnabled((s) => !s)}>
                {editingEnabled ? t('common.done', 'Done') : t('common.edit', 'Edit')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddInput((s) => !s)}>
                {t('customers.notes.add_short', 'Add')}
              </Button>
            </div>
          </div>

          {showAddInput ? (
            <div className="flex flex-wrap gap-2.5">
              <Input
                value={newNote}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewNote(e.target.value)}
                placeholder={t('customers.notes.add_placeholder', 'Add a new note...')}
                className="min-w-[180px] flex-1"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleAddNote() }}
              />
              <Button size="sm" onClick={handleAddNote} disabled={isAdding || !newNote.trim()}>
                {isAdding ? '...' : t('common.add', 'Add')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setShowAddInput(false); setNewNote('') }}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          ) : null}

          {notesQuery.isLoading ? (
            <LoadingStateBlock eyebrow={t('customers.detail.notes.title', 'Notes')} title={t('common.loading', 'Loading...')} />
          ) : mergedNotes.length > 0 ? (
            <div className="space-y-2.5">
              {mergedNotes.map((note: MergedCustomerNote) => (
                <div key={String(note.id)} className="group relative rounded-[18px] bg-[var(--accent-soft)] p-4">
                  {editingNoteId === note.id ? (
                    <div className="space-y-2.5">
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="min-h-20 bg-[var(--surface)]"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditingNoteId(null)}>
                          {t('common.cancel', 'Cancel')}
                        </Button>
                        <Button size="sm" onClick={() => handleUpdateNote(note.id as number)}>
                          {t('common.save', 'Save')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{note.note}</p>
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <p className="text-[12px] text-[var(--muted)]">
                          {note.isAi ? note.created_by_full_name : (currentUser && note.created_by === currentUser.id ? `${currentUser.name} ${currentUser.surname}` : note.created_by_full_name)} {note.created_at ? `• ${formatNumericDateTime(note.created_at)}` : ''}
                        </p>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          {note.isAi ? null : (
                            <>
                              <IconButton
                                tone="primary"
                                size="sm"
                                label={t('common.edit', 'Edit')}
                                onClick={() => { setEditingNoteId(note.id); setEditingContent(note.note) }}
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </IconButton>
                              <IconButton
                                tone="danger"
                                size="sm"
                                label={t('common.delete', 'Delete')}
                                onClick={() => handleDeleteNote(note.id as number)}
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </IconButton>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateBlock
              eyebrow={t('customers.detail.notes.title', 'Notes')}
              title={t('customers.detail.notes.empty_title', 'No notes')}
              description={t('customers.detail.notes.empty_description', 'There are no notes.')}
            />
          )}
        </Card>

        {/* Audio Panel */}
        {audioSource ? (
          <div className="lg:col-span-2">
            <CustomerAudioPanel audioSource={audioSource} customerName={customerName} />
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function CustomerDetailDrawer({
  open,
  customerId,
  initialCustomer,
  onClose,
  onOpenChat,
  onSearchTelegram,
  onEdit,
}: {
  open: boolean
  customerId?: number | null
  initialCustomer?: CustomerSummary | null
  onClose: () => void
  onOpenChat?: (conversationId: number) => void
  onSearchTelegram?: (phoneNumber: string, customerId: number) => void
  onEdit?: (customer: CustomerSummary) => void
}) {
  const { t } = useTranslation()
  const { service: crmService, apiBasePath } = useCrmScope()
  const detailQuery = useAsyncData(
    () => crmService.detail(customerId ?? 0),
    [customerId, open],
    { enabled: open && Boolean(customerId && customerId > 0) },
  )

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  const isCustomerUnavailable = detailQuery.isError && isNotFoundError(detailQuery.error)
  const customer = isCustomerUnavailable
    ? null
    : detailQuery.data?.id === customerId ? detailQuery.data : initialCustomer ?? null
  const customerPhoneNumber = (customer?.phone_number ?? customer?.phone ?? '').trim()
  const audioSource = useMemo(
    () => resolveCustomerAudioUrl(customer?.audio_file_id, customer?.audio_url, apiBasePath),
    [apiBasePath, customer?.audio_file_id, customer?.audio_url],
  )

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label={t('customers.detail.drawer_close', 'Close customer detail drawer')}
        className="dialog-backdrop absolute inset-0"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 w-full md:w-[min(50vw,760px)]">
        <div className="sheet-enter flex h-full flex-col overflow-hidden bg-[var(--surface)] shadow-[var(--elev-xl)] md:rounded-l-[24px]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-[18px] py-4 sm:px-[22px]">
            <div className="min-w-0 flex-1">
              <p className="ui-eyebrow">
                {t('customers.detail.drawer_eyebrow', 'CRM drawer')}
              </p>
              <h2 className="mt-1.5 truncate text-xl font-bold tracking-[-0.02em] text-[var(--foreground)]">
                {customer ? getCustomerDisplayName(customer) : t('customers.detail', 'Customer detail')}
              </h2>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {customer && onSearchTelegram && customerPhoneNumber ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  title={t('customers.detail.search_telegram', 'Search Telegram')}
                  onClick={() => onSearchTelegram(customerPhoneNumber, customer.id)}
                  leftIcon={
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <circle cx="7" cy="7" r="4.25" />
                      <path d="M10.25 10.25 13 13" strokeLinecap="round" />
                    </svg>
                  }
                >
                  {t('customers.detail.search_telegram', 'Search Telegram')}
                </Button>
              ) : null}
              {customer && onEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  title={t('customers.detail.edit', 'Edit customer')}
                  onClick={() => onEdit(customer)}
                  leftIcon={
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M11.33 2.67L13.33 4.67M2 14h3.33l8-8V3.67A1.33 1.33 0 0 0 12 2.33H3.33A1.33 1.33 0 0 0 2 3.67z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  {t('customers.detail.edit', 'Edit')}
                </Button>
              ) : null}
              {customer?.chat_url && onOpenChat ? (() => {
                const match = customer.chat_url?.match(/conversation_id=(\d+)/)
                const convId = match ? Number(match[1]) : null
                return convId ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    title={t('customers.detail.view_chat', "Suhbatni ko'rish")}
                    onClick={() => onOpenChat(convId)}
                    leftIcon={
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M14 10a1.33 1.33 0 0 1-1.33 1.33H4.67L2 14V3.33A1.33 1.33 0 0 1 3.33 2h9.34A1.33 1.33 0 0 1 14 3.33z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                  >
                    {t('customers.detail.view_chat', "Suhbat")}
                  </Button>
                ) : null
              })() : null}

              <IconButton
                size="md"
                label={t('customers.detail.close', 'Close detail drawer')}
                onClick={onClose}
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
                </svg>
              </IconButton>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--app-canvas)] p-[18px] sm:p-[22px]">
            {isCustomerUnavailable ? (
              <ErrorStateBlock
                eyebrow={t('customers.detail', 'Customer detail')}
                title={getCustomerUnavailableTitle(t)}
                actionLabel={t('common.close', 'Close')}
                onAction={onClose}
              >
                <p className="max-w-md text-[13px] text-[var(--muted-strong)]">{getCustomerUnavailableMessage(t)}</p>
              </ErrorStateBlock>
            ) : detailQuery.isLoading && !customer ? (
              <LoadingStateBlock
                eyebrow={t('customers.detail', 'Customer detail')}
                title={t('customers.loading.detail.title', 'Customer detail loading')}
                description={t('customers.loading.detail.description', 'Preparing the CRM detail view.')}
              />
            ) : detailQuery.isError && !customer ? (
              <ErrorStateBlock
                eyebrow={t('customers.detail', 'Customer detail')}
                title={t('customers.errors.detail_unavailable.title', 'Customer detail unavailable')}
                description={t('customers.errors.detail_unavailable.description', 'The CRM detail endpoint could not return this customer.')}
                actionLabel={t('common.retry', 'Retry')}
                onAction={() => {
                  void detailQuery.refetch()
                }}
              />
            ) : customer ? (
              <CustomerDetailContent
                customer={customer}
                audioSource={audioSource}
                hideActions
              />
            ) : (
              <EmptyStateBlock
                eyebrow={t('customers.detail', 'Customer detail')}
                title={t('customers.detail.no_selection.title', 'No customer selected')}
                description={t('customers.detail.no_selection.description', 'Pick a CRM row to inspect the customer on the right side.')}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
