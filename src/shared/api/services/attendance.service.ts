import { env } from '../../config/env'
import { request } from '../http'
import type { ApiRequestOptions } from '../types'

const FACE_ID_ATTENDANCE_API_URL = 'https://api.project.cims.cognilabs.org'

export type AttendanceRecord = {
  id: number
  employee_id: number
  full_name: string
  email: string
  role: string
  role_name: string
  attendance_date: string
  check_in_time: string | null
  check_out_time: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export type AttendanceRecordsResponse = {
  items: AttendanceRecord[]
  total_count: number
}

export type AttendanceUser = {
  id: number
  name: string
  surname: string
  email: string
}

export type AttendanceListResponse = {
  items: AttendanceRecord[]
  total_items: number
  page: number
  page_size: number
  total_pages: number
}

export type DailyRecord = {
  employee_id: number
  attendance_date: string
  check_in_time: string | null
  check_out_time: string | null
  worked_minutes: number
  worked_hours_decimal: number
  status: string
  shift_name: string | null
  source_system: string
  source_session_id: string | null
  is_manual: boolean
  note: string | null
  source_updated_at: string | null
}

export type MonthlyOfficeTime = {
  employee_id: number
  full_name: string
  total_worked_hours: number
  days: {
    date: string
    check_in: string | null
    check_out: string | null
    worked_hours: number
    status: string
  }[]
}

export type OfficeTimeMe = {
  employee: {
    id: number
    full_name: string
    role: string
  }
  period: {
    year: number
    month: number
    from: string
    to: string
  }
  days: {
    date: string
    weekday: string
    check_in_time: string | null
    check_out_time: string | null
    duration_minutes: number | null
    is_complete: boolean
  }[]
  weekly_stats: {
    week_number: number
    week_label: string
    date_from: string
    date_to: string
    days_present: number
    total_minutes: number
    avg_daily_minutes: number
    total_hours: number
  }[]
  monthly_stats: {
    days_present: number
    days_complete: number
    total_minutes: number
    avg_daily_minutes: number
    total_hours: number
  }
}

export const attendanceService = {
  getUsers(search?: string) {
    return request<AttendanceUser[]>({
      path: '/attendance/users',
      query: { search },
    })
  },

  getRecords(params: { employee_id?: number; start_date?: string; end_date?: string }) {
    return request<AttendanceRecordsResponse>({
      path: '/attendance/records',
      query: params,
    })
  },

  createRecord(data: Partial<AttendanceRecord>) {
    return request<AttendanceRecord>({
      path: '/attendance/records',
      method: 'POST',
      body: data,
    })
  },

  updateRecord(attendanceId: number, data: Partial<AttendanceRecord>) {
    return request<AttendanceRecord>({
      path: `/attendance/records/${attendanceId}`,
      method: 'PATCH',
      body: data,
    })
  },

  deleteRecord(attendanceId: number) {
    return request<void>({
      path: `/attendance/records/${attendanceId}`,
      method: 'DELETE',
    })
  },

  getEmployeeMonthlyOfficeTime(year: number, month: number, employeeId?: number) {
    return request<MonthlyOfficeTime[]>({
      path: '/attendance/employee-monthly-office-time',
      query: { year, month, employee_id: employeeId },
    })
  },

  getMonthlySummary(year: number, month: number) {
    return request<unknown>({
      path: '/attendance/monthly-summary',
      query: { year, month },
    })
  },

  getOfficeTimeMe(year: number, month: number) {
    return request<OfficeTimeMe>({
      path: '/attendance/office-time-me',
      query: { year, month },
    })
  },

  getDailyRecords(params: {
    employee_id?: number
    date_from?: string
    date_to?: string
    status?: string
    page?: number
    page_size?: number
  }) {
    return request<{ items: DailyRecord[]; total_items: number; page: number; total_pages: number }>({
      path: '/attendance/daily-records',
      query: params,
    })
  },

  upsertDailyRecord(employeeId: number, date: string, data: Partial<DailyRecord>) {
    return request<DailyRecord>({
      path: `/attendance/daily-records/${employeeId}/${date}`,
      method: 'PATCH',
      body: data,
    })
  },

  // --- Public Attendance API (port 8008) ---

  getPublicUsers(params: {
    date_from?: string
    date_to?: string
    year?: number
    month?: number
    day?: number
    status?: string
    department?: string
    search?: string
    is_active?: boolean
    include_empty?: boolean
    page?: number
    page_size?: number
  }) {
    return request<PublicAttendanceResponse>({
      path: `${env.attendancePublicApiUrl}/attendance/users/`,
      query: params as Record<string, string | number | boolean | undefined | null>,
      auth: false,
      headers: { 'X-Attendance-Key': env.attendanceApiKey },
    })
  },

  getPublicUser(
    userId: string | number,
    params: {
      date_from?: string
      date_to?: string
      year?: number
      month?: number
      day?: number
      status?: string
      page?: number
      page_size?: number
    },
  ) {
    return request<PublicAttendanceResponse>({
      path: `${env.attendancePublicApiUrl}/attendance/users/${userId}/`,
      query: params as Record<string, string | number | boolean | undefined | null>,
      auth: false,
      headers: { 'X-Attendance-Key': env.attendanceApiKey },
    })
  },
}

export type PublicAttendanceRecord = {
  session_id: number
  session_date: string
  shift_name: string | null
  status: string
  came_at: string | null
  gone_at: string | null
  came_event_id: number | null
  gone_event_id: number | null
  worked_minutes: number
  worked_hours_decimal: number
  worked_hours_display: string
  is_sent_to_api: boolean
  sent_at: string | null
  send_error: string | null
}

export type PublicAttendanceSummary = {
  session_count: number
  worked_days: number
  complete_days: number
  total_work_minutes: number
  total_work_hours_decimal: number
  total_work_hours_display: string
}

export type PublicAttendanceEmployee = {
  user_id: string
  attendance_user_id: number
  name: string
  email: string
  department: string
  position: string
  is_active: boolean
  summary: PublicAttendanceSummary
  attendance_records: PublicAttendanceRecord[]
}

export type PublicAttendanceMeta = {
  timezone: string
  filters: Record<string, unknown>
  employee_count: number
  session_count: number
  total_work_minutes: number
  total_work_hours_decimal: number
  total_work_hours_display: string
  page: number
  page_size: number
  total_count: number
  total_pages: number
}

export type PublicAttendanceResponse = {
  meta: PublicAttendanceMeta
  employees: PublicAttendanceEmployee[]
}

export type FaceIdAttendanceStatus = 'present' | 'late' | 'absent' | 'incomplete'

export type FaceIdAttendanceUser = {
  id: number
  name: string
  surname: string
  full_name: string
  email: string | null
  department: string | null
  position: string | null
  role: string | null
  role_name: string | null
  is_active: boolean
}

export type FaceIdAttendanceUsersResponse = {
  items: FaceIdAttendanceUser[]
  total_count?: number
  total_items?: number
  page?: number
  page_size?: number
  total_pages?: number
}

export type FaceIdDailyRecord = {
  employee_id: number
  employee_full_name?: string | null
  employee_name?: string | null
  full_name?: string | null
  employee?: FaceIdAttendanceEmployee | null
  attendance_date: string
  check_in_at: string | null
  check_out_at: string | null
  check_in_time: string | null
  check_out_time: string | null
  worked_minutes: number | null
  worked_hours_decimal: number | null
  status: FaceIdAttendanceStatus
  source_system: string | null
  is_manual: boolean
  note: string | null
}

export type FaceIdAttendanceEmployee = {
  id: number
  full_name: string | null
  name: string | null
  surname: string | null
  email: string | null
  role: string | null
  role_name: string | null
  job_title: string | null
}

export type FaceIdDailyRecordsResponse = {
  items: FaceIdDailyRecord[]
  total_count?: number
  total_items?: number
  page?: number
  page_size?: number
  total_pages?: number
}

export type FaceIdUserDailyRecordsResponse = {
  employee: FaceIdAttendanceEmployee
  items: FaceIdDailyRecord[]
  stats: {
    total_records: number
    present_count: number
    late_count: number
    absent_count: number
    incomplete_count: number
    total_worked_minutes: number
    total_worked_hours: number
    avg_worked_minutes: number
  }
  page: number
  page_size: number
  total_count: number
}

export type FaceIdDailyRecordUpdate = {
  status?: FaceIdAttendanceStatus
  check_in_at?: string | null
  check_out_at?: string | null
  note?: string | null
  is_deleted?: boolean
  delete_reason?: string
  source_updated_at: string
}

function attendanceReadRequest<T>(options: ApiRequestOptions) {
  return request<T>({
    ...options,
    path: `${FACE_ID_ATTENDANCE_API_URL}${options.path}`,
  })
}

function attendanceWriteRequest<T>(options: ApiRequestOptions) {
  return request<T>({
    ...options,
    path: `${FACE_ID_ATTENDANCE_API_URL}${options.path}`,
    auth: false,
    headers: {
      ...options.headers,
      'X-Attendance-Key': env.attendanceApiKey,
    },
  })
}

export const faceIdAttendanceService = {
  listUsers(params: {
    search?: string
    is_active?: boolean
    page?: number
    page_size?: number
  }) {
    return attendanceReadRequest<FaceIdAttendanceUsersResponse>({
      path: '/attendance/users',
      query: params,
    })
  },

  listDailyRecords(params: {
    employee_id?: number
    date_from?: string
    date_to?: string
    year?: number
    month?: number
    day?: number
    status?: FaceIdAttendanceStatus
    source_system?: string
    is_manual?: boolean
    page?: number
    page_size?: number
  }) {
    return attendanceReadRequest<FaceIdDailyRecordsResponse>({
      path: '/attendance/daily-records',
      query: params,
    })
  },

  getDailyRecord(employeeId: number, attendanceDate: string) {
    return attendanceReadRequest<FaceIdDailyRecord>({
      path: `/attendance/daily-records/${employeeId}/${attendanceDate}`,
    })
  },

  listUserDailyRecords(employeeId: number, params: {
    date_from?: string
    date_to?: string
    year?: number
    month?: number
    day?: number
    status?: FaceIdAttendanceStatus
    source_system?: string
    is_manual?: boolean
    page?: number
    page_size?: number
  }) {
    return attendanceReadRequest<FaceIdUserDailyRecordsResponse>({
      path: `/attendance/daily-records/user/${employeeId}`,
      query: params,
    })
  },

  updateDailyRecord(employeeId: number, attendanceDate: string, payload: FaceIdDailyRecordUpdate) {
    return attendanceWriteRequest<FaceIdDailyRecord>({
      path: `/attendance/daily-records/${employeeId}/${attendanceDate}`,
      method: 'PATCH',
      body: payload,
    })
  },
}
