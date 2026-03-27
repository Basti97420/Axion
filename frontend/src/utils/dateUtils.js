import { format, isToday, isPast, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

let _timezone = null

export function setUserTimezone(tz) {
  _timezone = tz || null
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return format(parseISO(dateStr), 'dd.MM.yyyy', { locale: de })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (_timezone) {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: _timezone,
    }).format(date)
  }
  return format(parseISO(dateStr), 'dd.MM.yyyy HH:mm', { locale: de })
}

export function isOverdue(dateStr, status) {
  if (!dateStr || status === 'done' || status === 'cancelled') return false
  return isPast(parseISO(dateStr)) && !isToday(parseISO(dateStr))
}

export function dueDateColor(dateStr, status) {
  if (!dateStr) return 'text-gray-400'
  if (status === 'done' || status === 'cancelled') return 'text-gray-400'
  if (isOverdue(dateStr, status)) return 'text-red-600 font-medium'
  if (isToday(parseISO(dateStr))) return 'text-orange-600 font-medium'
  return 'text-gray-600'
}
