import type { ReactNode } from 'react'
import { AtSign, Bot, Briefcase, CalendarClock, Clock3, Contact, Flag, Loader2, Phone, RotateCcw, Trash2, UserRound, X, type LucideIcon } from 'lucide-react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { cn } from '../../../../shared/lib/cn'
import type { ConversationItem } from '../../../../shared/api/services/cognilabsai.service'
import { CalendarField } from '../../../../shared/ui/calendar-field'
import { SelectField } from '../../../../shared/ui/select-field'
import { Switch } from '../../../../shared/ui/switch'
import { getChannelLabel, getClientName, stageLabel, type FollowUpDraft, type FollowUpMode } from './chatUtils'
import { ChannelGlyph, TgAvatar } from './TgParts'

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-6 rounded-[12px] px-3 py-2 hover:bg-[var(--tg-hover)]">
      <Icon size={22} className="mt-1 shrink-0 text-[var(--tg-secondary)]" />
      <div className="min-w-0">
        <div className="text-[15.5px] leading-[1.35] break-words text-[var(--tg-text)]">{children}</div>
        <div className="text-[13.5px] text-[var(--tg-secondary)]">{label}</div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t-[10px] border-[var(--tg-divider)] px-2 py-2">
      <p className="px-3 pt-1.5 pb-1 text-[14.5px] font-semibold text-[var(--tg-primary)]">{title}</p>
      {children}
    </section>
  )
}

type TgInfoPanelProps = {
  conversation: ConversationItem
  presence: string
  online: boolean
  onClose: () => void
  supportsAi: boolean
  aiPaused: boolean
  aiBusy: boolean
  onToggleAi: () => void
  onRetryAi: () => void
  pauseUntilOpen: boolean
  onPauseUntilOpen: (open: boolean) => void
  pauseUntil: string
  onPauseUntilChange: (value: string) => void
  onPauseUntilConfirm: () => void
  followUp: FollowUpDraft
  onFollowUpChange: (next: FollowUpDraft) => void
  followUpSaving: boolean
  followUpStatus: string
  onFollowUpSave: () => void
  crmCustomerId: number | null
  onOpenCrm: () => void
  /** `edit` permission: AI switch, retry, pause-until and follow-up settings. */
  canEdit: boolean
  /** Omit to hide "Delete chat" (no `delete` permission). */
  onDelete?: () => void
  className?: string
}

