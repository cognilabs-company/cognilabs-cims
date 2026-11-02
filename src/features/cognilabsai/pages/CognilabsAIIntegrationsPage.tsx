import { useState } from 'react'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useToast } from '../../../shared/toast/useToast'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { LoadingStateBlock, ErrorStateBlock } from '../../../shared/ui/state-block'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { IconButton } from '../../../shared/ui/icon-button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { PageHeader } from '../../../shared/ui/page-header'
import { Tabs, type TabItem } from '../../../shared/ui/tabs'
import { Textarea } from '../../../shared/ui/textarea'
import { Switch } from '../../../shared/ui/switch'
import {
  cognilabsaiService,
  type IntegrationConfigPayload,
} from '../../../shared/api/services/cognilabsai.service'

type FieldConfig = {
  key: keyof IntegrationConfigPayload
  label: string
  placeholder?: string
  type?: 'text' | 'password' | 'textarea'
  hint?: string
  required?: boolean
}

type Section = {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  fields: FieldConfig[]
}

type FollowUpChannelState = {
  enabled: boolean
  delay_minutes: string
  message: string
}

type DefaultFollowUpStep = {
  enabled: boolean
  delay_minutes: string
  message: string
}

const emptyDefaultStep: DefaultFollowUpStep = { enabled: false, delay_minutes: '', message: '' }

const sections: Section[] = [
  {
    id: 'openai',
    title: 'OpenAI',
    description: '',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.001 14.5A4.5 4.5 0 0 1 2.34 7.896zm16.597 3.855l-5.843-3.371 2.019-1.168a.076.076 0 0 1 .071 0l4.816 2.782a4.5 4.5 0 0 1-.692 8.115v-5.677a.795.795 0 0 0-.371-.681zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.814-2.784a4.5 4.5 0 0 1 6.678 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
      </svg>
    ),
    fields: [
      { key: 'openai_api_key', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
      { key: 'openai_model', label: 'Model', placeholder: 'gpt-4o', hint: 'e.g. gpt-4o, gpt-4-turbo, gpt-3.5-turbo' },
      { key: 'openai_base_url', label: 'Base URL', placeholder: 'https://api.openai.com/v1', hint: 'Leave blank to use the default OpenAI endpoint' },
      { key: 'system_prompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant...' },
    ],
  },
  {
    id: 'instagram',
    title: 'Instagram',
    description: 'Connect your Business account for messaging',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
    fields: [
      { key: 'instagram_access_token', label: 'Access Token', type: 'password', required: true },
      { key: 'instagram_business_id', label: 'Business ID', required: true },
      { key: 'instagram_verify_token', label: 'Verify Token', type: 'password', hint: 'Secret token used during webhook verification handshake' },
    ],
  },
  {
    id: 'telegram',
    title: 'Telegram',
    description: 'Operate Telegram chats as a human agent',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.382.713 4.6 1.938 6.458L.083 23.745a.5.5 0 0 0 .632.632l5.287-1.855A11.946 11.946 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.894 16.419c-.246.694-1.452 1.329-2.01 1.412-.51.074-1.157.106-1.866-.116-.43-.135-.982-.315-1.685-.617-2.965-1.273-4.9-4.256-5.048-4.454-.147-.2-1.21-1.608-1.21-3.068 0-1.46.768-2.175 1.04-2.472.27-.297.59-.372.787-.372s.394.004.566.01c.18.009.424-.07.664.505.246.59.836 2.042.908 2.19.073.147.122.32.024.516-.098.196-.147.317-.294.49-.147.172-.309.384-.44.515-.147.147-.3.308-.13.605.172.297.764 1.26 1.64 2.04 1.127 1.003 2.077 1.314 2.374 1.46.297.147.47.123.64-.074.172-.196.736-.86 1.03-.117.295.246 1.09.516 1.29.73.25.254.3.4.3.8 0 .392.147 1.032-.146 1.73z" />
      </svg>
    ),
    fields: [
      { key: 'telegram_api_id', label: 'API ID', required: true },
      { key: 'telegram_api_hash', label: 'API Hash', type: 'password', required: true },
      { key: 'telegram_session', label: 'Session String', type: 'password', hint: 'Telethon session string for your operator account' },
      { key: 'frontend_base_url', label: 'Frontend Base URL', hint: 'Lead notify kanalidagi inline button uchun frontend public URL' },
    ],
  },
  {
    id: 'websocket',
    title: 'WebSocket',
    description: 'Real-time chat stream API key',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    fields: [
      { key: 'websocket_api_key', label: 'WebSocket API Key', type: 'password', hint: 'Used by the frontend to authenticate the real-time WebSocket connection' },
    ],
  },
  {
    id: 'follow-up',
    title: 'Follow-up',
    description: 'Automatic messages after user delay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    fields: [],
  },
]

