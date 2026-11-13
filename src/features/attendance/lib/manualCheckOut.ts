/** Fired after a manual check-out, so attendance records and the live map reload. */
export const MANUAL_CHECKOUT_EVENT = 'cims:attendance-manual-check-out'

const pad = (value: number) => String(value).padStart(2, '0')

/** Now in Asia/Tashkent (UTC+5 all year): date YYYY-MM-DD, hour and minute as two digits. */
export function tashkentNowParts() {
  const shifted = new Date(Date.now() + 5 * 60 * 60_000)
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    hour: pad(shifted.getUTCHours()),
    minute: pad(shifted.getUTCMinutes()),
  }
}

/** Tashkent wall-clock → ISO with the +05:00 offset (never a timezone-free datetime). */
export function toTashkentIso(date: string, hour: string, minute: string) {
  return `${date}T${hour}:${minute}:00+05:00`
}
