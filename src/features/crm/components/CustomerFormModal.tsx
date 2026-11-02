import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCrmScope } from '../lib/crmScope'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { formatNumericDateTime } from '../../../shared/lib/format'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { IconButton } from '../../../shared/ui/icon-button'
import { Input } from '../../../shared/ui/input'
import { Modal } from '../../../shared/ui/modal'
import { SelectField } from '../../../shared/ui/select-field'
import { Textarea } from '../../../shared/ui/textarea'
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
      <div className="grid gap-[18px] md:grid-cols-2">
        <label className="grid gap-2">
          <span className="ui-input-label">{t('common.full_name', 'Full name')}</span>
          <Input value={values.full_name} onChange={(event) => onChange('full_name', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="ui-input-label">{t('common.platform', 'Platform')}</span>
          <Input value={values.platform} onChange={(event) => onChange('platform', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="ui-input-label">{t('common.phone', 'Phone')}</span>
          <Input value={values.phone_number} onChange={(event) => onChange('phone_number', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="ui-input-label">{t('common.status', 'Status')}</span>
          <SelectField
            key={`customer-status-${values.status || 'empty'}`}
            value={values.status}
            onValueChange={(value) => onChange('status', value)}
            options={[{ value: '', label: t('customers.form.status_placeholder', 'Select status') }, ...statusOptions]}
          />
        </label>
        <label className="grid gap-2">
          <span className="ui-input-label">{t('common.username', 'Username')}</span>
          <Input value={values.username} onChange={(event) => onChange('username', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="ui-input-label">{t('common.assistant', 'Assistant')}</span>
          <Input value={values.assistant_name} onChange={(event) => onChange('assistant_name', event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="ui-input-label">{t('common.recall_time', 'Recall time')}</span>
          <Input
            type="datetime-local"
            value={values.recall_time}
            onChange={(event) => onChange('recall_time', event.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="ui-input-label">{t('common.customer_type', 'Customer type')}</span>
          <SelectField
            value={values.customer_type}
            onValueChange={(value) => onChange('customer_type', value)}
            options={customerTypes}
          />
        </label>
        <label className="grid gap-2">
          <span className="ui-input-label">
            {t('common.conversation_language', 'Conversation language')}
          </span>
          <SelectField
            value={values.conversation_language}
            onValueChange={(value) => onChange('conversation_language', value)}
            options={conversationLanguages}
          />
        </label>
        <label className="grid gap-2">
          <span className="ui-input-label">{t('common.audio', 'Audio')}</span>
          <input
            type="file"
            accept="audio/*"
            className="block min-h-11 w-full rounded-[14px] border border-transparent bg-[var(--input-surface)] px-3.5 py-2.5 text-[13px] text-[var(--muted-strong)] transition-colors file:mr-3 file:rounded-[9px] file:border-0 file:bg-[var(--blue-dim)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--blue-text)] hover:bg-[var(--input-surface-hover)]"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <label className="mt-[18px] flex cursor-pointer items-center gap-3 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3 transition-colors hover:bg-[var(--input-surface-hover)]">
        <Checkbox
          size="sm"
          checked={values.clear_recall_time}
          onChange={(event) => onChange('clear_recall_time', event.target.checked)}
        />
        <span className="text-sm text-[var(--muted-strong)]">{t('customers.form.clear_recall', 'Clear recall time')}</span>
      </label>

      {mode === 'edit' && customerId ? (
        <div className="mt-[18px] space-y-4 rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{t('customers.detail.notes.title', 'Notes')}</p>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">{t('customers.detail.notes.description', 'All notes and communications.')}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowAddInput((s) => !s)}>
              {t('customers.notes.add_short', 'Add')}
            </Button>
          </div>

          {showAddInput ? (
            <div className="flex flex-wrap gap-2.5">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={t('customers.notes.add_placeholder', 'Add a new note...')}
                className="min-w-[180px] flex-1 bg-[var(--surface)]"
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
            <LoadingStateBlock
              eyebrow={t('customers.detail.notes.title', 'Notes')}
              title={t('common.loading', 'Loading...')}
              className="bg-[var(--surface)]"
            />
          ) : notesQuery.data?.items.length ? (
            <div className="space-y-2.5">
              {notesQuery.data.items.map((note) => (
                <div
                  key={note.id}
                  className="group relative rounded-[14px] bg-[var(--surface)] p-4"
                >
                  {editingNoteId === note.id ? (
                    <div className="space-y-2.5">
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="min-h-20"
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
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{note.note}</p>
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <p className="text-[12px] text-[var(--muted)]">
                          {note.created_by_full_name} {note.created_at ? `• ${formatNumericDateTime(note.created_at)}` : ''}
                        </p>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
                            onClick={() => void handleDeleteNote(note.id)}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </IconButton>
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
              className="bg-[var(--surface)]"
            />
          )}
        </div>
      ) : null}
    </Modal>
  )
}
