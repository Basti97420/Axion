export const PRIORITY_LABELS = {
  low:      'Niedrig',
  medium:   'Mittel',
  high:     'Hoch',
  critical: 'Kritisch',
}

export const PRIORITY_COLORS = {
  low:      'bg-slate-100 text-slate-600',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export const PRIORITY_ICONS = {
  low:      '↓',
  medium:   '→',
  high:     '↑',
  critical: '⚡',
}

export const PRIORITIES = Object.keys(PRIORITY_LABELS)
