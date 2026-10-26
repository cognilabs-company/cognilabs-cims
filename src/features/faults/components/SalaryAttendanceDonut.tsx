import { useMemo } from 'react'
import type { DailyRecord } from '../../../shared/api/services/attendance.service'
import { attendanceService } from '../../../shared/api/services/attendance.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { translateCurrentLiteral } from '../../../shared/i18n/translations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card'

const lt = translateCurrentLiteral

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function countSundaysInMonth(year: number, month: number) {
  const days = daysInMonth(year, month)
  let count = 0
  for (let d = 1; d <= days; d++) {
    const dt = new Date(year, month - 1, d)
    if (dt.getDay() === 0) count += 1
  }
  return count
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v))
}

export default function SalaryAttendanceDonut({
  employeeId,
  year,
  month,
  monthRecords,
}: {
  employeeId: number
  year: number
  month: number
  monthRecords?: DailyRecord[]
}) {

  const today = new Date()
  const last7From = new Date(today)
  last7From.setDate(today.getDate() - 6)
  const last7FromStr = `${last7From.getFullYear()}-${String(last7From.getMonth() + 1).padStart(2, '0')}-${String(last7From.getDate()).padStart(2, '0')}`
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const last7Query = useAsyncData(() => attendanceService.getDailyRecords({ employee_id: employeeId, date_from: last7FromStr, date_to: todayStr }), [employeeId, todayStr])

  const counts = useMemo(() => {
    const days = monthRecords ?? []
    const totalWorkedMinutes = days.reduce((s, d) => s + (d.worked_minutes || 0), 0)
    const sundays = countSundaysInMonth(year, month)
    const totalDays = daysInMonth(year, month)
    const workingDays = totalDays - sundays
    const plannedHours = workingDays * 7
    const workedHours = Math.round((totalWorkedMinutes / 60) * 100) / 100

    const progressPct = plannedHours > 0 ? (workedHours / plannedHours) * 100 : 0

    return {
      totalWorkedMinutes,
      workedHours,
      plannedHours,
      progressPct: clamp(Math.round(progressPct * 100) / 100, 0, 100),
    }
  }, [monthRecords, year, month])

  const last7 = (last7Query.data?.items ?? []).sort((a, b) => a.attendance_date.localeCompare(b.attendance_date))

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dash = (counts.progressPct / 100) * circumference

  return (
    <Card className="mt-4 rounded-xl border-(--border) bg-(--surface-elevated)">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-(--foreground)">{lt('Office time progress')}</CardTitle>
        <CardDescription className="text-xs text-(--muted)">
          {lt('Planned')} {counts.plannedHours}h • {lt('Worked')} {counts.workedHours}h
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-1">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          <div className="col-span-1 flex items-center justify-center">
            <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
              <g transform="translate(70,70)">
                <circle r={radius} fill="transparent" stroke="var(--muted-surface)" strokeWidth="12" />
                <circle
                  r={radius}
                  fill="transparent"
                  stroke="#60a5fa"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  transform="rotate(-90)"
                />
                <text x="0" y="6" textAnchor="middle" className="text-[14px] font-semibold" fill="var(--foreground)">{`${counts.progressPct}%`}</text>
              </g>
            </svg>
          </div>

          <div className="md:col-span-2">
            <div className="grid grid-cols-7 gap-2">
              {last7.map((rec) => (
                <div key={rec.attendance_date} className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-(--input-surface) text-sm font-medium">
                    {new Date(rec.attendance_date).getDate()}
                  </div>
                  <div className="mt-1 text-[11px] text-(--muted)">{rec.worked_minutes ? `${Math.round(rec.worked_minutes / 60)}h` : '-'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
