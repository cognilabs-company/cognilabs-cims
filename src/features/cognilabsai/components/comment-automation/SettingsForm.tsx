import type { ReactNode } from 'react'
import type { CommentAutomationReplyMode } from '../../../../shared/api/services/cognilabsai.service'
import { cn } from '../../../../shared/lib/cn'
import { Label } from '../../../../shared/ui/label'
import { Switch } from '../../../../shared/ui/switch'
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
  className,
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
  className?: string
}) {
  const tx = useCommentAutomationT()

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors',
        enabled ? 'border-[var(--success-border)] bg-[var(--success-dim)]' : 'border-[var(--border)] bg-[var(--muted-surface)]',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[var(--foreground)]">{tx('settings.automation', 'Auto reply')}</p>
        <p className="text-[11px] text-[var(--caption)]">
          {enabled
            ? tx('settings.automation_on', 'On: new comments get replies')
            : tx('settings.automation_off', 'Off: nothing is sent')}
        </p>
      </div>
      <Switch checked={enabled} onChange={onChange} tone="emerald" label={tx('settings.automation', 'Auto reply')} />
    </div>
  )
}

function ModeToggle({ value, onChange }: { value: CommentAutomationReplyMode; onChange: (mode: CommentAutomationReplyMode) => void }) {
  const tx = useCommentAutomationT()

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--muted-surface)] p-0.5">
      {(['ai', 'template'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          className={cn(
            'rounded-md px-3 py-1 text-[11px] font-semibold transition-all',
            value === mode
              ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--foreground)]',
          )}
        >
          {mode === 'ai' ? tx('settings.mode_ai', 'AI') : tx('settings.mode_template', 'Template')}
        </button>
      ))}
    </div>
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
}) {
  const tx = useCommentAutomationT()
  const templateId = `${id}-template`

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-3 transition-colors',
        enabled ? 'border-[var(--border)] bg-[var(--card)]' : 'border-dashed border-[var(--border)] bg-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              enabled ? 'bg-[var(--blue-soft)] text-[var(--blue-text)]' : 'bg-[var(--muted-surface)] text-[var(--muted)]',
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">{title}</p>
            <p className="text-[11px] leading-snug text-[var(--caption)]">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} onChange={onEnabledChange} size="sm" tone="emerald" label={title} />
      </div>

      {enabled && (
        <div className="space-y-2">
          <ModeToggle value={mode} onChange={onModeChange} />
          {mode === 'template' ? (
            <>
              <Label htmlFor={templateId} className="sr-only">{title}</Label>
              <Textarea
                id={templateId}
                value={template}
                onChange={(event) => onTemplateChange(event.target.value)}
                placeholder={templatePlaceholder}
                className="min-h-[76px] text-[13px]"
              />
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-[var(--caption)]">{tx('settings.insert', 'Insert:')}</span>
                {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                  <button
                    key={placeholder}
                    type="button"
                    data-i18n-skip="true"
                    onClick={() => onTemplateChange(`${template}${placeholder}`)}
                    className="rounded-md border border-[var(--border)] bg-[var(--muted-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-strong)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
                  >
                    {placeholder}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--caption)]">{tx('settings.template_hint', 'This exact text is sent; placeholders are filled in automatically.')}</p>
            </>
          ) : (
            <p className="text-[11px] text-[var(--caption)]">{tx('settings.ai_hint', 'AI writes a separate reply for each comment, so the exact text is not guaranteed.')}</p>
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
}: {
  idPrefix: string
  draft: SettingsDraft
  onChange: (draft: SettingsDraft) => void
}) {
  const tx = useCommentAutomationT()
  const usesAi = (draft.public_reply_enabled && draft.public_reply_mode === 'ai') || (draft.dm_enabled && draft.dm_mode === 'ai')
  const aiInstructionsId = `${idPrefix}-ai-instructions`

  function set<K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) {
    onChange({ ...draft, [key]: value })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
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
        />
      </div>

      <div>
        <Label htmlFor={aiInstructionsId} className="text-[12px] font-semibold text-[var(--foreground)]">
          {tx('settings.ai_instructions', 'AI instructions')}
        </Label>
        <Textarea
          id={aiInstructionsId}
          value={draft.ai_instructions}
          onChange={(event) => set('ai_instructions', event.target.value)}
          placeholder={tx('settings.ai_instructions_placeholder', 'Briefly describe the service in this post and invite them to reply.')}
          className="mt-1 min-h-[60px] text-[13px]"
        />
        <p className="mt-1 text-[11px] text-[var(--caption)]">
          {usesAi
            ? tx('settings.ai_instructions_hint', 'Extra guidance for replies written in AI mode.')
            : tx('settings.ai_instructions_unused', 'Used only when a channel is in AI mode.')}
        </p>
      </div>
    </div>
  )
}
