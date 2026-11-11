import type { ReactNode } from 'react'
import type { CommentAutomationReplyMode } from '../../../../shared/api/services/cognilabsai.service'
import { cn } from '../../../../shared/lib/cn'
import { Label } from '../../../../shared/ui/label'
import { Switch } from '../../../../shared/ui/switch'
import { Tabs } from '../../../../shared/ui/tabs'
import { Textarea } from '../../../../shared/ui/textarea'
import { TEMPLATE_PLACEHOLDERS, useCommentAutomationT, type SettingsDraft } from './shared'

function PublicReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function DirectMessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

export function AutomationToggle({
  enabled,
  onChange,
  readOnly = false,
  className,
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
  /** Hide the switch (no `edit` permission); the status text still shows the state. */
  readOnly?: boolean
  className?: string
}) {
  const tx = useCommentAutomationT()

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-[18px] px-4 py-3.5 transition-colors',
        enabled ? 'bg-[var(--success-dim)]' : 'bg-[var(--muted-surface)]',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)]">{tx('settings.automation', 'Auto reply')}</p>
        <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
          {enabled
            ? tx('settings.automation_on', 'On: new comments get replies')
            : tx('settings.automation_off', 'Off: nothing is sent')}
        </p>
      </div>
      {readOnly ? null : <Switch checked={enabled} onChange={onChange} tone="emerald" label={tx('settings.automation', 'Auto reply')} />}
    </div>
  )
}

function ModeToggle({ value, onChange }: { value: CommentAutomationReplyMode; onChange: (mode: CommentAutomationReplyMode) => void }) {
  const tx = useCommentAutomationT()

  return (
    <Tabs<CommentAutomationReplyMode>
      value={value}
      onChange={onChange}
      items={[
        { value: 'ai', label: tx('settings.mode_ai', 'AI') },
        { value: 'template', label: tx('settings.mode_template', 'Template') },
      ]}
    />
  )
}

function ChannelSettings({
  id,
  icon,
  title,
  description,
  enabled,
  mode,
  template,
  templatePlaceholder,
  onEnabledChange,
  onModeChange,
  onTemplateChange,
  readOnly,
}: {
  id: string
  icon: ReactNode
  title: string
  description: string
  enabled: boolean
  mode: CommentAutomationReplyMode
  template: string
  templatePlaceholder: string
  onEnabledChange: (enabled: boolean) => void
  onModeChange: (mode: CommentAutomationReplyMode) => void
  onTemplateChange: (template: string) => void
  readOnly: boolean
}) {
  const tx = useCommentAutomationT()
  const templateId = `${id}-template`

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[18px] p-4 transition-colors',
        enabled ? 'bg-[var(--accent-soft)]' : 'bg-[var(--muted-surface)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-[11px]',
              enabled ? 'bg-[var(--blue-dim)] text-[var(--blue-text)]' : 'bg-[var(--surface)] text-[var(--muted)]',
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--muted)]">{description}</p>
          </div>
        </div>
        {readOnly ? null : <Switch checked={enabled} onChange={onEnabledChange} size="sm" tone="emerald" label={title} />}
      </div>

      {enabled && (
        <div className="space-y-2.5">
          <ModeToggle value={mode} onChange={onModeChange} />
          {mode === 'template' ? (
            <>
              <Label htmlFor={templateId} className="sr-only">{title}</Label>
              <Textarea
                id={templateId}
                value={template}
                onChange={(event) => onTemplateChange(event.target.value)}
                placeholder={templatePlaceholder}
                className="min-h-[76px] bg-[var(--surface)] text-[13px]"
              />
              {readOnly ? null : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] text-[var(--muted)]">{tx('settings.insert', 'Insert:')}</span>
                  {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                    <button
                      key={placeholder}
                      type="button"
                      data-i18n-skip="true"
                      onClick={() => onTemplateChange(`${template}${placeholder}`)}
                      className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] text-[var(--muted-strong)] transition-colors hover:text-[var(--foreground)]"
                    >
                      {placeholder}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[12.5px] text-[var(--muted)]">{tx('settings.template_hint', 'This exact text is sent; placeholders are filled in automatically.')}</p>
            </>
          ) : (
            <p className="text-[12.5px] text-[var(--muted)]">{tx('settings.ai_hint', 'AI writes a separate reply for each comment, so the exact text is not guaranteed.')}</p>
          )}
        </div>
      )}
    </div>
  )
}

