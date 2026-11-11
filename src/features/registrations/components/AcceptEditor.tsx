import { useState } from 'react'
import { CheckIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { Input } from '../../../shared/ui/input'
import { ACCEPT_PRESETS, normalizeAcceptToken } from '../lib/fields'
import type { Translate } from '../lib/labels'

type AcceptEditorProps = {
  id: string
  kind: 'file' | 'image'
  accept: string[]
  onChange: (accept: string[]) => void
}

function presetLabel(t: Translate, id: string) {
  switch (id) {
    case 'pdf': return 'PDF'
    case 'word': return t('registrations.builder.accept_word', 'Word')
    case 'excel': return t('registrations.builder.accept_excel', 'Excel')
    case 'images': return t('registrations.builder.accept_images', 'Images')
    case 'archives': return t('registrations.builder.accept_archives', 'Archives')
    default: return id
  }
}

/** Allowed file types of a file / image field (frontend filtering — `accept`). */
export function AcceptEditor({ id, kind, accept, onChange }: AcceptEditorProps) {
  const { t } = useLocale()
  const [draft, setDraft] = useState('')
  const presets = kind === 'image' ? ACCEPT_PRESETS.filter((preset) => preset.id === 'images') : ACCEPT_PRESETS

  function addTokens(raw: string) {
    const tokens = raw.split(/[\s,;]+/).map(normalizeAcceptToken).filter(Boolean)
    if (!tokens.length) return
    onChange([...new Set([...accept, ...tokens])].slice(0, 50))
    setDraft('')
  }

  function togglePreset(values: string[]) {
    const active = values.every((value) => accept.includes(value))
    onChange(active ? accept.filter((value) => !values.includes(value)) : [...new Set([...accept, ...values])].slice(0, 50))
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('registrations.builder.accept', 'Allowed file types')}</label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const active = preset.values.every((value) => accept.includes(value))
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => togglePreset(preset.values)}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12.5px] font-semibold transition-colors',
                active ? 'border-[var(--primary)] bg-[var(--blue-dim)] text-[var(--blue-text)]' : 'border-[var(--border-hover)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)]',
              )}
            >
              {active ? <CheckIcon size={12} weight="bold" /> : <PlusIcon size={12} weight="bold" />}
              {presetLabel(t, preset.id)}
            </button>
          )
        })}
      </div>
      {accept.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {accept.map((token) => (
            <li key={token} className="inline-flex h-7 items-center gap-1 rounded-[8px] bg-[var(--input-surface)] pr-1 pl-2.5 font-mono text-[12px] text-[var(--foreground)]">
              {token}
              <button type="button" onClick={() => onChange(accept.filter((value) => value !== token))} aria-label={t('registrations.builder.remove_type', 'Remove {{type}}', { type: token })} className="grid h-5 w-5 place-items-center rounded-[6px] text-[var(--muted)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]">
                <XIcon size={11} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addTokens(draft)
            }
          }}
          onBlur={() => addTokens(draft)}
          placeholder={kind === 'image' ? '.heic, image/*' : '.pdf, .docx, image/*'}
          className="min-h-9 py-1 font-mono text-[12.5px]"
        />
      </div>
      <p className="text-[11.5px] leading-[1.45] text-[var(--muted)]">
        {kind === 'image'
          ? t('registrations.builder.accept_hint_image', 'Empty = any image. Applicants see thumbnails of what they pick.')
          : t('registrations.builder.accept_hint_file', 'Empty = any file. Each file up to 25 MB, all files up to 100 MB.')}
      </p>
    </div>
  )
}
