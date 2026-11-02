/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCrmScope } from '../lib/crmScope'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { IconButton } from '../../../shared/ui/icon-button'
import { Input } from '../../../shared/ui/input'
import { SectionTitle } from '../../../shared/ui/section-title'
import { Textarea } from '../../../shared/ui/textarea'
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
    <Card className="flex flex-col gap-4">
      <SectionTitle
        title={t('customers.detail.additional_notes.title', 'Additional Notes')}
        description={t('customers.detail.additional_notes.description', 'Keep track of extra information about this customer.')}
      />

      <div className="flex flex-wrap gap-2.5">
        <Input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={t('customers.notes.add_placeholder', 'Add a new note...')}
          className="min-w-[180px] flex-1"
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
        <div className="space-y-2.5">
          {notesQuery.data.items.map((note) => (
            <div
              key={note.id}
              className="group relative rounded-[18px] bg-[var(--accent-soft)] p-4"
            >
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
                    <Button size="sm" onClick={() => handleUpdateNote(note.id)}>
                      {t('common.save', 'Save')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{note.note}</p>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <p className="text-[12px] text-[var(--muted)]">
                      {note.created_by_full_name} • {formatNumericDateTime(note.created_at)}
                    </p>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <IconButton
                        tone="primary"
                        size="sm"
                        label={t('common.edit', 'Edit')}
                        onClick={() => {
                          setEditingNoteId(note.id)
                          setEditingContent(note.note)
                        }}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        size="sm"
                        label={t('common.delete', 'Delete')}
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
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
          eyebrow="Notes"
          title={t('customers.notes.empty_title', 'No additional notes')}
          description={t('customers.notes.empty_description', 'Start adding notes to this customer.')}
        />
      )}
    </Card>
  )
}
