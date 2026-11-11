import { useState } from 'react'
import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  CopyIcon,
  LinkSimpleIcon,
  ListBulletsIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  TrayIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { RegistrationForm, RegistrationStatus } from '../../../shared/api/services/registrations.service'
import { formatShortDate } from '../../../shared/lib/format'
import { cn } from '../../../shared/lib/cn'
import { useToast } from '../../../shared/toast/useToast'
import { ActionsMenu, type ActionsMenuItem } from '../../../shared/ui/actions-menu'
import { Button } from '../../../shared/ui/button'
import { Switch } from '../../../shared/ui/switch'
import { copyText, openInNewTab } from '../lib/clipboard'
import { publicUrl } from '../lib/fields'

type LinksViewProps = {
  forms: RegistrationForm[] | null
  failed: boolean
  onRetry: () => void
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  onCreate: () => void
  onEdit: (form: RegistrationForm) => void
  onDelete: (form: RegistrationForm) => void
  onToggleActive: (form: RegistrationForm, active: boolean) => void
  /** Ids of forms whose active switch is being saved. */
  pendingToggles: ReadonlySet<string>
  onOpenApplications: (formId: string, status: RegistrationStatus | null) => void
}

const COUNTERS: Array<{ status: RegistrationStatus | null; tone: string }> = [
  { status: null, tone: 'text-[var(--foreground)]' },
  { status: 'pending', tone: 'text-[var(--warning-text)]' },
  { status: 'approved', tone: 'text-[var(--success-text)]' },
  { status: 'rejected', tone: 'text-[var(--danger-text)]' },
]