export function SettingsForm({
  idPrefix,
  draft,
  onChange,
  layout = 'columns',
  readOnly = false,
}: {
  idPrefix: string
  draft: SettingsDraft
  onChange: (draft: SettingsDraft) => void
  layout?: 'columns' | 'stacked'
  /** Hide switches and placeholder buttons (no `edit` permission). Wrap in a disabled fieldset to lock the fields. */
  readOnly?: boolean
}) {
  const tx = useCommentAutomationT()
  const usesAi = (draft.public_reply_enabled && draft.public_reply_mode === 'ai') || (draft.dm_enabled && draft.dm_mode === 'ai')
  const aiInstructionsId = `${idPrefix}-ai-instructions`

  function set<K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) {
    onChange({ ...draft, [key]: value })
  }

  return (
    <div className="space-y-[18px]">
      <div className={cn('grid gap-[18px]', layout === 'columns' && 'md:grid-cols-2')}>
        <ChannelSettings
          id={`${idPrefix}-public`}
          icon={<PublicReplyIcon />}
          title={tx('settings.public_title', 'Public reply')}
          description={tx('settings.public_description', 'Visible reply under the comment')}
          enabled={draft.public_reply_enabled}
          mode={draft.public_reply_mode}
          template={draft.public_reply_template}
          templatePlaceholder={tx('settings.public_placeholder', 'Thanks, {username}! We sent you the details in DM.')}
          onEnabledChange={(value) => set('public_reply_enabled', value)}
          onModeChange={(value) => set('public_reply_mode', value)}
          onTemplateChange={(value) => set('public_reply_template', value)}
          readOnly={readOnly}
        />
        <ChannelSettings
          id={`${idPrefix}-dm`}
          icon={<DirectMessageIcon />}
          title={tx('settings.dm_title', 'Direct message')}
          description={tx('settings.dm_description', 'First private message to the comment author')}
          enabled={draft.dm_enabled}
          mode={draft.dm_mode}
          template={draft.dm_template}
          templatePlaceholder={tx('settings.dm_placeholder', 'Hi {username}! Would you like more details about {post_caption}?')}
          onEnabledChange={(value) => set('dm_enabled', value)}
          onModeChange={(value) => set('dm_mode', value)}
          onTemplateChange={(value) => set('dm_template', value)}
          readOnly={readOnly}
        />
      </div>

      <div className="rounded-[18px] bg-[var(--accent-soft)] p-4">
        <Label htmlFor={aiInstructionsId} className="text-[13px] font-semibold text-[var(--foreground)]">
          {tx('settings.ai_instructions', 'AI instructions')}
        </Label>
        <Textarea
          id={aiInstructionsId}
          value={draft.ai_instructions}
          onChange={(event) => set('ai_instructions', event.target.value)}
          placeholder={tx('settings.ai_instructions_placeholder', 'Briefly describe the service in this post and invite them to reply.')}
          className="mt-2 min-h-[60px] bg-[var(--surface)] text-[13px]"
        />
        <p className="mt-2 text-[12.5px] text-[var(--muted)]">
          {usesAi
            ? tx('settings.ai_instructions_hint', 'Extra guidance for replies written in AI mode.')
            : tx('settings.ai_instructions_unused', 'Used only when a channel is in AI mode.')}
        </p>
      </div>
    </div>
  )
}
