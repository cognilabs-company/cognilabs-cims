import { useState } from 'react'
import type { CommentAutomationSettingsPayload } from '../../../../shared/api/services/cognilabsai.service'
import { Alert } from '../../../../shared/ui/alert'
import { Button } from '../../../../shared/ui/button'
import { Dialog } from '../../../../shared/ui/dialog'
import { AutomationToggle, SettingsForm } from './SettingsForm'
import {
  emptyBulkDraft,
  getValidationMessage,
  payloadFromDraft,
  useCommentAutomationT,
  validateDraft,
  type SettingsDraft,
} from './shared'

export function BulkSettingsDialog({
  count,
  onClose,
  onSubmit,
}: {
  count: number
  onClose: () => void
  onSubmit: (payload: CommentAutomationSettingsPayload) => Promise<boolean>
}) {
  const tx = useCommentAutomationT()
  const [draft, setDraft] = useState<SettingsDraft>(emptyBulkDraft)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const validationError = validateDraft(draft)

  async function handleSubmit() {
    if (validationError) return
    setIsSubmitting(true)
    const isSaved = await onSubmit(payloadFromDraft(draft))
    setIsSubmitting(false)
    if (isSaved) onClose()
  }

  return (
    <Dialog
      open
      onClose={isSubmitting ? () => undefined : onClose}
      eyebrow={tx('header.eyebrow', 'CognilabsAI')}
      title={tx('bulk.dialog_title', 'Shared reply settings')}
      description={tx('bulk.dialog_description', 'The same settings will be applied to {{count}} selected posts/reels and will replace their current settings.', { count })}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {tx('actions.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={Boolean(validationError)} loading={isSubmitting}>
            {tx('bulk.apply', 'Apply to {{count}} items', { count })}
          </Button>
        </>
      }
    >
      <div className="space-y-[18px]">
        <AutomationToggle enabled={draft.automation_enabled} onChange={(value) => setDraft({ ...draft, automation_enabled: value })} />
        <SettingsForm idPrefix="bulk" draft={draft} onChange={setDraft} />
        {validationError && (
          <Alert tone="danger">{getValidationMessage(validationError, tx)}</Alert>
        )}
      </div>
    </Dialog>
  )
}
