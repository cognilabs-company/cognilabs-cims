import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowClockwiseIcon, LinkSimpleIcon, LockSimpleIcon, PlusIcon, TrayIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import {
  REGISTRATION_STATUSES,
  registrationsService,
  type RegistrationForm,
  type RegistrationStatus,
} from '../../../shared/api/services/registrations.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { cn } from '../../../shared/lib/cn'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { HeaderActions } from '../../../widgets/navigation/HeaderActions'
import { useAuth } from '../../auth/hooks/useAuth'
import { ApplicationsView } from '../components/ApplicationsView'
import { LinkEditor, type EditorTarget } from '../components/LinkEditor'
import { LinksView } from '../components/LinksView'
import { errorStatus, serverMessage } from '../lib/errors'
import { publicUrl } from '../lib/fields'

type Tab = 'links' | 'applications'

const pill = 'min-h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--elev-pill)] hover:bg-[var(--input-surface)]'

/**
 * /registrations — registration links (forms) the CEO shares with candidates, and the applications
 * they send. Module `registrations`: view = see, create = new link, edit = edit link + approve / reject,
 * delete = delete link.
 */
export function RegistrationsPage() {
  const { t } = useLocale()
  const { can } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const canView = can('registrations', 'view')
  const canCreate = can('registrations', 'create')
  const canEdit = can('registrations', 'edit')
  const canDelete = can('registrations', 'delete')

  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'applications' ? 'applications' : 'links'
  const formFilter = params.get('form') || null
  const rawStatus = params.get('status')
  const statusFilter = REGISTRATION_STATUSES.find((status) => status === rawStatus) ?? null
  const selectedId = params.get('submission') || null

  const [forms, setForms] = useState<RegistrationForm[] | null>(null)
  const [formsFailed, setFormsFailed] = useState(false)
  const [formsVersion, setFormsVersion] = useState(0)
  const [listToken, setListToken] = useState(0)
  const [editor, setEditor] = useState<{ target: EditorTarget; id: number } | null>(null)
  const [pendingToggles, setPendingToggles] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    if (!canView) return
    let alive = true
    registrationsService.listForms()
      .then((list) => {
        if (!alive) return
        setForms(list)
        setFormsFailed(false)
      })
      .catch(() => { if (alive) setFormsFailed(true) })
    return () => { alive = false }
  }, [canView, formsVersion])

  const reloadForms = useCallback(() => setFormsVersion((value) => value + 1), [])

  const updateParams = useCallback((patch: Record<string, string | null>) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    })
  }, [setParams])

  function openApplications(formId: string, status: RegistrationStatus | null) {
    updateParams({ tab: 'applications', form: formId, status, submission: null })
  }

  async function toggleActive(form: RegistrationForm, active: boolean) {
    if (!canEdit) return
    setPendingToggles((current) => new Set(current).add(form.id))
    setForms((list) => list?.map((item) => (item.id === form.id ? { ...item, is_active: active } : item)) ?? list)
    try {
      await registrationsService.updateForm(form.id, { is_active: active })
      showToast({ title: active ? t('registrations.links.activated', 'The link accepts applications again') : t('registrations.links.deactivated', 'The link is closed for new applications'), tone: 'success' })
    } catch (error) {
      setForms((list) => list?.map((item) => (item.id === form.id ? { ...item, is_active: form.is_active } : item)) ?? list)
      showToast({ title: t('registrations.links.toggle_failed', 'Could not change the link'), description: serverMessage(error) || undefined, tone: 'error' })
    } finally {
      setPendingToggles((current) => {
        const next = new Set(current)
        next.delete(form.id)
        return next
      })
    }
  }

  async function remove(form: RegistrationForm) {
    if (!canDelete) return
    const used = form.counts.total > 0
    const ok = await confirm({
      title: t('registrations.delete.title', 'Delete “{{title}}”?', { title: form.title }),
      description: used
        ? t('registrations.delete.text_used', 'It has {{count}} applications, so it will be closed, not deleted. The applications stay.', { count: form.counts.total })
        : t('registrations.delete.text', 'The link and its form are deleted. This cannot be undone.'),
      confirmLabel: used ? t('registrations.delete.confirm_used', 'Close the link') : t('registrations.delete.confirm', 'Delete'),
      cancelLabel: t('registrations.common.cancel', 'Cancel'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      let outcome = await registrationsService.removeForm(form.id)
      // The backend answers 204 either way — whether the form is still listed tells what happened.
      const list = await registrationsService.listForms().catch(() => null)
      if (outcome === 'unknown') outcome = list ? (list.some((item) => item.id === form.id) ? 'deactivated' : 'deleted') : used ? 'deactivated' : 'deleted'
      if (list) setForms(list)
      else reloadForms()
      showToast(
        outcome === 'deactivated'
          ? { title: t('registrations.delete.deactivated', 'Link closed instead of deleted'), description: t('registrations.delete.deactivated_text', 'It already has applications, so it was deactivated and the applications were kept.'), tone: 'info' }
          : { title: t('registrations.delete.deleted', 'Link deleted'), tone: 'success' },
      )
    } catch (error) {
      if (errorStatus(error) === 404) {
        setForms((list) => list?.filter((item) => item.id !== form.id) ?? list)
        showToast({ title: t('registrations.delete.already', 'This link was already deleted'), tone: 'info' })
        return
      }
      showToast({ title: t('registrations.delete.failed', 'Could not delete the link'), description: serverMessage(error) || undefined, tone: 'error' })
    }
  }

  function saved(form: RegistrationForm, created: boolean) {
    setEditor(null)
    showToast(created
      ? { title: t('registrations.editor.created', 'Link created'), description: form.slug ? publicUrl(form.slug) : undefined, tone: 'success' }
      : { title: t('registrations.editor.saved', 'Changes saved'), tone: 'success' })
    setForms((list) => {
      if (!list) return list
      return created ? [form, ...list.filter((item) => item.id !== form.id)] : list.map((item) => (item.id === form.id ? { ...item, ...form, counts: item.counts } : item))
    })
    reloadForms()
  }

  const closeEditor = useCallback(() => setEditor(null), [])
  const pendingTotal = forms?.reduce((sum, form) => sum + form.counts.pending, 0) ?? 0

  if (!canView) {
    return (
      <section>
        <h1 className="sr-only">{t('registrations.page.title', 'Registrations')}</h1>
        <div className="grid place-items-center rounded-[18px] border border-dashed border-[var(--border-hover)] bg-[var(--card)] px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-[var(--muted-surface)] text-[var(--muted-strong)]"><LockSimpleIcon size={26} weight="duotone" /></span>
          <p className="mt-4 text-[16px] font-bold text-[var(--foreground)]">{t('registrations.page.no_access', 'No access to registrations')}</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">{t('registrations.page.no_access_text', 'Ask the CEO to grant the “Registrations” module.')}</p>
        </div>
      </section>
    )
  }

  const tabs: Array<{ key: Tab; label: string; icon: typeof LinkSimpleIcon; badge: number | null; tone: string }> = [
    { key: 'links', label: t('registrations.tabs.links', 'Links'), icon: LinkSimpleIcon, badge: forms?.length ?? null, tone: '' },
    { key: 'applications', label: t('registrations.tabs.applications', 'Applications'), icon: TrayIcon, badge: pendingTotal || null, tone: 'pending' },
  ]

  return (
    <section className="flex flex-col gap-4">
      <h1 className="sr-only">{t('registrations.page.title', 'Registrations')}</h1>
      <HeaderActions>
        <Button
          variant="secondary"
          onClick={() => { reloadForms(); setListToken((value) => value + 1) }}
          className={cn(pill, 'w-11 px-0')}
          aria-label={t('registrations.common.refresh', 'Refresh')}
          title={t('registrations.common.refresh', 'Refresh')}
        >
          <ArrowClockwiseIcon size={17} />
        </Button>
        {canCreate ? (
          <Button onClick={() => setEditor({ target: { kind: 'create' }, id: Date.now() })} leftIcon={<PlusIcon size={16} weight="bold" />} className="min-h-11 rounded-full px-5">
            {t('registrations.links.new', 'New link')}
          </Button>
        ) : null}
      </HeaderActions>

      <div role="tablist" aria-label={t('registrations.page.title', 'Registrations')} className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-[14px] bg-[var(--surface)] p-1 ring-1 ring-[var(--border)]">
        {tabs.map(({ key, label, icon: Icon, badge, tone }) => {
          const selected = tab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => updateParams({ tab: key === 'links' ? null : key, submission: null })}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
                selected ? 'bg-[var(--primary)] text-white shadow-[var(--elev-nav)]' : 'text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]',
              )}
            >
              <Icon size={16} weight={selected ? 'fill' : 'regular'} />
              {label}
              {badge !== null ? (
                <span className={cn(
                  'rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums',
                  selected ? 'bg-white/20 text-white' : tone === 'pending' ? 'bg-[var(--warning-dim)] text-[var(--warning-text)]' : 'bg-[var(--muted-surface)] text-[var(--muted)]',
                )}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {tab === 'links' ? (
        <LinksView
          forms={forms}
          failed={formsFailed}
          onRetry={() => { setFormsFailed(false); reloadForms() }}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          onCreate={() => setEditor({ target: { kind: 'create' }, id: Date.now() })}
          onEdit={(form) => setEditor({ target: { kind: 'edit', form }, id: Date.now() })}
          onDelete={(form) => void remove(form)}
          onToggleActive={(form, active) => void toggleActive(form, active)}
          pendingToggles={pendingToggles}
          onOpenApplications={openApplications}
        />
      ) : (
        <ApplicationsView
          forms={forms}
          formId={formFilter}
          status={statusFilter}
          onFiltersChange={({ formId, status }) => updateParams({ form: formId, status })}
          selectedId={selectedId}
          onSelect={(id) => updateParams({ submission: id })}
          canReview={canEdit}
          reloadToken={listToken}
          onReviewed={reloadForms}
        />
      )}

      {editor && (canCreate || canEdit) ? <LinkEditor key={editor.id} target={editor.target} onClose={closeEditor} onSaved={saved} /> : null}
    </section>
  )
}
