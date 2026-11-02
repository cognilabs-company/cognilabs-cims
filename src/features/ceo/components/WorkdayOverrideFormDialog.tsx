import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  updateTrackingService,
  type WorkdayOverrideDayType,
  type WorkdayOverrideMemberOption,
  type WorkdayOverrideRecord,
} from '../../../shared/api/services/updateTracking.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { formatShortDate } from '../../../shared/lib/format'
import { useToast } from '../../../shared/toast/useToast'
import { Alert } from '../../../shared/ui/alert'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { MemberAvatar as SharedMemberAvatar } from '../../../shared/ui/member-avatar'
import { SelectField } from '../../../shared/ui/select-field'
import { Textarea } from '../../../shared/ui/textarea'
import { tonePill } from '../../../shared/ui/tone'
import { getOverrideTypeLabel, getTypeBadgeVariant, normalizeDayType } from '../lib/workdayOverride'

const lt = translateCurrentLiteral

const DAY_TYPE_OPTIONS = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'short_day', label: 'Short Day' },
] as const

type OverrideFormState = {
  specialDate: string
  dayType: WorkdayOverrideDayType
  title: string
  note: string
  appliesToAll: boolean
  memberIds: number[]
  workdayHours: string
  updateRequired: boolean
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultFormState(month: number, year: number): OverrideFormState {
  return {
    specialDate: formatDateInput(new Date(year, month - 1, 1)),
    dayType: 'holiday',
    title: '',
    note: '',
    appliesToAll: true,
    memberIds: [],
    workdayHours: '',
    updateRequired: false,
  }
}

function createFormStateFromOverride(item: WorkdayOverrideRecord): OverrideFormState {
  return {
    specialDate: item.special_date,
    dayType: normalizeDayType(item.day_type),
    title: item.title ?? '',
    note: item.note ?? '',
    appliesToAll: item.target_type === 'all',
    memberIds: item.member_id ? [item.member_id] : [],
    workdayHours: item.workday_hours ?? '',
    updateRequired: item.update_required,
  }
}

const selectionCardBase = 'rounded-[18px] px-4 py-3.5 text-left transition-colors'
const selectionCardIdle = 'bg-[var(--muted-surface)] text-[var(--muted-strong)] hover:bg-[var(--input-surface)]'
const selectionCardHint = 'mt-1 text-[12.5px] text-[var(--muted)]'

function MemberAvatar({ member }: { member: WorkdayOverrideMemberOption }) {
  return (
    <SharedMemberAvatar
      name={member.name}
      surname={member.surname}
      imageUrl={member.profile_image}
      size="sm"
      title={member.full_name || `${member.name} ${member.surname}`}
    />
  )
}

function MemberPicker({
  members,
  selectedIds,
  onChange,
  multiple = true,
}: {
  members: WorkdayOverrideMemberOption[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  multiple?: boolean
}) {
  const [search, setSearch] = useState('')

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return members
    return members.filter((member) =>
      [member.full_name, member.name, member.surname, member.role, member.telegram_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [members, search])

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedIds.includes(member.id)),
    [members, selectedIds],
  )

  function toggle(memberId: number) {
    if (selectedIds.includes(memberId)) {
      onChange(selectedIds.filter((id) => id !== memberId))
      return
    }
    onChange(multiple ? [...selectedIds, memberId] : [memberId])
  }

  return (
    <div className="space-y-3">
      {selectedMembers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedMembers.map((member) => (
            <button
              key={`chip-${member.id}`}
              type="button"
              onClick={() => toggle(member.id)}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--blue-dim)] py-1 pr-3 pl-1 text-xs font-semibold text-[var(--blue-text)] transition-colors hover:bg-[var(--blue-soft)]"
            >
              <MemberAvatar member={member} />
              <span>{member.full_name || `${member.name} ${member.surname}`}</span>
            </button>
          ))}
        </div>
      ) : null}

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={multiple ? lt('Search members to include') : lt('Search member')}
      />

      <div className="max-h-56 overflow-y-auto rounded-[18px] bg-[var(--muted-surface)]">
        {filteredMembers.length > 0 ? filteredMembers.map((member) => {
          const selected = selectedIds.includes(member.id)
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => toggle(member.id)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3.5 py-2.5 text-left transition-colors last:border-b-0',
                selected ? 'bg-[var(--blue-dim)]' : 'hover:bg-[var(--surface)]',
              )}
            >
              <MemberAvatar member={member} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">
                  {member.full_name || `${member.name} ${member.surname}`}
                </p>
                <p className="truncate text-[12.5px] text-[var(--muted)]">
                  {member.role || lt('Member')}
                  {member.telegram_id ? ` | @${member.telegram_id}` : ''}
                </p>
              </div>
              {selected ? <Badge variant="blue" size="sm">{lt('Selected')}</Badge> : null}
            </button>
          )
        }) : (
          <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {lt('No members matched this search.')}
          </div>
        )}
      </div>
    </div>
  )
}