/** Links tab: one card per registration form with its public address and application counters. */
export function LinksView({ forms, failed, onRetry, canCreate, canEdit, canDelete, onCreate, onEdit, onDelete, onToggleActive, pendingToggles, onOpenApplications }: LinksViewProps) {
  const { t, locale } = useLocale()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const shown = (forms ?? []).filter((form) => !needle || [form.title, form.slug, form.description ?? ''].some((value) => value.toLowerCase().includes(needle)))

  async function copy(form: RegistrationForm) {
    const url = publicUrl(form.slug)
    const ok = await copyText(url)
    showToast({ title: ok ? t('registrations.links.copied', 'Link copied') : t('registrations.links.copy_failed', 'Could not copy the link'), description: ok ? url : undefined, tone: ok ? 'success' : 'error' })
  }

  const counterLabel = (status: RegistrationStatus | null) => {
    switch (status) {
      case 'pending': return t('registrations.links.counter_pending', 'Pending')
      case 'approved': return t('registrations.links.counter_approved', 'Approved')
      case 'rejected': return t('registrations.links.counter_rejected', 'Rejected')
      default: return t('registrations.links.counter_total', 'Applications')
    }
  }

  if (failed && !forms) {
    return (
      <div className="grid place-items-center rounded-[18px] border border-dashed border-[var(--border-hover)] bg-[var(--card)] px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-[var(--danger-dim)] text-[var(--danger-text)]"><WarningCircleIcon size={28} weight="duotone" /></span>
        <p className="mt-4 text-[16px] font-bold text-[var(--foreground)]">{t('registrations.links.load_failed', 'Could not load registration links')}</p>
        <p className="mt-1 text-[13px] text-[var(--muted)]">{t('registrations.common.check_connection', 'Check the connection and try again.')}</p>
        <Button className="mt-5" onClick={onRetry} leftIcon={<ArrowClockwiseIcon size={15} weight="bold" />}>{t('registrations.common.retry', 'Try again')}</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {forms && forms.length > 0 ? (
        <label className="relative flex h-11 w-full items-center sm:max-w-[360px]">
          <MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-3.5 text-[var(--muted)]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('registrations.links.search', 'Search links…')}
            aria-label={t('registrations.links.search', 'Search links…')}
            className="control-field h-11 w-full rounded-full pr-4 pl-10 text-[13.5px] placeholder:text-[var(--caption)]"
          />
        </label>
      ) : null}

      {forms === null ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => <span key={index} className="skeleton block h-[232px] rounded-[18px]" />)}
        </div>
      ) : forms.length === 0 ? (
        <div className="grid place-items-center rounded-[18px] border border-dashed border-[var(--border-hover)] bg-[var(--card)] px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-[var(--blue-dim)] text-[var(--primary)]"><LinkSimpleIcon size={28} weight="duotone" /></span>
          <p className="mt-4 text-[17px] font-bold text-[var(--foreground)]">{t('registrations.links.empty_title', 'No registration links yet')}</p>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--muted)]">
            {t('registrations.links.empty_text', 'Create a form, share its link with candidates, and approve each application — the account is created only after your approval.')}
          </p>
          {canCreate ? <Button className="mt-5" onClick={onCreate} leftIcon={<PlusIcon size={15} weight="bold" />}>{t('registrations.links.new', 'New link')}</Button> : null}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-[18px] border border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center text-[13px] text-[var(--muted)]">{t('registrations.common.nothing_found', 'Nothing found')}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((form, index) => {
            const url = publicUrl(form.slug)
            const items: ActionsMenuItem[] = [
              ...(canEdit ? [{ label: t('registrations.links.edit', 'Edit'), icon: <PencilSimpleIcon size={14} />, onSelect: () => onEdit(form) }] : []),
              { label: t('registrations.links.copy_link', 'Copy link'), icon: <CopyIcon size={14} />, onSelect: () => void copy(form) },
              { label: t('registrations.links.open_form', 'Open form'), icon: <ArrowSquareOutIcon size={14} />, onSelect: () => openInNewTab(url) },
              { label: t('registrations.links.view_applications', 'View applications'), icon: <TrayIcon size={14} />, onSelect: () => onOpenApplications(form.id, null) },
              ...(canDelete ? [{ label: t('registrations.links.delete', 'Delete'), icon: <TrashIcon size={14} />, tone: 'danger' as const, onSelect: () => onDelete(form) }] : []),
            ]
            return (
              <li
                key={form.id}
                className="grid-row-in @container flex min-w-0 flex-col rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-4 transition-shadow hover:shadow-[var(--elev-sm)]"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="flex items-start gap-3">
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-[12px]', form.is_active ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'bg-[var(--muted-surface)] text-[var(--muted)]')}>
                    <LinkSimpleIcon size={20} weight="duotone" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      {canEdit ? (
                        <button type="button" onClick={() => onEdit(form)} className="min-w-0 truncate text-left text-[15px] font-semibold text-[var(--foreground)] hover:text-[var(--primary)]" data-i18n-skip="true">
                          {form.title || '—'}
                        </button>
                      ) : (
                        <span className="min-w-0 truncate text-[15px] font-semibold text-[var(--foreground)]" data-i18n-skip="true">{form.title || '—'}</span>
                      )}
                    </div>
                    <span className={cn('mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-medium', form.is_active ? 'text-[var(--success-text)]' : 'text-[var(--muted)]')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', form.is_active ? 'bg-[var(--success-text)]' : 'bg-[var(--muted)]')} />
                      {form.is_active ? t('registrations.links.active', 'Accepting applications') : t('registrations.links.inactive', 'Closed')}
                    </span>
                  </div>
                  <ActionsMenu items={items} label={t('registrations.common.actions', 'Actions')} />
                </div>

                {form.description ? (
                  <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-[1.5] text-[var(--muted-strong)]" data-i18n-skip="true">{form.description}</p>
                ) : null}

                <div className="mt-3 flex min-w-0 items-center gap-0.5 rounded-[11px] bg-[var(--input-surface)] py-0.5 pr-0.5 pl-3">
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--muted-strong)]" title={url} data-i18n-skip="true">/register/{form.slug}</span>
                  <button type="button" onClick={() => void copy(form)} aria-label={t('registrations.links.copy_link', 'Copy link')} title={t('registrations.links.copy_link', 'Copy link')} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]">
                    <CopyIcon size={15} />
                  </button>
                  <button type="button" onClick={() => openInNewTab(url)} aria-label={t('registrations.links.open_form', 'Open form')} title={t('registrations.links.open_form', 'Open form')} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]">
                    <ArrowSquareOutIcon size={15} />
                  </button>
                </div>

                <div className="mt-3 mb-3 grid grid-cols-2 gap-1.5 @[420px]:grid-cols-4">
                  {COUNTERS.map(({ status, tone }) => {
                    const value = status ? form.counts[status] : form.counts.total
                    return (
                      <button
                        key={status ?? 'total'}
                        type="button"
                        onClick={() => onOpenApplications(form.id, status)}
                        className="flex min-w-0 flex-col items-start rounded-[11px] border border-[var(--border-subtle)] px-2.5 py-2 text-left transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--input-surface)]"
                      >
                        <span className={cn('text-[18px] leading-6 font-bold tabular-nums', value ? tone : 'text-[var(--caption)]')}>{value}</span>
                        <span className="w-full truncate text-[11px] text-[var(--muted)]">{counterLabel(status)}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[11.5px] text-[var(--muted)]">
                    <ListBulletsIcon size={13} className="shrink-0" />
                    {t('registrations.links.field_count', '{{count}} fields', { count: form.field_count })}
                    {form.updated_at ? <> · {formatShortDate(form.updated_at, locale)}</> : null}
                  </span>
                  {canEdit ? (
                    <Switch
                      checked={form.is_active}
                      disabled={pendingToggles.has(form.id)}
                      onChange={(checked) => onToggleActive(form, checked)}
                      tone="emerald"
                      size="sm"
                      label={t('registrations.editor.active', 'Accepting applications')}
                    />
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
