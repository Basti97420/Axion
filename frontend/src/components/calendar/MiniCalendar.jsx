import { useState, useEffect } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, getISOWeek, isSameWeek, isSameMonth,
  addMonths, format,
} from 'date-fns'
import { de } from 'date-fns/locale'

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function buildWeeks(viewMonth) {
  const monthStart = startOfMonth(viewMonth)
  const monthEnd   = endOfMonth(viewMonth)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

export default function MiniCalendar({ currentDate, onWeekSelect }) {
  const [viewMonth, setViewMonth] = useState(() => currentDate ?? new Date())

  // Folge dem Hauptkalender wenn er in einen anderen Monat springt
  useEffect(() => {
    if (!currentDate) return
    const sameMonth =
      currentDate.getFullYear() === viewMonth.getFullYear() &&
      currentDate.getMonth()    === viewMonth.getMonth()
    if (!sameMonth) setViewMonth(currentDate)
  }, [currentDate])

  const weeks = buildWeeks(viewMonth)
  const today = new Date()

  return (
    <div className="select-none text-xs">
      {/* Monats-Header */}
      <div className="flex items-center justify-between mb-1 px-0.5">
        <button
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 font-bold"
        >
          ‹
        </button>
        <span className="font-semibold text-gray-700">
          {format(viewMonth, 'MMMM yyyy', { locale: de })}
        </span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 font-bold"
        >
          ›
        </button>
      </div>

      {/* Tabelle */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-gray-400 font-medium text-center py-0.5 w-7">KW</th>
            {DAY_LABELS.map((d) => (
              <th key={d} className="text-gray-400 font-medium text-center py-0.5">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => {
            const kw = getISOWeek(week[0])
            const isCurrentWeek = currentDate && isSameWeek(week[0], currentDate, { weekStartsOn: 1 })
            const mondayOfWeek  = week[0] // week[0] ist immer Montag (weekStartsOn: 1)

            return (
              <tr
                key={kw}
                onClick={() => onWeekSelect && onWeekSelect(mondayOfWeek)}
                className={`cursor-pointer rounded transition-colors ${
                  isCurrentWeek
                    ? 'bg-primary-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <td className={`text-center py-0.5 font-mono ${isCurrentWeek ? 'text-primary-600 font-semibold' : 'text-gray-400'}`}>
                  {kw}
                </td>
                {week.map((day) => {
                  const inMonth = isSameMonth(day, viewMonth)
                  const isToday =
                    day.getFullYear() === today.getFullYear() &&
                    day.getMonth()    === today.getMonth()    &&
                    day.getDate()     === today.getDate()
                  return (
                    <td
                      key={day.toISOString()}
                      className={`text-center py-0.5 rounded-sm ${
                        isToday
                          ? 'font-bold text-primary-700'
                          : isCurrentWeek
                          ? 'text-primary-700'
                          : inMonth
                          ? 'text-gray-700'
                          : 'text-gray-300'
                      }`}
                    >
                      {day.getDate()}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
