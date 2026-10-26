import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCrmScope } from '../lib/crmScope'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { formatNumericDateTime } from '../../../shared/lib/format'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Modal } from '../../../shared/ui/modal'
import { SelectField } from '../../../shared/ui/select-field'
import { EmptyStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'

export type CustomerFormValues = {
  full_name: string
  platform: string
  phone_number: string
  status: string
  username: string
  assistant_name: string
  notes: string
  recall_time: string
  clear_recall_time: boolean
  customer_type: string
  conversation_language: string
}

type StatusOption = {
  value: string
  label: string
}

type CustomerFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  customerId?: number
  values: CustomerFormValues
  statusOptions: StatusOption[]
  onClose: () => void
  onChange: (field: keyof CustomerFormValues, value: string | boolean) => void
  onFileChange: (file: File | null) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export function CustomerFormModal({
  open,
  mode,
  customerId,
  values,
  statusOptions,
  onClose,
  onChange,
  onFileChange,
  onSubmit,
  isSubmitting,
}: CustomerFormModalProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { service: crmService } = useCrmScope()

  const [showAddInput, setShowAddInput] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const notesQuery = useAsyncData(
    () => crmService.getAdditionalNotes(customerId ?? 0),
    [customerId, open],
    { enabled: mode === 'edit' && Boolean(customerId) },
  )

  async function handleAddNote() {
    if (!newNote.trim() || !customerId) return
    setIsAdding(true)
    try {
      await crmService.addAdditionalNote(customerId, newNote.trim())
      setNewNote('')
      setShowAddInput(false)
      void notesQuery.refetch()
      showToast({ title: t('common.added', 'Added'), tone: 'success' })
    } catch {
      showToast({ title: t('common.error', 'Error'), tone: 'error' })
    } finally {
      setIsAdding(false)
    }
  }

  async function handleUpdateNote(noteId: number) {
    if (!editingContent.trim() || !customerId) return
    try {
      await crmService.updateAdditionalNote(customerId, noteId, editingContent.trim())
      setEditingNoteId(null)
      void notesQuery.refetch()
      showToast({ title: t('common.updated', 'Updated'), tone: 'success' })
    } catch {
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
      await crmService.deleteAdditionalNote(customerId!, noteId)
      void notesQuery.refetch()
      showToast({ title: t('common.deleted', 'Deleted'), tone: 'success' })
    } catch {
      showToast({ title: t('common.error', 'Error'), tone: 'error' })
    }
  }
  const conversationLanguages = [
    { value: 'uz', label: t('common.language.uz', 'Uzbek') },
    { value: 'ru', label: t('common.language.ru', 'Russian') },
    { value: 'en', label: t('common.language.en', 'English') },
  ]
  const customerTypes = [
    { value: '', label: t('common.not_set', 'Not set') },
    { value: 'local', label: t('common.scope.local', 'Local') },
    { value: 'international', label: t('common.scope.international', 'International') },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create'
        ? t('customers.form.title_create', 'Create customer')
        : t('customers.form.title_edit', 'Edit customer details')}
      description={t('customers.form.description', 'Create or update CRM records and sync them with the backend.')}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? t('customers.form.submitting', 'Saving...')
              : mode === 'create'
                ? t('customers.form.submit_create', 'Create customer')
                : t('customers.form.submit_edit', 'Save changes')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('common.full_name', 'Full name')}</span>
          <Input value={values.full_name} onChange={(event) => onChange('full_name', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('common.platform', 'Platform')}</span>
          <Input value={values.platform} onChange={(event) => onChange('platform', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('common.phone', 'Phone')}</span>
          <Input value={values.phone_number} onChange={(event) => onChange('phone_number', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('common.status', 'Status')}</span>
          <SelectField
            key={`customer-status-${values.status || 'empty'}`}
            value={values.status}
            onValueChange={(value) => onChange('status', value)}
            options={[{ value: '', label: t('customers.form.status_placeholder', 'Select status') }, ...statusOptions]}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('common.username', 'Username')}</span>
          <Input value={values.username} onChange={(event) => onChange('username', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('common.assistant', 'Assistant')}</span>
          <Input value={values.assistant_name} onChange={(event) => onChange('assistant_name', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('common.recall_time', 'Recall time')}</span>
          <Input
            type="datetime-local"
            value={values.recall_time}
            onChange={(event) => onChange('recall_time', event.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('common.customer_type', 'Customer type')}</span>
          <SelectField
            value={values.customer_type}
            onValueChange={(value) => onChange('customer_type', value)}
            options={customerTypes}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">
            {t('common.conversation_language', 'Conversation language')}
          </span>
          <SelectField
            value={values.conversation_language}
            onValueChange={(value) => onChange('conversation_language', value)}
            options={conversationLanguages}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-medium text-[var(--foreground)]">{t('common.audio', 'Audio')}</span>
          <input
            type="file"
            accept="audio/*"
            className="block min-h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-3 py-2 text-xs text-[var(--muted-strong)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:border-[var(--border-hover)] hover:bg-[var(--input-surface-hover)]"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--input-surface)] px-4 py-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] transition hover:border-[var(--border-hover)] hover:bg-[var(--input-surface-hover)]">
        <input
          type="checkbox"
          checked={values.clear_recall_time}
          onChange={(event) => onChange('clear_recall_time', event.target.checked)}
          className="h-4 w-4 rounded border border-[var(--border)] accent-blue-500 dark:border-white/10"
        />
        <span className="text-xs text-[var(--muted-strong)]">{t('customers.form.clear_recall', 'Clear recall time')}</span>
      </label>

      {mode === 'edit' && customerId ? (
        <div className="mt-6 rounded-xl border border-(--border) overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-(--border) px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-(--foreground)">{t('customers.detail.notes.title', 'Notes')}</p>
              <p className="text-[10px] text-(--muted-strong)">{t('customers.detail.notes.description', 'All notes and communications.')}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowAddInput((s) => !s)}>
              {t('customers.notes.add_short', 'Add')}
            </Button>
          </div>

          <div className="px-4 py-4 space-y-3">
            {showAddInput ? (
              <div className="flex gap-2">
                <Input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={t('customers.notes.add_placeholder', 'Add a new note...')}
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleAddNote() }}
                />
                <Button size="sm" onClick={() => void handleAddNote()} disabled={isAdding || !newNote.trim()}>
                  {isAdding ? '...' : t('common.add', 'Add')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setShowAddInput(false); setNewNote('') }}>
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            ) : null}

            {notesQuery.isLoading ? (
              <LoadingStateBlock eyebrow={t('customers.detail.notes.title', 'Notes')} title={t('common.loading', 'Loading...')} />
            ) : notesQuery.data?.items.length ? (
              <div className="space-y-2">
                {notesQuery.data.items.map((note) => (
                  <div
                    key={note.id}
                    className="group relative rounded-xl border border-(--border) bg-(--input-surface) p-3 transition hover:border-(--border-hover)"
                  >
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full rounded-lg border border-(--border) bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setEditingNoteId(null)}>
                            {t('common.cancel', 'Cancel')}
                          </Button>
                          <Button size="sm" onClick={() => void handleUpdateNote(note.id)}>
                            {t('common.save', 'Save')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-sm text-(--foreground)">{note.note}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[10px] text-(--muted-strong)">
                            {note.created_by_full_name} {note.created_at ? `• ${formatNumericDateTime(note.created_at)}` : ''}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
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
                            <button
                              onClick={() => void handleDeleteNote(note.id)}
                              className="p-1 text-(--muted-strong) hover:text-red-500"
                              title={t('common.delete', 'Delete')}
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
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
        </div>
      ) : null}
    </Modal>
  )
}
