import { useEffect, useMemo, useState } from 'react'
import { ArrowClockwiseIcon, ArrowSquareOutIcon, CopyIcon, EyeIcon, GlobeIcon, ListBulletsIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import {
  registrationsService,
  type RegistrationField,
  type RegistrationForm,
} from '../../../shared/api/services/registrations.service'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { cn } from '../../../shared/lib/cn'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Skeleton } from '../../../shared/ui/skeleton'
import { Switch } from '../../../shared/ui/switch'
import { Textarea } from '../../../shared/ui/textarea'
import { copyText, openInNewTab } from '../lib/clipboard'
import { errorStatus, formErrorsFromApi, serverMessage } from '../lib/errors'
import { SLUG_MAX, SLUG_PATTERN, publicUrl, sanitizeSlugInput, slugFromTitle, toDrafts, toPayload, validateDrafts, type DraftField } from '../lib/fields'
import { FieldBuilder } from './FieldBuilder'
import { PreviewForm } from './PreviewForm'
import { SidePanel } from './SidePanel'

export type EditorTarget = { kind: 'create' } | { kind: 'edit'; form: RegistrationForm }

type LinkEditorProps = {
  target: EditorTarget
  onClose: () => void
  onSaved: (form: RegistrationForm, created: boolean) => void
}

const PANEL_WIDTH = 'sm:max-w-[780px]'

/** Create / edit a registration link. Editing loads the full form first (the list may omit fields). */
export function LinkEditor({ target, onClose, onSaved }: LinkEditorProps) {
  if (target.kind === 'create') return <LinkEditorForm initial={null} onClose={onClose} onSaved={onSaved} />
  return <EditLoader key={target.form.id} summary={target.form} onClose={onClose} onSaved={onSaved} />
}

function EditLoader({ summary, onClose, onSaved }: { summary: RegistrationForm; onClose: () => void; onSaved: LinkEditorProps['onSaved'] }) {
  const { t } = useLocale()
  const [state, setState] = useState<{ attempt: number; form?: RegistrationForm; failed?: boolean }>({ attempt: 0 })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    registrationsService.getForm(summary.id)
      .then((form) => { if (alive) setState({ attempt, form: form.id ? form : summary }) })
      .catch(() => { if (alive) setState({ attempt, failed: true }) })
    return () => { alive = false }
  }, [attempt, summary])

  if (state.form) return <LinkEditorForm initial={state.form} onClose={onClose} onSaved={onSaved} />

  const failed = state.failed && state.attempt === attempt
  return (
    <SidePanel open onClose={onClose} title={summary.title || t('registrations.editor.edit_title', 'Edit link')} width={PANEL_WIDTH}>
      {failed ? (
        <div className="grid place-items-center px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[var(--danger-dim)] text-[var(--danger-text)]"><WarningCircleIcon size={24} weight="duotone" /></span>
          <p className="mt-3 text-[15px] font-semibold text-[var(--foreground)]">{t('registrations.editor.load_failed', 'Could not load the link')}</p>
          <Button variant="secondary" className="mt-4" leftIcon={<ArrowClockwiseIcon size={15} />} onClick={() => setAttempt((value) => value + 1)}>
            {t('registrations.common.retry', 'Try again')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-6 py-6" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-[52px] w-full" rounded="lg" />)}
        </div>
      )}
    </SidePanel>
  )
}

type Draft = { title: string; slug: string; description: string; isActive: boolean; fields: DraftField[] }

function snapshotOf(draft: Draft) {
  return JSON.stringify([draft.title.trim(), draft.slug, draft.description.trim(), draft.isActive, toPayload(draft.fields)])
}

type ServerErrors = { title?: string; slug?: string; description?: string; fields: Record<string, string>; message?: string }