const SECTION_TABS: TabItem<string>[] = sections.map((section) => ({
  value: section.id,
  label: section.title,
}))

const TELEGRAM_TABS: TabItem<'telegram' | 'lead-bot'>[] = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'lead-bot', label: 'Lead Bot' },
]

const TELEGRAM_FIELDS: FieldConfig[] = sections.find((s) => s.id === 'telegram')!.fields

const LEAD_BOT_FIELDS: FieldConfig[] = [
  { key: 'cognilabs_telegram_token', label: 'Bot Token', type: 'password' },
  { key: 'cognilabs_channel_id', label: 'Channel ID', placeholder: 'e.g. -1001234567890' },
]

const emptyForm: IntegrationConfigPayload = {
  openai_api_key: null,
  openai_model: null,
  openai_base_url: null,
  system_prompt: null,
  instagram_access_token: null,
  instagram_business_id: null,
  instagram_verify_token: null,
  telegram_api_id: null,
  telegram_api_hash: null,
  telegram_session: null,
  websocket_api_key: null,
  frontend_base_url: null,
  cognilabs_telegram_token: null,
  cognilabs_channel_id: null,
}

const emptyFollowUp: Record<'instagram' | 'telegram', FollowUpChannelState> = {
  instagram: { enabled: false, delay_minutes: '', message: '' },
  telegram: { enabled: false, delay_minutes: '', message: '' },
}

function fieldValue(form: IntegrationConfigPayload, key: keyof IntegrationConfigPayload): string {
  const value = form[key]
  return value == null ? '' : String(value)
}

function hasValue(form: IntegrationConfigPayload, sectionFields: FieldConfig[]) {
  return sectionFields.some((f) => Boolean(form[f.key]))
}

function RevealButton({ revealed, onClick }: { revealed: boolean; onClick: () => void }) {
  return (
    <IconButton
      size="lg"
      label="Toggle visibility"
      onClick={onClick}
      className="bg-[var(--input-surface)] hover:bg-[var(--input-surface-hover)]"
    >
      {revealed ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </IconButton>
  )
}

function FieldHint({ hint }: { hint: string }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-[var(--muted)]">
      <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--caption)]">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      {hint}
    </p>
  )
}

type IntegrationFieldProps = {
  field: FieldConfig
  value: string
  revealed: boolean
  onChange: (value: string) => void
  onToggleReveal: () => void
}

function IntegrationField({ field, value, revealed, onChange, onToggleReveal }: IntegrationFieldProps) {
  const isSecret = field.type === 'password'
  const hasContent = Boolean(value)

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Label className="font-semibold text-[var(--foreground)]">
          {field.label}
        </Label>
        {field.required ? (
          <Badge variant="blue" size="sm">
            Required
          </Badge>
        ) : null}
        {hasContent && !isSecret ? (
          <Badge variant="success" size="sm">
            Set
          </Badge>
        ) : hasContent && isSecret ? (
          <Badge variant="success" size="sm">
            Configured
          </Badge>
        ) : null}
      </div>

      {field.type === 'textarea' ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={8}
          className="resize-y"
        />
      ) : isSecret ? (
        <div className="flex gap-2">
          <Input
            type={revealed ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? '••••••••••••••••'}
            className="flex-1 font-mono"
          />
          <RevealButton revealed={revealed} onClick={onToggleReveal} />
        </div>
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="font-mono"
        />
      )}

      {field.hint ? <FieldHint hint={field.hint} /> : null}
    </div>
  )
}

