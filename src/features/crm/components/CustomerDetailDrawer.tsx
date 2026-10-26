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
import { Badge, StatusBadge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Card } from '../../../shared/ui/card'
import { SectionTitle } from '../../../shared/ui/section-title'
import { EmptyStateBlock, ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { resolveCustomerAudioUrl } from '../lib/customerAudio'
import { getRecallTimeTone, getRecallTimeToneClasses } from '../lib/recallTime'
import { AudioPlayerCard } from './AudioPlayerCard'

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

      <div className="flex flex-wrap gap-2">
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
  const recallTimeClasses = recallTone ? getRecallTimeToneClasses(recallTone) : ''

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
      showToast({ title: t('common.error', 'Error'), tone: 'error' })
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
      showToast({ title: t('common.error', 'Error'), tone: 'error' })
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
      showToast({ title: t('common.error', 'Error'), tone: 'error' })
    }
  }

  return (
    <section className="space-y-4">
      <Card noPadding className="overflow-hidden rounded-xl border-[var(--border)] bg-[var(--surface-elevated)] shadow-none">
        <div className="relative overflow-hidden px-6 py-6 sm:px-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_right,rgba(168,85,247,0.12),transparent_28%)]" />

          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--blue-text)]">
                  {t('customers.detail.header_eyebrow', 'CRM / Customer')}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-[2rem]">
                  {customerName}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted-strong)]">
                  {getCustomerDisplayMeta(customer)}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusBadge status={customer.status} />
                  {customer.assistant_name ? <Badge variant="violet">{customer.assistant_name}</Badge> : null}
                  {customer.conversation_language ? (
                    <Badge variant="outline">
                      {formatConversationLanguageLabel((key, fallback) => t(key, fallback), customer.conversation_language)}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {!hideActions && (
                <div className="flex flex-wrap gap-2">
                  {onOpenChat ? (
                    <Button variant="secondary" size="sm" onClick={onOpenChat}>
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M14 10a1.33 1.33 0 0 1-1.33 1.33H4.67L2 14V3.33A1.33 1.33 0 0 1 3.33 2h9.34A1.33 1.33 0 0 1 14 3.33z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
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

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-blue-500/16 bg-blue-500/[0.08] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t('common.platform', 'Platform')}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{getCustomerDisplayPlatform(customer) || '-'}</p>
              </div>
              <div className="rounded-xl border border-violet-500/16 bg-violet-500/[0.08] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t('common.username', 'Username')}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{formatUsernameHandle(customer.username) || '-'}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/16 bg-emerald-500/[0.08] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t('customers.table.recall', 'Recall time')}</p>
                <p className={`mt-2 inline-flex rounded-sm border px-2.5 py-1 text-[13px] font-medium leading-none ${recallTimeClasses}`}>
                  {formatNumericDateTime(customer.recall_time)}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/16 bg-amber-500/[0.08] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t('common.created', 'Created')}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{formatNumericDate(customer.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 1. AI Summary Card */}
        <Card className="overflow-hidden rounded-xl border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-6 py-5">
            <SectionTitle
              title={t('customers.detail.ai_summary.title', 'AI summary')}
              description={t('customers.detail.ai_summary.description', 'CRM-generated summary.')}
            />
          </div>
          <div className="px-6 py-5">
            {customer.aisummary ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted-strong)]">{customer.aisummary}</p>
            ) : (
              <EmptyStateBlock
                eyebrow={t('customers.detail.ai_summary.title', 'AI summary')}
                title={t('customers.detail.ai_summary.empty_title', 'No AI summary')}
                description={t('customers.detail.ai_summary.empty_description', 'AI summary is not available.')}
              />
            )}
          </div>
        </Card>

        {/* 2. Profile Card */}
        <Card className="overflow-hidden rounded-xl border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-6 py-5">
            <SectionTitle
              title={t('customers.detail.profile.title', 'Profile')}
              description={t('customers.detail.profile.description', 'Core contact and routing metadata.')}
            />
          </div>
          <div className="grid gap-3 px-6 py-5">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3">
              <span className="text-sm text-[var(--muted-strong)]">{t('common.phone', 'Phone')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">{customer.phone_number ?? customer.phone ?? '-'}</span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3">
              <span className="text-sm text-[var(--muted-strong)]">{t('common.platform', 'Platform')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">{getCustomerDisplayPlatform(customer) || '-'}</span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3">
              <span className="text-sm text-[var(--muted-strong)]">{t('customers.detail.audio_file_id', 'Audio file ID')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">{customer.audio_file_id || '-'}</span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3">
              <span className="text-sm text-[var(--muted-strong)]">{t('common.assistant', 'Assistant')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">{customer.assistant_name || '-'}</span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3">
              <span className="text-sm text-[var(--muted-strong)]">{t('common.conversation_language', 'Conversation language')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">
                {formatConversationLanguageLabel((key, fallback) => t(key, fallback), customer.conversation_language)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3">
              <span className="text-sm text-[var(--muted-strong)]">{t('common.recall_time', 'Recall time')}</span>
              <span className="max-w-[62%] break-all text-right text-sm font-semibold text-[var(--foreground)]">
                <span className={`inline-flex rounded-sm border px-2.5 py-1 text-[13px] font-medium leading-none ${recallTimeClasses}`}>
                  {formatNumericDateTime(customer.recall_time)}
                </span>
              </span>
            </div>
          </div>
        </Card>

        {/* Lead Response Metrics */}
        {customer.lead_response_metrics && (
          <Card className="overflow-hidden rounded-xl border-[var(--border)] lg:col-span-2">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <SectionTitle
                title={t('customers.detail.lead_response.title', 'Lead javob vaqti')}
                description={t('customers.detail.lead_response.description', `SLA: ${customer.lead_response_metrics.response_limit_minutes} daqiqa`)}
              />
            </div>
            <div className="px-6 py-5 space-y-3">
              {customer.lead_response_metrics.message && (
                <div className={cn(
                  'rounded-xl border px-4 py-3 text-sm font-medium',
                  customer.lead_response_metrics.is_late_response
                    ? 'border-red-500/20 bg-red-500/[0.08] text-red-400'
                    : customer.lead_response_metrics.status_changed
                      ? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400'
                      : 'border-amber-500/20 bg-amber-500/[0.08] text-amber-400',
                )}>
                  {customer.lead_response_metrics.message}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Javob vaqti</p>
                  <p className={cn('mt-1.5 text-lg font-semibold',
                    customer.lead_response_metrics.is_late_response ? 'text-red-400' : 'text-emerald-400'
                  )}>
                    {customer.lead_response_metrics.response_human ?? '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Holat</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {!customer.lead_response_metrics.status_changed && (
                      <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                        Hali bog'lanilmagan
                      </span>
                    )}
                    {customer.lead_response_metrics.status_changed && !customer.lead_response_metrics.is_late_response && (
                      <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        O'z vaqtida
                      </span>
                    )}
                    {customer.lead_response_metrics.is_late_response && (
                      <span className="inline-flex items-center rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                        Kech bog'lanildi
                      </span>
                    )}
                    {customer.lead_response_metrics.status_changed_without_note && (
                      <span className="inline-flex items-center rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-400">
                        Note yozilmadi
                      </span>
                    )}
                  </div>
                </div>
                {customer.lead_response_metrics.note_human && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Note vaqti</p>
                    <p className="mt-1.5 text-lg font-semibold text-sky-400">{customer.lead_response_metrics.note_human}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* 3. Notes Card (Operator + Additional Notes combined) */}
        <Card className="overflow-hidden rounded-xl border-[var(--border)] lg:col-span-2">
          <div className="border-b border-[var(--border)] px-6 py-5 flex items-center justify-between gap-4">
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

          <div className="px-6 py-5">
            {showAddInput ? (
              <div className="mb-4 flex gap-2">
                <Input
                  value={newNote}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewNote(e.target.value)}
                  placeholder={t('customers.notes.add_placeholder', 'Add a new note...')}
                  className="flex-1"
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
              <div className="space-y-3">
                {mergedNotes.map((note: any) => (
                  <div key={String(note.id)} className="group relative rounded-xl border border-[var(--border)] bg-[var(--input-surface)] p-3 transition hover:border-[var(--border-hover)]">
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full rounded-lg border border-[var(--border)] bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setEditingNoteId(null)}>
                            {t('common.cancel', 'Cancel')}
                          </Button>
                          <Button size="sm" onClick={() => handleUpdateNote(note.id)}>
                            {t('common.save', 'Save')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-sm text-[var(--foreground)]">{note.note}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[10px] text-[var(--muted-strong)]">
                            {note.isAi ? note.created_by_full_name : (currentUser && note.created_by === currentUser.id ? `${currentUser.name} ${currentUser.surname}` : note.created_by_full_name)} {note.created_at ? `• ${formatNumericDateTime(note.created_at)}` : ''}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            {note.isAi ? null : (
                              <>
                                <button
                                  onClick={() => handleDeleteNote(note.id as number)}
                                  className="p-1 text-(--muted-strong) hover:text-red-500"
                                  title={t('common.delete', 'Delete')}
                                >
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => { setEditingNoteId(note.id); setEditingContent(note.note) }}
                                  className="p-1 text-(--muted-strong) hover:text-blue-500"
                                  title={t('common.edit', 'Edit')}
                                >
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
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
          </div>
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

  const customer = detailQuery.data?.id === customerId ? detailQuery.data : initialCustomer ?? null
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
        className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(59,130,246,0.10),transparent_24%),rgba(0,0,0,0.62)] backdrop-blur-md"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 w-full md:w-[min(50vw,760px)]">
        <div className="sheet-enter flex h-full flex-col border-l border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_20px_80px_rgba(0,0,0,0.46)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--blue-text)]">
                {t('customers.detail.drawer_eyebrow', 'CRM drawer')}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {customer ? getCustomerDisplayName(customer) : t('customers.detail', 'Customer detail')}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {customer && onSearchTelegram && customerPhoneNumber ? (
                <button
                  type="button"
                  title={t('customers.detail.search_telegram', 'Search Telegram')}
                  onClick={() => onSearchTelegram(customerPhoneNumber, customer.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#2AABEE]/30 bg-[#2AABEE]/10 px-3 text-xs font-semibold text-[#2AABEE] transition hover:bg-[#2AABEE]/20"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="7" cy="7" r="4.25" />
                    <path d="M10.25 10.25 13 13" strokeLinecap="round" />
                  </svg>
                  {t('customers.detail.search_telegram', 'Search Telegram')}
                </button>
              ) : null}
              {customer && onEdit ? (
                <button
                  type="button"
                  title={t('customers.detail.edit', 'Edit customer')}
                  onClick={() => onEdit(customer)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/20"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M11.33 2.67L13.33 4.67M2 14h3.33l8-8V3.67A1.33 1.33 0 0 0 12 2.33H3.33A1.33 1.33 0 0 0 2 3.67z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t('customers.detail.edit', 'Edit')}
                </button>
              ) : null}
              {customer?.chat_url && onOpenChat ? (() => {
                const match = customer.chat_url?.match(/conversation_id=(\d+)/)
                const convId = match ? Number(match[1]) : null
                return convId ? (
                  <button
                    type="button"
                    title={t('customers.detail.view_chat', "Suhbatni ko'rish")}
                    onClick={() => onOpenChat(convId)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#3390ec]/30 bg-[#3390ec]/10 px-3 text-xs font-semibold text-[#3390ec] transition hover:bg-[#3390ec]/20"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M14 10a1.33 1.33 0 0 1-1.33 1.33H4.67L2 14V3.33A1.33 1.33 0 0 1 3.33 2h9.34A1.33 1.33 0 0 1 14 3.33z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t('customers.detail.view_chat', "Suhbat")}
                  </button>
                ) : null
              })() : null}

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-surface)] text-[var(--muted-strong)] transition hover:border-[var(--border-hover)] hover:bg-[var(--input-surface-hover)] hover:text-[var(--foreground)]"
                aria-label={t('customers.detail.close', 'Close detail drawer')}
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {detailQuery.isLoading && !customer ? (
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
