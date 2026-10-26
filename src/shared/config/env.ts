const fallbackApiBaseUrl = '/api'
const fallbackWebsiteStatsApiBaseUrl = fallbackApiBaseUrl
const fallbackAttendancePublicApiUrl = 'https://essentially-stop-bunny-miami.trycloudflare.com/api'

export const env = {
  appName: import.meta.env.VITE_APP_NAME || 'Cognilabs CIMS',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl,
  websiteStatsApiBaseUrl:
    import.meta.env.VITE_WEBSITE_STATS_API_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    fallbackWebsiteStatsApiBaseUrl,
  appEnv: import.meta.env.VITE_APP_ENV || 'development',
  attendancePublicApiUrl: import.meta.env.VITE_ATTENDANCE_PUBLIC_API_URL || fallbackAttendancePublicApiUrl,
  attendanceApiKey: import.meta.env.VITE_ATTENDANCE_API_KEY || '',
} as const
