// Helpers for monthly recurring payments
// All dates are treated as Asia/Bangkok (UTC+7)

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000

/** Get today's date in Asia/Bangkok as YYYY-MM-DD */
export function todayBKK(): string {
  const now = new Date(Date.now() + TZ_OFFSET_MS)
  return now.toISOString().slice(0, 10)
}

/** Get current month in Asia/Bangkok as YYYY-MM */
export function currentMonthBKK(): string {
  return todayBKK().slice(0, 7)
}

/** Compute due date for a given month and day-of-month (clamped to month length) */
export function computeDueDate(month: string, dueDay: number): string {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const day = Math.min(dueDay, daysInMonth)
  return `${month}-${String(day).padStart(2, '0')}`
}

/** Days from today (BKK) until target date (YYYY-MM-DD). Negative = overdue. */
export function daysUntil(targetDate: string): number {
  const today = todayBKK()
  const t = new Date(`${today}T00:00:00Z`).getTime()
  const d = new Date(`${targetDate}T00:00:00Z`).getTime()
  return Math.round((d - t) / (24 * 60 * 60 * 1000))
}
