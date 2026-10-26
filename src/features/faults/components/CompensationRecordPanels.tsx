import type {
  MemberDeliveryBonusRecord,
  MemberMistakeRecord,
  SimpleBonusRecord,
  SimplePenaltyRecord,
} from '../../../shared/api/types'
import { getIntlLocale, translateCurrentLiteral } from '../../../shared/i18n/translations'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { CardSection } from '../../../shared/ui/card'
import { DataTable } from '../../../shared/ui/data-table'
import { formatAmount, formatDetailDate } from '../lib/salaryEstimates'

const lt = translateCurrentLiteral
const tr = (key: string, uzFallback: string, ruFallback: string) => {
  const value = lt(key)

  if (value !== key) {
    return value
  }

  const locale = getIntlLocale()

  if (locale.startsWith('ru')) {
    return ruFallback
  }

  if (locale.startsWith('en')) {
    return key
  }

  return uzFallback
}

function renderProjectLabel(projectName?: string | null, projectId?: number | null) {
  if (projectName?.trim()) {
    return projectName
  }

  if (typeof projectId === 'number' && projectId > 0) {
    return `${lt('Project')} #${projectId}`
  }

  return lt('No project')
}

function renderReviewerLabel(reviewerName?: string | null, reviewerId?: number | null) {
  if (reviewerName?.trim()) {
    return reviewerName
  }

  if (typeof reviewerId === 'number' && reviewerId > 0) {
    return `${lt('Reviewer')} #${reviewerId}`
  }

  return lt('Reviewer not set')
}

type MistakeIncidentSectionProps = {
  items: MemberMistakeRecord[]
  editable?: boolean
  onAdd?: () => void
  onEdit?: (item: MemberMistakeRecord) => void
  onDelete?: (item: MemberMistakeRecord) => void
  className?: string
}

