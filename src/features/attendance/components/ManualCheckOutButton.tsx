import { useEffect, useState } from 'react'
import { SignOutIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { faceIdAttendanceService } from '../../../shared/api/services/attendance.service'
import { HeaderActions } from '../../../widgets/navigation/HeaderActions'
import { ManualCheckOutDialog } from './ManualCheckOutDialog'

/** "Manual check-out" in the top bar — only when GET /attendance/manual-check-out/access says allowed. */
export function ManualCheckOutButton() {
  const { t } = useLocale()
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    faceIdAttendanceService.manualCheckOutAccess()
      .then((access) => { if (alive) setAllowed(access?.allowed === true) })
      .catch(() => { if (alive) setAllowed(false) })
    return () => { alive = false }
  }, [])

  if (!allowed) return null
  return (
    <>
      <HeaderActions>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-[13.5px] font-semibold text-[var(--foreground)] shadow-[var(--pill-shadow)] transition-colors hover:bg-[var(--input-surface)]"
        >
          <SignOutIcon size={17} className="text-[var(--primary)]" />
          {t('attendance.manual.open', 'Manual check-out')}
        </button>
      </HeaderActions>
      {open ? <ManualCheckOutDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}
