import { InfoIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import type { PropertyRow } from '../lib/properties'
import { PropertiesList, SubjectGlyph, type PaneSubject } from './DetailsPane'

/** Alt+Enter / "Properties": name, type, size, location, dates of an item, a selection or the open folder. */
export function PropertiesDialog({ subject, rows, onClose }: { subject: PaneSubject; rows: PropertyRow[]; onClose: () => void }) {
  const { t } = useLocale()
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('files.props.title', 'Properties')}
      headerIcon={<InfoIcon size={18} weight="duotone" />}
      footer={<Button onClick={onClose}>{t('files.ok', 'OK')}</Button>}
    >
      <div data-i18n-skip="true">
        <div className="flex items-center gap-4 border-b border-[var(--border)] pb-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center">
            <SubjectGlyph subject={subject} size={60} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold break-words text-[var(--foreground)]">{subject.name}</p>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{subject.subtitle}</p>
          </div>
        </div>
        <PropertiesList rows={rows} className="fx-props--dialog" />
      </div>
    </Dialog>
  )
}