export function MistakeIncidentSection({
  items,
  editable = false,
  onAdd,
  onEdit,
  onDelete,
  className,
}: MistakeIncidentSectionProps) {
  return (
    <CardSection
      className={className}
      title={tr('Recorded compensation mistakes', 'Qayd etilgan kompensatsiya xatolari', 'Zafiksirovannye oshibki kompensatsii')}
      headerAction={
        <>
          <Badge variant={items.length > 0 ? 'danger' : 'outline'}>
            {items.length} {lt('entries')}
          </Badge>
          {editable && onAdd ? (
            <Button variant="ghost" size="sm" onClick={onAdd} className="rounded-xl text-[var(--danger-text)]">
              {tr('Add mistake', 'Xato qoshish', 'Dobavit oshibku')}
            </Button>
          ) : null}
        </>
      }
    >
      {items.length > 0 ? (
        <DataTable
          zebra
          className="rounded-none border-x-0 border-b-0"
          caption={tr('Mistake incidents table', 'Xatolar jadvali', 'Tablitsa oshibok')}
          rows={items}
          getRowKey={(row) => `mistake-${row.id}`}
          columns={[
            {
              key: 'title',
              header: tr('Title', 'Nomi', 'Nazvanie'),
              render: (row) => <span className="font-semibold text-[var(--foreground)]">{row.title}</span>,
            },
            {
              key: 'category',
              header: tr('Category', 'Kategoriya', 'Kategoriya'),
              render: (row) => row.category,
            },
            {
              key: 'severity',
              header: tr('Severity', 'Daraja', 'Stepen'),
              render: (row) => <span className="font-semibold text-[var(--danger-text)]">{row.severity}</span>,
            },
            {
              key: 'date',
              header: tr('Date', 'Sana', 'Data'),
              render: (row) => formatDetailDate(row.incident_date ?? row.created_at),
            },
            {
              key: 'project',
              header: tr('Project', 'Loyiha', 'Proekt'),
              render: (row) => renderProjectLabel(row.project_name, row.project_id),
            },
            {
              key: 'reviewer',
              header: tr('Reviewer', "Ko'rib chiquvchi", 'Proveryayushchiy'),
              render: (row) => renderReviewerLabel(row.reviewer_name, row.reviewer_id),
            },
            {
              key: 'flags',
              header: tr('Flags', 'Belgilar', 'Flagi'),
              render: (row) => (
                <div className="flex flex-wrap gap-1.5">
                  {row.reached_client ? <Badge variant="danger">{lt('Reached client')}</Badge> : <Badge variant="outline">{lt('Internal only')}</Badge>}
                  {row.unclear_task ? <Badge variant="warning">{lt('Unclear task')}</Badge> : null}
                </div>
              ),
            },
            {
              key: 'actions',
              header: tr('Actions', 'Amallar', 'Deystviya'),
              render: (row) => editable && onEdit && onDelete ? (
                <div className="flex items-center gap-1 shrink-0" onClick={(event) => event.stopPropagation()}>
                  <button type="button" title={lt('Edit mistake')} onClick={() => onEdit(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button type="button" title={lt('Delete mistake')} onClick={() => onDelete(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              ) : '-',
            },
          ]}
        />
      ) : (
        <p className="text-sm text-[var(--muted-strong)]">
          {tr('No mistake incidents were returned for the selected month.', 'Tanlangan oy uchun xato holatlari qaytmadi.', 'Za vybrannyi mesyats zapisi ob oshibkakh ne vernulis.')}
        </p>
      )}
    </CardSection>
  )
}

type DeliveryBonusSectionProps = {
  items: MemberDeliveryBonusRecord[]
  editable?: boolean
  onAdd?: () => void
  onEdit?: (item: MemberDeliveryBonusRecord) => void
  onDelete?: (item: MemberDeliveryBonusRecord) => void
  className?: string
}

export function DeliveryBonusSection({
  items,
  editable = false,
  onAdd,
  onEdit,
  onDelete,
  className,
}: DeliveryBonusSectionProps) {
  return (
    <CardSection
      className={className}
      title={tr('Recorded delivery bonus events', 'Qayd etilgan topshirish bonuslari', 'Zafiksirovannye sobytiya bonusov za sdachu')}
      headerAction={
        <>
          <Badge variant={items.length > 0 ? 'success' : 'outline'}>
            {items.length} {lt('entries')}
          </Badge>
          {editable && onAdd ? (
            <Button variant="ghost" size="sm" onClick={onAdd} className="rounded-xl font-semibold text-[var(--success-text)]">
              {tr('Add delivery bonus', 'Topshirish bonusini qoshish', 'Dobavit bonus za sdachu')}
            </Button>
          ) : null}
        </>
      }
    >
      {items.length > 0 ? (
        <DataTable
          zebra
          className="rounded-none border-x-0 border-b-0"
          caption={tr('Delivery bonus table', 'Topshirish bonuslari jadvali', 'Tablitsa bonusov za sdachu')}
          rows={items}
          getRowKey={(row) => `delivery-bonus-${row.id}`}
          columns={[
            {
              key: 'title',
              header: tr('Title', 'Nomi', 'Nazvanie'),
              render: (row) => <span className="font-semibold text-[var(--success-text)]">{row.title}</span>,
            },
            {
              key: 'type',
              header: tr('Type', 'Turi', 'Tip'),
              render: (row) => row.bonus_type,
            },
            {
              key: 'date',
              header: tr('Date', 'Sana', 'Data'),
              render: (row) => formatDetailDate(row.award_date ?? row.created_at),
            },
            {
              key: 'project',
              header: tr('Project', 'Loyiha', 'Proekt'),
              render: (row) => renderProjectLabel(row.project_name, row.project_id),
            },
            {
              key: 'description',
              header: tr('Description', 'Tavsif', 'Opisanie'),
              render: (row) => row.description || '-',
            },
            {
              key: 'actions',
              header: tr('Actions', 'Amallar', 'Deystviya'),
              render: (row) => editable && onEdit && onDelete ? (
                <div className="flex items-center gap-1 shrink-0" onClick={(event) => event.stopPropagation()}>
                  <button type="button" title={lt('Edit delivery bonus')} onClick={() => onEdit(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button type="button" title={lt('Delete delivery bonus')} onClick={() => onDelete(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              ) : '-',
            },
          ]}
        />
      ) : (
        <p className="text-sm text-[var(--muted-strong)]">
          {tr('No delivery bonus records were returned for the selected month.', 'Tanlangan oy uchun topshirish bonuslari qaytmadi.', 'Za vybrannyi mesyats zapisi o bonusakh za sdachu ne vernulis.')}
        </p>
      )}
    </CardSection>
  )
}

type SimpleBonusSectionProps = {
  items: SimpleBonusRecord[]
  editable?: boolean
  onAdd?: () => void
  onDelete?: (item: SimpleBonusRecord) => void
  className?: string
}

export function SimpleBonusSection({
  items,
  editable = false,
  onAdd,
  onDelete,
  className,
}: SimpleBonusSectionProps) {
  return (
    <CardSection
      className={className}
      title={tr('Simple bonuses', 'Oddiy bonuslar', 'Простые бонусы')}
      headerAction={
        <>
          <Badge variant={items.length > 0 ? 'success' : 'outline'}>
            {items.length} {lt('entries')}
          </Badge>
          {editable && onAdd ? (
            <Button variant="ghost" size="sm" onClick={onAdd} className="rounded-xl font-semibold text-[var(--success-text)]">
              {tr('Add bonus', "Bonus qo'shish", 'Добавить бонус')}
            </Button>
          ) : null}
        </>
      }
    >
      {items.length > 0 ? (
        <DataTable
          zebra
          className="rounded-none border-x-0 border-b-0"
          caption={tr('Simple bonuses table', 'Oddiy bonuslar jadvali', 'Tablitsa prostykh bonusov')}
          rows={items}
          getRowKey={(row) => `simple-bonus-${row.id}`}
          columns={[
            {
              key: 'reason',
              header: tr('Reason', 'Sabab', 'Prichina'),
              render: (row) => <span className="font-semibold text-[var(--success-text)]">{row.reason}</span>,
            },
            {
              key: 'amount',
              header: tr('Amount', 'Summa', 'Summa'),
              align: 'right',
              render: (row) => <span className="font-semibold text-[var(--success-text)]">{formatAmount(row.amount)}</span>,
            },
            {
              key: 'date',
              header: tr('Date', 'Sana', 'Data'),
              render: (row) => row.created_at ? formatDetailDate(row.created_at) : '-',
            },
            {
              key: 'actions',
              header: tr('Actions', 'Amallar', 'Deystviya'),
              render: (row) => editable && onDelete ? (
                <div className="flex items-center gap-1 shrink-0" onClick={(event) => event.stopPropagation()}>
                  <button type="button" title={lt('Delete bonus')} onClick={() => onDelete(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              ) : '-',
            },
          ]}
        />
      ) : (
        <p className="text-sm text-[var(--muted-strong)]">
          {tr('No simple bonuses for the selected period.', 'Tanlangan davr uchun oddiy bonuslar yo\'q.', 'Za vybrannyi period prostykh bonusov net.')}
        </p>
      )}
    </CardSection>
  )
}

type SimplePenaltySectionProps = {
  items: SimplePenaltyRecord[]
  editable?: boolean
  onAdd?: () => void
  onDelete?: (item: SimplePenaltyRecord) => void
  className?: string
}

export function SimplePenaltySection({
  items,
  editable = false,
  onAdd,
  onDelete,
  className,
}: SimplePenaltySectionProps) {
  return (
    <CardSection
      className={className}
      title={tr('Simple penalties', 'Oddiy jarimalar', 'Простые штрафы')}
      headerAction={
        <>
          <Badge variant={items.length > 0 ? 'danger' : 'outline'}>
            {items.length} {lt('entries')}
          </Badge>
          {editable && onAdd ? (
            <Button variant="ghost" size="sm" onClick={onAdd} className="rounded-xl text-[var(--danger-text)]">
              {tr('Add penalty', "Jarima qo'shish", 'Добавить штраф')}
            </Button>
          ) : null}
        </>
      }
    >
      {items.length > 0 ? (
        <DataTable
          zebra
          className="rounded-none border-x-0 border-b-0"
          caption={tr('Simple penalties table', 'Oddiy jarimalar jadvali', 'Tablitsa prostykh shtrafov')}
          rows={items}
          getRowKey={(row) => `simple-penalty-${row.id}`}
          columns={[
            {
              key: 'reason',
              header: tr('Reason', 'Sabab', 'Prichina'),
              render: (row) => <span className="font-semibold text-[var(--foreground)]">{row.reason}</span>,
            },
            {
              key: 'amount',
              header: tr('Amount', 'Summa', 'Summa'),
              align: 'right',
              render: (row) => <span className="font-semibold text-[var(--danger-text)]">{formatAmount(row.amount)}</span>,
            },
            {
              key: 'date',
              header: tr('Date', 'Sana', 'Data'),
              render: (row) => row.created_at ? formatDetailDate(row.created_at) : '-',
            },
            {
              key: 'actions',
              header: tr('Actions', 'Amallar', 'Deystviya'),
              render: (row) => editable && onDelete ? (
                <div className="flex items-center gap-1 shrink-0" onClick={(event) => event.stopPropagation()}>
                  <button type="button" title={lt('Delete penalty')} onClick={() => onDelete(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              ) : '-',
            },
          ]}
        />
      ) : (
        <p className="text-sm text-[var(--muted-strong)]">
          {tr('No simple penalties for the selected period.', 'Tanlangan davr uchun oddiy jarimalar yo\'q.', 'Za vybrannyi period prostykh shtrafov net.')}
        </p>
      )}
    </CardSection>
  )
}
