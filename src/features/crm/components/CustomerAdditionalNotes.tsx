/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCrmScope } from '../lib/crmScope'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { SectionTitle } from '../../../shared/ui/section-title'
import { EmptyStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { formatNumericDateTime } from '../../../shared/lib/format'
import { useConfirm } from '../../../shared/confirm/useConfirm'

export function CustomerAdditionalNotes({ customerId }: { customerId: number }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { service: crmService } = useCrmScope()
  const [newNote, setNewNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const notesQuery = useAsyncData(
    () => crmService.getAdditionalNotes(customerId),
    [customerId]
  )

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setIsSubmitting(true)
    try {
      await crmService.addAdditionalNote(customerId, newNote.trim())
      setNewNote('')
      void notesQuery.refetch()
      showToast({ title: t('common.success', 'Success'), tone: 'success' })
    } catch (error) {
      showToast({ title: t('common.error', 'Error'), tone: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateNote = async (noteId: number) => {
    if (!editingContent.trim()) return
    try {
      await crmService.updateAdditionalNote(customerId, noteId, editingContent.trim())
      setEditingNoteId(null)
      void notesQuery.refetch()
      showToast({ title: t('common.updated', 'Updated'), tone: 'success' })
    } catch (error) {
      showToast({ title: t('common.error', 'Error'), tone: 'error' })
    }
  }

  const handleDeleteNote = async (noteId: number) => {
    const ok = await confirm({
      title: t('common.delete_confirm', 'Are you sure?'),
      description: t('customers.notes.delete_description', 'This note will be permanently removed.'),
      tone: 'danger',
    })
    if (!ok) return

    try {
      await crmService.deleteAdditionalNote(customerId, noteId)
      void notesQuery.refetch()
      showToast({ title: t('common.deleted', 'Deleted'), tone: 'success' })
    } catch (error) {
      showToast({ title: t('common.error', 'Error'), tone: 'error' })
    }
  }

  return (
    <Card className="overflow-hidden rounded-xl border-[var(--border)]">
      <div className="border-b border-[var(--border)] px-6 py-5">
        <SectionTitle
          title={t('customers.detail.additional_notes.title', 'Additional Notes')}
          description={t('customers.detail.additional_notes.description', 'Keep track of extra information about this customer.')}
        />
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="flex gap-2">
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={t('customers.notes.add_placeholder', 'Add a new note...')}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={isSubmitting || !newNote.trim()}
          >
            {isSubmitting ? '...' : t('common.add', 'Add')}
          </Button>
        </div>

        {notesQuery.isLoading ? (
          <LoadingStateBlock eyebrow="Notes" title={t('common.loading', 'Loading...')} />
        ) : notesQuery.data?.items.length ? (
          <div className="space-y-3">
            {notesQuery.data.items.map((note) => (
              <div
                key={note.id}
                className="group relative rounded-xl border border-[var(--border)] bg-[var(--input-surface)] p-3 transition hover:border-[var(--border-hover)]"
              >
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
                        {note.created_by_full_name} • {formatNumericDateTime(note.created_at)}
                      </p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => {
                            setEditingNoteId(note.id)
                            setEditingContent(note.note)
                          }}
                          className="p-1 text-[var(--muted-strong)] hover:text-blue-500"
                          title={t('common.edit', 'Edit')}
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 text-[var(--muted-strong)] hover:text-red-500"
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
            eyebrow="Notes"
            title={t('customers.notes.empty_title', 'No additional notes')}
            description={t('customers.notes.empty_description', 'Start adding notes to this customer.')}
          />
        )}
      </div>
    </Card>
  )
}