type WorkdayOverrideFormDialogProps = {
  open: boolean
  onClose: () => void
  editingOverride?: WorkdayOverrideRecord | null
  onSuccess?: () => void | Promise<void>
  defaultMonth?: number
  defaultYear?: number
}

export function WorkdayOverrideFormDialog({
  open,
  onClose,
  editingOverride = null,
  onSuccess,
  defaultMonth,
  defaultYear,
}: WorkdayOverrideFormDialogProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const now = new Date()
  const month = defaultMonth ?? (now.getMonth() + 1)
  const year = defaultYear ?? now.getFullYear()

  const tx = (key: string, fallback: string, params?: Record<string, string | number>) =>
    t(key, { defaultValue: fallback, ...params })

  const [formState, setFormState] = useState<OverrideFormState>(() =>
    createDefaultFormState(month, year),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const memberOptionsQuery = useAsyncData(
    () => updateTrackingService.workdayOverrideMemberOptions(),
    [],
  )

  useEffect(() => {
    if (open) {
      setFormState(
        editingOverride
          ? createFormStateFromOverride(editingOverride)
          : createDefaultFormState(month, year),
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingOverride])

  function setForm(patch: Partial<OverrideFormState>) {
    setFormState((current) => ({ ...current, ...patch }))
  }

  function handleDayTypeChange(value: string) {
    const dayType = normalizeDayType(value)
    setFormState((current) => ({
      ...current,
      dayType,
      workdayHours: dayType === 'short_day' ? (current.workdayHours || '5') : '',
      updateRequired: dayType === 'holiday' ? false : current.updateRequired,
    }))
  }

  async function handleSubmit() {
    const title = formState.title.trim()
    const note = formState.note.trim()
    const selectedMemberId = formState.memberIds[0]

    if (!formState.specialDate) {
      showToast({ title: lt('Date required'), description: lt('Select the holiday or short day date.'), tone: 'error' })
      return
    }

    if (!title) {
      showToast({ title: lt('Title required'), description: lt('Enter a short title for this override.'), tone: 'error' })
      return
    }

    if (!formState.appliesToAll && formState.memberIds.length === 0) {
      showToast({ title: lt('Member required'), description: lt('Choose at least one member for this override.'), tone: 'error' })
      return
    }

    if (editingOverride && !formState.appliesToAll && !selectedMemberId) {
      showToast({ title: lt('Member required'), description: lt('Select one member when editing a specific override.'), tone: 'error' })
      return
    }

    const parsedWorkdayHours = Number(formState.workdayHours)
    const workdayHours = formState.dayType === 'short_day' && Number.isFinite(parsedWorkdayHours)
      ? parsedWorkdayHours
      : undefined

    if (formState.dayType === 'short_day' && (workdayHours === undefined || workdayHours <= 0)) {
      showToast({ title: lt('Hours required'), description: lt('Enter a valid workday hour count for a short day.'), tone: 'error' })
      return
    }

    setIsSubmitting(true)

    try {
      if (editingOverride) {
        await updateTrackingService.updateWorkdayOverride(editingOverride.id, {
          special_date: formState.specialDate,
          day_type: formState.dayType,
          title,
          note: note || undefined,
          applies_to_all: formState.appliesToAll,
          member_id: formState.appliesToAll ? null : selectedMemberId,
          workday_hours: workdayHours,
          update_required: formState.updateRequired,
        })

        showToast({
          title: lt('Override updated'),
          description: `${title} ${lt('was updated successfully.')}`,
          tone: 'success',
        })
      } else {
        const response = await updateTrackingService.createWorkdayOverride({
          special_date: formState.specialDate,
          day_type: formState.dayType,
          title,
          note: note || undefined,
          applies_to_all: formState.appliesToAll,
          member_ids: formState.appliesToAll ? undefined : formState.memberIds,
          workday_hours: workdayHours,
          update_required: formState.updateRequired,
        })

        showToast({
          title: lt('Override created'),
          description: response.message || `${title} ${lt('was created successfully.')}`,
          tone: 'success',
        })
      }

      await onSuccess?.()
      onClose()
    } catch (error) {
      showToast({
        title: editingOverride ? lt('Update failed') : lt('Create failed'),
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const memberOptions = memberOptionsQuery.data ?? []
  const dialogTitle = editingOverride
    ? tx('ceo.workday.dialog.edit_title', 'Edit Workday Override')
    : tx('ceo.workday.dialog.create_title', 'Create Workday Override')
  const dialogDescription = editingOverride
    ? tx('ceo.workday.dialog.edit_description', 'Update the selected holiday or short-day entry.')
    : tx('ceo.workday.dialog.create_description', 'Create a holiday or short working day for all members or selected members.')

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={dialogTitle}
      description={dialogDescription}
      size="xl"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            loading={isSubmitting}
          >
            {editingOverride ? t('common.save_changes') : tx('ceo.workday.dialog.create_action', 'Create Override')}
          </Button>
        </>
      )}
    >
      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-[18px]">
          <div className="grid gap-[18px] sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">{tx('common.date', 'Date')}</Label>
              <Input
                type="date"
                value={formState.specialDate}
                onChange={(event) => setForm({ specialDate: event.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">{tx('common.type', 'Type')}</Label>
              <SelectField
                value={String(formState.dayType)}
                options={DAY_TYPE_OPTIONS.map((option) => ({ ...option, label: lt(option.label) }))}
                onValueChange={handleDayTypeChange}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">{tx('common.title', 'Title')}</Label>
            <Input
              value={formState.title}
              onChange={(event) => setForm({ title: event.target.value })}
              placeholder={formState.dayType === 'holiday'
                ? tx('ceo.workday.form.holiday_title_placeholder', 'Holiday title example')
                : tx('ceo.workday.form.short_day_title_placeholder', 'Short day title example')}
            />
          </div>

          <div>
            <Label className="mb-2 block">{tx('common.note', 'Note')}</Label>
            <Textarea
              value={formState.note}
              onChange={(event) => setForm({ note: event.target.value })}
              placeholder={tx('ceo.workday.form.note_placeholder', 'Optional note shown in calendars and focus panels.')}
            />
          </div>

          {formState.dayType === 'short_day' ? (
            <div>
              <Label className="mb-2 block">{tx('ceo.workday.form.workday_hours', 'Workday hours')}</Label>
              <Input
                type="number"
                min="1"
                max="24"
                value={formState.workdayHours}
                onChange={(event) => setForm({ workdayHours: event.target.value })}
                placeholder="5"
              />
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[13px] font-medium text-[var(--muted-strong)]">{tx('ceo.workday.form.update_rule', 'Update rule')}</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm({ updateRequired: false })}
                className={cn(
                  selectionCardBase,
                  !formState.updateRequired ? tonePill('warning') : selectionCardIdle,
                )}
              >
                <p className="text-sm font-semibold">{tx('ceo.workday.form.no_update_required', 'No update required')}</p>
                <p className={selectionCardHint}>{tx('ceo.workday.form.no_update_required_hint', 'Use this for holidays or shortened days with no reporting.')}</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ updateRequired: true })}
                className={cn(
                  selectionCardBase,
                  formState.updateRequired ? tonePill('success') : selectionCardIdle,
                )}
              >
                <p className="text-sm font-semibold">{tx('ceo.workday.form.update_required', 'Update still required')}</p>
                <p className={selectionCardHint}>{tx('ceo.workday.form.update_required_hint', 'Use this when the day is shortened but reporting should still happen.')}</p>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-[18px]">
          <div>
            <p className="mb-2 text-[13px] font-medium text-[var(--muted-strong)]">{tx('ceo.workday.form.target_scope', 'Target scope')}</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm({ appliesToAll: true, memberIds: [] })}
                className={cn(
                  selectionCardBase,
                  formState.appliesToAll ? tonePill('blue') : selectionCardIdle,
                )}
              >
                <p className="text-sm font-semibold">{tx('ceo.workday.form.all_members', 'All members')}</p>
                <p className={selectionCardHint}>{tx('ceo.workday.form.all_members_hint', 'Company-wide holiday or short day.')}</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ appliesToAll: false })}
                className={cn(
                  selectionCardBase,
                  !formState.appliesToAll ? tonePill('violet') : selectionCardIdle,
                )}
              >
                <p className="text-sm font-semibold">{tx('ceo.workday.form.selected_members', 'Selected members')}</p>
                <p className={selectionCardHint}>{tx('ceo.workday.form.selected_members_hint', 'Apply only to specific employees.')}</p>
              </button>
            </div>
          </div>

          {!formState.appliesToAll ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label>
                  {editingOverride ? tx('common.member', 'Member') : tx('common.members', 'Members')}
                </Label>
                <Badge variant="secondary">
                  {tx('ceo.workday.form.selected_count', '{{count}} selected', { count: formState.memberIds.length })}
                </Badge>
              </div>

              {memberOptionsQuery.isLoading && memberOptions.length === 0 ? (
                <div className="rounded-[18px] bg-[var(--muted-surface)] px-4 py-6 text-sm text-[var(--muted)]">
                  {tx('ceo.workday.form.loading_members', 'Loading member options...')}
                </div>
              ) : (
                <MemberPicker
                  members={memberOptions}
                  selectedIds={formState.memberIds}
                  onChange={(memberIds) => setForm({ memberIds })}
                  multiple={!editingOverride}
                />
              )}
            </div>
          ) : (
            <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-5 text-sm text-[var(--muted-strong)]">
              {tx('ceo.workday.form.applies_to_all', 'This override will apply to every member in the company.')}
            </div>
          )}

          <div className="rounded-[18px] bg-[var(--accent-soft)] p-[18px]">
            <p className="ui-eyebrow">{tx('common.preview', 'Preview')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={getTypeBadgeVariant(formState.dayType)}>
                {getOverrideTypeLabel(formState.dayType)}
              </Badge>
              <Badge variant={formState.appliesToAll ? 'secondary' : 'outline'}>
                {formState.appliesToAll
                  ? tx('ceo.workday.form.all_members', 'All members')
                  : `${formState.memberIds.length} ${tx(formState.memberIds.length === 1 ? 'ceo.workday.form.selected_member' : 'ceo.workday.form.selected_members_count', formState.memberIds.length === 1 ? 'selected member' : 'selected members')}`}
              </Badge>
              <Badge variant={formState.updateRequired ? 'success' : 'warning'}>
                {formState.updateRequired
                  ? tx('ceo.workday.form.update_required_badge', 'Update required')
                  : tx('ceo.workday.form.no_update_required', 'No update required')}
              </Badge>
              {formState.dayType === 'short_day' && formState.workdayHours ? (
                <Badge variant="blue">{formState.workdayHours}h</Badge>
              ) : null}
            </div>
            <p className="mt-3.5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
              {formState.title.trim() || tx('ceo.workday.form.preview_title_placeholder', 'Override title will appear here.')}
            </p>
            <p className="mt-1.5 text-[12.5px] text-[var(--muted)]">
              {formState.specialDate ? formatShortDate(formState.specialDate) : tx('ceo.workday.form.no_date', 'No date selected')}
            </p>
          </div>

          {memberOptionsQuery.isError ? (
            <Alert tone="warning">
              {tx('ceo.workday.guide.member_options_error', 'Member options could not be loaded. You can still review existing overrides, but creating member-specific entries may fail until this list reloads.')}
            </Alert>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