/** Right column, like Telegram's profile panel: big avatar, info rows, AI + follow-up settings, actions. */
export function TgInfoPanel(props: TgInfoPanelProps) {
  const { t } = useLocale()
  const { conversation: conv, followUp } = props
  const name = getClientName(conv)
  const stage = conv.ai_stage ? stageLabel(conv.ai_stage, conv.ai_stage_label) : null

  return (
    <aside className={cn('flex min-h-0 flex-col bg-[var(--tg-bg)]', props.className)}>
      <header className="flex h-[56px] shrink-0 items-center gap-4 px-3">
        <button type="button" onClick={props.onClose} aria-label={t('common.close', 'Close')} className="grid h-10 w-10 place-items-center rounded-full text-[var(--tg-secondary)] hover:bg-[var(--tg-hover)]">
          <X size={22} />
        </button>
        <p className="text-[18px] font-semibold text-[var(--tg-text)]">{t('aichat.info', 'Info')}</p>
      </header>

      <div className="tg-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-4 pt-2 pb-4 text-center">
          <TgAvatar url={conv.client_avatar_url} name={name} size={120} online={props.online} />
          <p className="mt-3 text-[20px] leading-tight font-semibold break-words text-[var(--tg-text)]">{name}</p>
          <p data-i18n-skip="true" className={cn('mt-1 text-[14px]', props.online ? 'text-[var(--tg-primary)]' : 'text-[var(--tg-secondary)]')}>{props.presence}</p>
        </div>

        <div className="px-2 pb-2">
          {conv.lead_phone_number ? <Row icon={Phone} label={t('common.phone', 'Phone')}><span className="tabular-nums">{conv.lead_phone_number}</span></Row> : null}
          {conv.client_username ? <Row icon={AtSign} label={t('common.username', 'Username')}>@{conv.client_username.replace(/^@/, '')}</Row> : null}
          <Row icon={UserRound} label={t('aichat.channel', 'Channel')}>
            <span className="inline-flex items-center gap-1.5"><ChannelGlyph channel={conv.channel} className="text-[var(--tg-secondary)]" />{getChannelLabel(conv.channel)}</span>
          </Row>
          {conv.lead_full_name && conv.lead_full_name !== name ? <Row icon={UserRound} label={t('aichat.lead_name', 'Name in the lead')}>{conv.lead_full_name}</Row> : null}
          {conv.lead_business_field ? <Row icon={Briefcase} label={t('aichat.business_field', 'Business field')}>{conv.lead_business_field}</Row> : null}
          {conv.lead_scheduled_time ? <Row icon={CalendarClock} label={t('aichat.scheduled_time', 'Preferred call time')}>{conv.lead_scheduled_time}</Row> : null}
          {stage ? <Row icon={Flag} label={t('aichat.stage', 'AI stage')}>{stage}</Row> : null}
          {conv.last_operator_name ? <Row icon={Contact} label={t('aichat.operator', 'Last operator')}>{conv.last_operator_name}</Row> : null}
        </div>

        {props.supportsAi ? (
          <Section title={t('aichat.ai_section', 'AI assistant')}>
            <label className={cn('flex items-center gap-6 rounded-[12px] px-3 py-2.5 hover:bg-[var(--tg-hover)]', props.canEdit && 'cursor-pointer')}>
              <Bot size={22} className="shrink-0 text-[var(--tg-secondary)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] text-[var(--tg-text)]">{t('aichat.ai_replies', 'AI replies')}</span>
                <span className="block text-[13.5px] text-[var(--tg-secondary)]">{props.aiPaused ? (conv.pause_reason || t('aichat.ai_paused', 'AI paused')) : t('aichat.ai_active', 'AI is answering')}</span>
              </span>
              {!props.canEdit ? null : props.aiBusy ? <Loader2 size={18} className="animate-spin text-[var(--tg-secondary)]" /> : (
                <Switch checked={!props.aiPaused} onChange={() => props.onToggleAi()} label={t('aichat.ai_replies', 'AI replies')} />
              )}
            </label>
            {props.canEdit ? (
              <button type="button" onClick={props.onRetryAi} disabled={props.aiBusy} className="flex w-full items-center gap-6 rounded-[12px] px-3 py-3 text-left text-[15.5px] text-[var(--tg-text)] hover:bg-[var(--tg-hover)] disabled:opacity-50">
                <RotateCcw size={22} className="shrink-0 text-[var(--tg-secondary)]" /> {t('aichat.retry_ai', 'Retry AI reply')}
              </button>
            ) : null}
            {!props.canEdit ? null : props.pauseUntilOpen ? (
              <div className="space-y-2 px-3 py-2">
                <CalendarField mode="datetime" value={props.pauseUntil} onValueChange={props.onPauseUntilChange} aria-label={t('aichat.pause_until', 'Pause AI until…')} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { props.onPauseUntilOpen(false); props.onPauseUntilChange('') }} className="rounded-[8px] px-3 py-1.5 text-[14px] font-medium text-[var(--tg-primary)] hover:bg-[var(--tg-hover)]">{t('common.cancel', 'Cancel')}</button>
                  <button type="button" onClick={props.onPauseUntilConfirm} disabled={!props.pauseUntil || props.aiBusy} className="rounded-[8px] bg-[var(--tg-primary)] px-3 py-1.5 text-[14px] font-medium text-white disabled:opacity-50">{t('common.confirm', 'Confirm')}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => props.onPauseUntilOpen(true)} disabled={props.aiBusy} className="flex w-full items-center gap-6 rounded-[12px] px-3 py-3 text-left text-[15.5px] text-[var(--tg-text)] hover:bg-[var(--tg-hover)] disabled:opacity-50">
                <Clock3 size={22} className="shrink-0 text-[var(--tg-secondary)]" /> {t('aichat.pause_until', 'Pause AI until…')}
              </button>
            )}
          </Section>
        ) : null}

        <Section title={t('aichat.follow_up', 'Follow-up')}>
          <label className={cn('flex items-center gap-6 rounded-[12px] px-3 py-2.5 hover:bg-[var(--tg-hover)]', props.canEdit && 'cursor-pointer')}>
            <CalendarClock size={22} className="shrink-0 text-[var(--tg-secondary)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] text-[var(--tg-text)]">{t('aichat.follow_up_auto', 'Automatic reminder')}</span>
              <span className="block text-[13.5px] text-[var(--tg-secondary)]">{props.followUpStatus}</span>
            </span>
            {props.canEdit ? (
              <Switch checked={followUp.enabled} onChange={(enabled) => props.onFollowUpChange({ ...followUp, enabled })} label={t('aichat.follow_up_auto', 'Automatic reminder')} />
            ) : null}
          </label>
          {props.canEdit && followUp.enabled ? (
            <div className="space-y-2.5 px-3 pt-1 pb-2">
              <SelectField
                value={followUp.mode}
                onValueChange={(mode) => props.onFollowUpChange({ ...followUp, mode: mode as FollowUpMode })}
                options={[{ value: 'global', label: t('aichat.follow_up_global', 'Global settings') }, { value: 'custom', label: t('aichat.follow_up_custom', 'Custom for this chat') }]}
                aria-label={t('aichat.follow_up_mode', 'Mode')}
              />
              {followUp.mode === 'custom' ? (
                <>
                  <label className="flex items-center gap-2 text-[13.5px] text-[var(--tg-secondary)]">
                    <input
                      type="number"
                      min={1}
                      value={followUp.delay_minutes}
                      onChange={(event) => props.onFollowUpChange({ ...followUp, delay_minutes: event.target.value })}
                      placeholder="60"
                      className="control-field h-9 w-24 rounded-[10px] px-3 text-[14px] tabular-nums"
                    />
                    {t('aichat.follow_up_delay', 'minutes after the last message')}
                  </label>
                  <textarea
                    value={followUp.message}
                    onChange={(event) => props.onFollowUpChange({ ...followUp, message: event.target.value })}
                    rows={3}
                    placeholder={t('aichat.follow_up_message_placeholder', 'Reminder text…')}
                    className="control-field w-full resize-none rounded-[10px] px-3 py-2 text-[14px] leading-relaxed"
                  />
                </>
              ) : null}
              <div className="flex justify-end">
                <button type="button" onClick={props.onFollowUpSave} disabled={props.followUpSaving} className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--tg-primary)] px-3.5 py-1.5 text-[14px] font-medium text-white disabled:opacity-50">
                  {props.followUpSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t('common.save', 'Save')}
                </button>
              </div>
            </div>
          ) : null}
        </Section>

        {props.crmCustomerId || props.onDelete ? (
          <Section title={t('aichat.actions', 'Actions')}>
            {props.crmCustomerId ? (
              <button type="button" onClick={props.onOpenCrm} className="flex w-full items-center gap-6 rounded-[12px] px-3 py-3 text-left text-[15.5px] text-[var(--tg-text)] hover:bg-[var(--tg-hover)]">
                <Contact size={22} className="shrink-0 text-[var(--tg-secondary)]" /> {t('aichat.open_crm', 'Open in CRM')}
              </button>
            ) : null}
            {props.onDelete ? (
              <button type="button" onClick={props.onDelete} className="flex w-full items-center gap-6 rounded-[12px] px-3 py-3 text-left text-[15.5px] text-[var(--danger)] hover:bg-[var(--tg-hover)]">
                <Trash2 size={22} className="shrink-0" /> {t('aichat.delete_chat', 'Delete chat')}
              </button>
            ) : null}
          </Section>
        ) : null}
      </div>
    </aside>
  )
}