function LinkEditorForm({ initial, onClose, onSaved }: { initial: RegistrationForm | null; onClose: () => void; onSaved: LinkEditorProps['onSaved'] }) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const isCreate = initial === null
  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(!isCreate)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [fields, setFields] = useState(() => toDrafts(initial?.fields ?? []))
  const [snapshot] = useState(() => snapshotOf({ title: initial?.title ?? '', slug: initial?.slug ?? '', description: initial?.description ?? '', isActive: initial?.is_active ?? true, fields: toDrafts(initial?.fields ?? []) }))
  const [openUids, setOpenUids] = useState<Set<string>>(() => new Set())
  const [tab, setTab] = useState<'build' | 'preview'>('build')
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [server, setServer] = useState<ServerErrors>({ fields: {} })

  const fieldIssues = useMemo(() => validateDrafts(fields), [fields])
  const titleIssue = !title.trim() ? t('registrations.editor.title_required', 'Enter a title') : null
  const slugIssue = isCreate && slug && !SLUG_PATTERN.test(slug) ? t('registrations.editor.slug_invalid', 'Latin lower-case letters, digits and single hyphens') : null
  const problemCount = Object.keys(fieldIssues).length + (titleIssue ? 1 : 0) + (slugIssue ? 1 : 0)
  const url = publicUrl(slug || slugFromTitle(title) || '…')
  const requiredCount = fields.filter((field) => field.locked || field.required).length
  const previewFields: RegistrationField[] = fields.map((field) => ({ ...field, required: field.locked || field.required }))

  function changeTitle(value: string) {
    setTitle(value)
    setServer((current) => ({ ...current, title: undefined }))
    if (isCreate && !slugEdited) setSlug(slugFromTitle(value))
  }

  function setOpen(uid: string, open: boolean) {
    setOpenUids((current) => {
      const next = new Set(current)
      if (open) next.add(uid)
      else next.delete(uid)
      return next
    })
  }

  function changeFields(next: DraftField[]) {
    setFields(next)
    if (Object.keys(server.fields).length) setServer((current) => ({ ...current, fields: {} }))
  }

  async function requestClose() {
    if (saving) return
    if (snapshotOf({ title, slug, description, isActive, fields }) !== snapshot) {
      const ok = await confirm({
        title: t('registrations.editor.discard_title', 'Discard changes?'),
        description: t('registrations.editor.discard_text', 'What you changed in this link is not saved yet.'),
        confirmLabel: t('registrations.editor.discard', 'Discard'),
        cancelLabel: t('registrations.editor.keep_editing', 'Keep editing'),
        tone: 'danger',
      })
      if (!ok) return
    }
    onClose()
  }

  function revealProblems(uids: string[]) {
    setTab('build')
    if (uids.length) setOpenUids((current) => new Set([...current, ...uids]))
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('[data-editor-problem="true"], [aria-invalid="true"]')
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  async function save() {
    setAttempted(true)
    if (problemCount > 0) {
      revealProblems(Object.keys(fieldIssues))
      return
    }
    setSaving(true)
    setServer({ fields: {} })
    const payloadFields = toPayload(fields)
    try {
      const saved = isCreate
        ? await registrationsService.createForm({
            title: title.trim(),
            slug: slug || null,
            description: description.trim() || null,
            is_active: isActive,
            fields: payloadFields,
          })
        : await registrationsService.updateForm(initial.id, {
            title: title.trim(),
            description: description.trim() || null,
            is_active: isActive,
            fields: payloadFields,
          })
      const fallback: RegistrationForm = {
        id: initial?.id ?? '',
        title: title.trim(),
        slug,
        description: description.trim() || null,
        is_active: isActive,
        fields: previewFields,
        field_count: previewFields.length,
        counts: initial?.counts ?? { total: 0, pending: 0, approved: 0, rejected: 0 },
        created_at: initial?.created_at ?? null,
        updated_at: initial?.updated_at ?? null,
      }
      onSaved(saved.id ? { ...saved, counts: saved.counts.total || !initial ? saved.counts : initial.counts } : fallback, isCreate)
    } catch (error) {
      const status = errorStatus(error)
      const mapped = formErrorsFromApi(error)
      const byUid: Record<string, string> = {}
      for (const [index, message] of Object.entries(mapped.fields)) {
        const uid = fields[Number(index)]?.uid
        if (uid) byUid[uid] = message || t('registrations.editor.field_invalid', 'This field is not valid')
      }
      const next: ServerErrors = { title: mapped.title, slug: mapped.slug, description: mapped.description, fields: byUid }
      if (status === 409 && isCreate) next.slug = serverMessage(error) || t('registrations.editor.slug_taken', 'Another link already uses this address')
      else if (status === 403) next.message = t('registrations.error.forbidden', 'You do not have permission for this')
      else if (!next.title && !next.slug && !next.description && !Object.keys(byUid).length) {
        next.message = serverMessage(error) || t('registrations.editor.save_failed', 'Could not save the link')
      }
      setServer(next)
      if (next.message) showToast({ title: t('registrations.editor.save_failed', 'Could not save the link'), description: next.message, tone: 'error' })
      revealProblems(Object.keys(byUid))
    } finally {
      setSaving(false)
    }
  }

  async function copyUrl() {
    const ok = await copyText(url)
    showToast({ title: ok ? t('registrations.links.copied', 'Link copied') : t('registrations.links.copy_failed', 'Could not copy the link'), description: ok ? url : undefined, tone: ok ? 'success' : 'error' })
  }

  const tabs = (
    <div role="tablist" aria-label={t('registrations.editor.view', 'View')} className="hidden shrink-0 gap-0.5 rounded-[11px] bg-[var(--input-surface)] p-0.5 sm:flex">
      {([
        ['build', t('registrations.editor.tab_build', 'Builder'), ListBulletsIcon],
        ['preview', t('registrations.editor.tab_preview', 'Preview'), EyeIcon],
      ] as const).map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={tab === key}
          onClick={() => setTab(key)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-semibold transition-colors',
            tab === key ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--elev-sm)]' : 'text-[var(--muted-strong)] hover:text-[var(--foreground)]',
          )}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  )

  const titleError = server.title ?? (attempted ? titleIssue : null)
  const slugError = server.slug ?? slugIssue

  return (
    <SidePanel
      open
      onClose={() => void requestClose()}
      title={isCreate ? t('registrations.editor.create_title', 'New registration link') : t('registrations.editor.edit_title', 'Edit link')}
      subtitle={isCreate ? t('registrations.editor.create_subtitle', 'Build the form applicants fill in. You approve each application before an account is created.') : <span data-i18n-skip="true">{initial.title}</span>}
      headerExtra={tabs}
      width={PANEL_WIDTH}
      footer={
        <>
          {attempted && problemCount > 0 ? (
            <span className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--danger-text)]">
              <WarningCircleIcon size={15} weight="fill" />
              {t('registrations.editor.problems', 'Fix {{count}} problems to save', { count: problemCount })}
            </span>
          ) : (
            <button type="button" onClick={() => setTab(tab === 'build' ? 'preview' : 'build')} className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-semibold text-[var(--muted-strong)] hover:bg-[var(--input-surface)] sm:hidden">
              {tab === 'build' ? <EyeIcon size={15} /> : <ListBulletsIcon size={15} />}
              {tab === 'build' ? t('registrations.editor.tab_preview', 'Preview') : t('registrations.editor.tab_build', 'Builder')}
            </button>
          )}
          <Button variant="secondary" onClick={() => void requestClose()} disabled={saving} className="hidden sm:inline-flex">{t('registrations.common.cancel', 'Cancel')}</Button>
          <Button onClick={() => void save()} loading={saving}>
            {isCreate ? t('registrations.editor.create', 'Create link') : t('registrations.editor.save', 'Save changes')}
          </Button>
        </>
      }
    >
      {tab === 'preview' ? (
        <PreviewForm title={title} description={description} fields={previewFields} />
      ) : (
        <div className="flex flex-col gap-7 px-5 py-5 sm:px-6">
          {server.message ? (
            <div role="alert" className="flex items-start gap-2.5 rounded-[12px] bg-[var(--danger-dim)] px-3.5 py-3 text-[13px] text-[var(--danger-text)]">
              <WarningCircleIcon size={17} weight="fill" className="mt-px shrink-0" />
              <span>{server.message}</span>
            </div>
          ) : null}

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-title" className="text-[12.5px] font-semibold text-[var(--muted-strong)]">
                {t('registrations.editor.title', 'Title')} <span className="text-[var(--danger-text)]">*</span>
              </label>
              <Input
                id="reg-title"
                value={title}
                maxLength={300}
                autoFocus={isCreate}
                onChange={(event) => changeTitle(event.target.value)}
                placeholder={t('registrations.editor.title_placeholder', 'e.g. Backend developer registration')}
                aria-invalid={titleError ? true : undefined}
                data-editor-problem={titleError ? 'true' : undefined}
              />
              {titleError ? <p className="text-[12px] font-medium text-[var(--danger-text)]">{titleError}</p> : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-slug" className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('registrations.editor.slug', 'Link address')}</label>
              {isCreate ? (
                <div className="flex min-w-0">
                  <span className="inline-flex shrink-0 items-center rounded-l-[10px] border border-r-0 border-[var(--border-hover)] bg-[var(--muted-surface)] px-3 text-[12.5px] text-[var(--muted)]">/register/</span>
                  <Input
                    id="reg-slug"
                    value={slug}
                    maxLength={SLUG_MAX}
                    spellCheck={false}
                    autoCapitalize="none"
                    onChange={(event) => {
                      setSlugEdited(true)
                      setSlug(sanitizeSlugInput(event.target.value))
                      setServer((current) => ({ ...current, slug: undefined }))
                    }}
                    onBlur={() => setSlug((value) => value.replace(/^-+|-+$/g, ''))}
                    placeholder={t('registrations.editor.slug_placeholder', 'made-from-the-title')}
                    aria-invalid={slugError ? true : undefined}
                    className="rounded-l-none font-mono text-[13px]"
                  />
                </div>
              ) : null}
              <div className="flex min-w-0 items-center gap-1 rounded-[12px] bg-[var(--input-surface)] py-1 pr-1 pl-3">
                <GlobeIcon size={15} className="shrink-0 text-[var(--muted)]" />
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[var(--foreground)]" data-i18n-skip="true" title={url}>{url}</span>
                <button type="button" onClick={() => void copyUrl()} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-semibold text-[var(--muted-strong)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]">
                  <CopyIcon size={14} /> <span className="hidden sm:inline">{t('registrations.links.copy', 'Copy')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openInNewTab(url)}
                  disabled={isCreate}
                  title={isCreate ? t('registrations.editor.open_after_save', 'Available after the link is created') : undefined}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-semibold text-[var(--muted-strong)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-40"
                >
                  <ArrowSquareOutIcon size={14} /> <span className="hidden sm:inline">{t('registrations.links.open', 'Open')}</span>
                </button>
              </div>
              {slugError ? (
                <p className="text-[12px] font-medium text-[var(--danger-text)]">{slugError}</p>
              ) : (
                <p className="text-[11.5px] leading-[1.45] text-[var(--muted)]">
                  {isCreate
                    ? t('registrations.editor.slug_hint', 'Made from the title — you can change it now, but not after the link is created.')
                    : t('registrations.editor.slug_locked', 'The address cannot be changed after the link is created.')}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-description" className="text-[12.5px] font-semibold text-[var(--muted-strong)]">{t('registrations.editor.description', 'Description')}</label>
              <Textarea
                id="reg-description"
                value={description}
                maxLength={5000}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('registrations.editor.description_placeholder', 'Shown to applicants above the form: who it is for, what to prepare…')}
                aria-invalid={server.description ? true : undefined}
              />
              {server.description ? <p className="text-[12px] font-medium text-[var(--danger-text)]">{server.description}</p> : null}
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-[var(--foreground)]">{t('registrations.editor.active', 'Accepting applications')}</span>
                <span className="block text-[12px] leading-[1.45] text-[var(--muted)]">
                  {isActive
                    ? t('registrations.editor.active_on', 'Anyone with the link can apply.')
                    : t('registrations.editor.active_off', 'The link shows that registration is closed.')}
                </span>
              </span>
              <Switch checked={isActive} onChange={setIsActive} tone="emerald" label={t('registrations.editor.active', 'Accepting applications')} />
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-[14.5px] font-semibold text-[var(--foreground)]">{t('registrations.editor.fields', 'Form fields')}</h3>
                <p className="text-[12px] text-[var(--muted)]">
                  {t('registrations.editor.fields_count', '{{count}} fields · {{required}} required', { count: fields.length, required: requiredCount })}
                </p>
              </div>
            </div>
            <FieldBuilder
              fields={fields}
              onChange={changeFields}
              openUids={openUids}
              onOpenChange={setOpen}
              issues={fieldIssues}
              showAll={attempted}
              serverErrors={server.fields}
            />
          </section>
        </div>
      )}
    </SidePanel>
  )
}