export function CognilabsAIIntegrationsPage() {
  const { showToast } = useToast()
  const [form, setForm] = useState<IntegrationConfigPayload>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeSection, setActiveSection] = useState(sections[0].id)
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [telegramTab, setTelegramTab] = useState<'telegram' | 'lead-bot'>('telegram')
  const [followUp, setFollowUp] = useState(emptyFollowUp)
  const [instagramDefaultSteps, setInstagramDefaultSteps] = useState<[DefaultFollowUpStep, DefaultFollowUpStep, DefaultFollowUpStep]>([
    { ...emptyDefaultStep },
    { ...emptyDefaultStep },
    { ...emptyDefaultStep },
  ])

  const query = useAsyncData(() => cognilabsaiService.getIntegrations(), [], {
    onSuccess: (data) => {
      setForm({
        openai_api_key: data.openai_api_key ?? null,
        openai_model: data.openai_model ?? null,
        openai_base_url: data.openai_base_url ?? null,
        system_prompt: data.system_prompt ?? null,
        instagram_access_token: data.instagram_access_token ?? null,
        instagram_business_id: data.instagram_business_id ?? null,
        instagram_verify_token: data.instagram_verify_token ?? null,
        telegram_api_id: data.telegram_api_id ?? null,
        telegram_api_hash: data.telegram_api_hash ?? null,
        telegram_session: data.telegram_session ?? null,
        websocket_api_key: data.websocket_api_key ?? null,
        frontend_base_url: data.frontend_base_url ?? null,
        cognilabs_telegram_token: data.cognilabs_telegram_token ?? null,
        cognilabs_channel_id: data.cognilabs_channel_id ?? null,
      })
      setFollowUp({
        instagram: {
          enabled: Boolean(data.instagram_followup_enabled),
          delay_minutes: data.instagram_followup_delay_minutes != null ? String(data.instagram_followup_delay_minutes) : '',
          message: data.instagram_followup_message ?? '',
        },
        telegram: {
          enabled: Boolean(data.telegram_followup_enabled),
          delay_minutes: data.telegram_followup_delay_minutes != null ? String(data.telegram_followup_delay_minutes) : '',
          message: data.telegram_followup_message ?? '',
        },
      })
      setInstagramDefaultSteps([
        {
          enabled: Boolean(data.instagram_default_followup_step1_message || data.instagram_default_followup_step1_delay_minutes),
          delay_minutes: data.instagram_default_followup_step1_delay_minutes != null ? String(data.instagram_default_followup_step1_delay_minutes) : '',
          message: data.instagram_default_followup_step1_message ?? '',
        },
        {
          enabled: Boolean(data.instagram_default_followup_step2_message || data.instagram_default_followup_step2_delay_minutes),
          delay_minutes: data.instagram_default_followup_step2_delay_minutes != null ? String(data.instagram_default_followup_step2_delay_minutes) : '',
          message: data.instagram_default_followup_step2_message ?? '',
        },
        {
          enabled: Boolean(data.instagram_default_followup_step3_message || data.instagram_default_followup_step3_delay_minutes),
          delay_minutes: data.instagram_default_followup_step3_delay_minutes != null ? String(data.instagram_default_followup_step3_delay_minutes) : '',
          message: data.instagram_default_followup_step3_message ?? '',
        },
      ])
    },
  })

  function updateField(key: keyof IntegrationConfigPayload, value: string) {
    setForm((prev) => ({ ...prev, [key]: value || null }))
  }

  function toggleReveal(key: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      await cognilabsaiService.updateIntegrations({
        ...form,
        instagram_followup_enabled: followUp.instagram.enabled,
        instagram_followup_delay_minutes: followUp.instagram.enabled && followUp.instagram.delay_minutes.trim()
          ? Number(followUp.instagram.delay_minutes)
          : null,
        instagram_followup_message: followUp.instagram.enabled ? followUp.instagram.message.trim() || null : null,
        telegram_followup_enabled: followUp.telegram.enabled,
        telegram_followup_delay_minutes: followUp.telegram.enabled && followUp.telegram.delay_minutes.trim()
          ? Number(followUp.telegram.delay_minutes)
          : null,
        telegram_followup_message: followUp.telegram.enabled ? followUp.telegram.message.trim() || null : null,
        instagram_default_followup_step1_delay_minutes: instagramDefaultSteps[0].enabled && instagramDefaultSteps[0].delay_minutes.trim() ? Number(instagramDefaultSteps[0].delay_minutes) : null,
        instagram_default_followup_step1_message: instagramDefaultSteps[0].enabled ? instagramDefaultSteps[0].message.trim() || null : null,
        instagram_default_followup_step2_delay_minutes: instagramDefaultSteps[1].enabled && instagramDefaultSteps[1].delay_minutes.trim() ? Number(instagramDefaultSteps[1].delay_minutes) : null,
        instagram_default_followup_step2_message: instagramDefaultSteps[1].enabled ? instagramDefaultSteps[1].message.trim() || null : null,
        instagram_default_followup_step3_delay_minutes: instagramDefaultSteps[2].enabled && instagramDefaultSteps[2].delay_minutes.trim() ? Number(instagramDefaultSteps[2].delay_minutes) : null,
        instagram_default_followup_step3_message: instagramDefaultSteps[2].enabled ? instagramDefaultSteps[2].message.trim() || null : null,
      })
      setSaveSuccess(true)
      showToast({ title: 'Integrations saved', tone: 'success' })
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      showToast({ title: 'Save failed', description: getApiErrorMessage(err), tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  function updateDefaultStep(index: 0 | 1 | 2, key: keyof DefaultFollowUpStep, value: string | boolean) {
    setInstagramDefaultSteps((prev) => {
      const next = [...prev] as [DefaultFollowUpStep, DefaultFollowUpStep, DefaultFollowUpStep]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  function updateFollowUpField(channel: 'instagram' | 'telegram', key: keyof FollowUpChannelState, value: string | boolean) {
    setFollowUp((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [key]: value,
      },
    }))
  }

  if (query.isLoading) return <LoadingStateBlock eyebrow="Integrations" title="Loading integration settings..." />
  if (query.isError) {
    return (
      <ErrorStateBlock
        eyebrow="Integrations"
        title="Failed to load integrations"
        description={getApiErrorMessage(query.error)}
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    )
  }

  const currentSection = sections.find((s) => s.id === activeSection) ?? sections[0]

  return (
    <div className="flex h-full min-h-0 flex-col gap-[18px]">
      {/* Page header */}
      <PageHeader
        eyebrow="CognilabsAI"
        title="Integrations"
        className="shrink-0"
        actions={
          <Button
            onClick={() => void handleSave()}
            disabled={isSaving}
            loading={isSaving}
            variant={saveSuccess ? 'success' : 'primary'}
            leftIcon={
              saveSuccess ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              )
            }
          >
            {saveSuccess ? 'Saved' : isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        }
      />

      {/* Two-column layout */}
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] md:flex-row">
        {/* Sidebar */}
        <div className="hidden w-60 shrink-0 flex-col gap-[18px] md:flex">
          <Card noPadding className="p-2.5">
            <nav className="flex flex-col gap-1">
              {sections.map((section) => {
                const isActive = activeSection === section.id
                const filled = hasValue(form, section.fields)
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors duration-150',
                      isActive
                        ? 'bg-[var(--blue-dim)]'
                        : 'hover:bg-[var(--accent-soft)]',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-[11px] transition-colors',
                        isActive
                          ? 'bg-[var(--blue-soft)] text-[var(--blue-text)]'
                          : 'bg-[var(--muted-surface)] text-[var(--muted)] group-hover:text-[var(--foreground)]',
                      )}
                    >
                      {section.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-semibold tracking-[-0.01em]', isActive ? 'text-[var(--blue-text)]' : 'text-[var(--foreground)]')}>{section.title}</p>
                    </div>
                    {filled ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--success-text)]" title="Configured" />
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--border-hover)]" />
                    )}
                  </button>
                )
              })}
            </nav>
          </Card>

          <div className="mt-auto rounded-[24px] bg-[var(--card)] p-[22px]">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">Need help?</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">Configure each service to enable the corresponding channel.</p>
          </div>
        </div>

        {/* Mobile section tabs */}
        <div className="overflow-x-auto pb-1 md:hidden">
          <Tabs items={SECTION_TABS} value={activeSection} onChange={setActiveSection} className="bg-[var(--card)]" />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 min-h-0 flex flex-col">
          <Card noPadding className="flex flex-col overflow-hidden flex-1 min-h-0">
            {/* Section header */}
            <div className="flex items-center gap-3.5 px-[22px] pt-[22px] pb-[18px] shrink-0">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[var(--blue-dim)] text-[var(--blue-text)]">
                {currentSection.icon}
              </div>
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{currentSection.title}</h2>
                {currentSection.description ? (
                  <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{currentSection.description}</p>
                ) : null}
              </div>
            </div>

            {/* Fields */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-[18px] px-[22px] pb-[22px]">
              {activeSection === 'follow-up' ? (
                <div className="flex flex-col gap-[18px]">
                  <div className="grid gap-[18px] lg:grid-cols-2">
                  {(['instagram', 'telegram'] as const).map((channel) => {
                    const channelState = followUp[channel]
                    const label = channel === 'instagram' ? 'Instagram' : 'Telegram'

                    return (
                      <div key={channel} className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{label} follow-up</h3>
                            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">One-time static reminder message.</p>
                          </div>
                          <Switch
                            checked={channelState.enabled}
                            onChange={(v) => updateFollowUpField(channel, 'enabled', v)}
                            label={`${label} follow-up enabled`}
                          />
                        </div>

                        <div className={cn('mt-[18px] space-y-3.5 transition-opacity duration-200', !channelState.enabled && 'opacity-40 pointer-events-none')}>
                          <div>
                            <Label className="mb-2 block">
                              Delay (minutes)
                            </Label>
                            <Input
                              type="number"
                              value={channelState.delay_minutes}
                              onChange={(e) => updateFollowUpField(channel, 'delay_minutes', e.target.value)}
                              placeholder="e.g. 1440"
                              className="h-9 min-h-9 w-24 rounded-[11px] bg-[var(--surface)]"
                            />
                          </div>
                          <div>
                            <Label className="mb-2 block">
                              Follow-up message
                            </Label>
                            <Textarea
                              value={channelState.message}
                              onChange={(e) => updateFollowUpField(channel, 'message', e.target.value)}
                              placeholder="Hello! Let us know if you have any questions..."
                              className="min-h-[100px] bg-[var(--surface)]"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  </div>

                  <div>
                    <p className="mb-3.5 text-[13px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Instagram Default Follow-up Sequence</p>
                    <div className="grid gap-[18px] lg:grid-cols-3">
                      {([0, 1, 2] as const).map((i) => (
                        <div key={i} className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
                          <div className="mb-[18px] flex items-center justify-between gap-2">
                            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">Step {i + 1}</p>
                            <Switch
                              checked={instagramDefaultSteps[i].enabled}
                              onChange={(v) => updateDefaultStep(i, 'enabled', v)}
                              label={`Step ${i + 1} enabled`}
                            />
                          </div>
                          <div className={cn('space-y-3.5 transition-opacity duration-200', !instagramDefaultSteps[i].enabled && 'opacity-40 pointer-events-none')}>
                            <div>
                              <Label className="mb-2 block">Delay (minutes)</Label>
                              <Input
                                type="number"
                                value={instagramDefaultSteps[i].delay_minutes}
                                onChange={(e) => updateDefaultStep(i, 'delay_minutes', e.target.value)}
                                placeholder="e.g. 180"
                                className="h-9 min-h-9 w-24 rounded-[11px] bg-[var(--surface)]"
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block">Message</Label>
                              <Textarea
                                value={instagramDefaultSteps[i].message}
                                onChange={(e) => updateDefaultStep(i, 'message', e.target.value)}
                                placeholder="Follow-up message..."
                                className="min-h-[90px] bg-[var(--surface)]"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : activeSection === 'telegram' ? (
                <div className="flex flex-col gap-[18px]">
                  {/* Tab switcher */}
                  <Tabs items={TELEGRAM_TABS} value={telegramTab} onChange={setTelegramTab} className="self-start" />

                  {/* Tab content */}
                  <div className="space-y-[18px]">
                    {(telegramTab === 'telegram' ? TELEGRAM_FIELDS : LEAD_BOT_FIELDS).map((field) => (
                      <IntegrationField
                        key={field.key}
                        field={field}
                        value={fieldValue(form, field.key)}
                        revealed={revealedKeys.has(field.key)}
                        onChange={(next) => updateField(field.key, next)}
                        onToggleReveal={() => toggleReveal(field.key)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                currentSection.fields.map((field) => (
                  <IntegrationField
                    key={field.key}
                    field={field}
                    value={fieldValue(form, field.key)}
                    revealed={revealedKeys.has(field.key)}
                    onChange={(next) => updateField(field.key, next)}
                    onToggleReveal={() => toggleReveal(field.key)}
                  />
                ))
              )}
            </div>

            {/* Section footer */}
            <div className="flex items-center justify-between gap-3 bg-[var(--muted-surface)] px-[22px] py-4 shrink-0">
              <p className="text-[12.5px] text-[var(--muted)]">
                {activeSection === 'follow-up'
                  ? `${(Object.values(followUp) as FollowUpChannelState[]).filter(s => s.enabled).length} channels enabled`
                  : activeSection === 'telegram'
                  ? telegramTab === 'telegram'
                    ? `${currentSection.fields.filter((f) => Boolean(fieldValue(form, f.key))).length} of ${currentSection.fields.length} fields configured`
                    : `${[form.cognilabs_telegram_token, form.cognilabs_channel_id].filter(Boolean).length} of 2 fields configured`
                  : `${currentSection.fields.filter((f) => Boolean(fieldValue(form, f.key))).length} of ${currentSection.fields.length} fields configured`
                }
              </p>
              <Button onClick={() => void handleSave()} disabled={isSaving} size="sm">
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
