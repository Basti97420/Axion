export const STATUS_LABELS = {
  open:        'Offen',
  in_progress: 'In Arbeit',
  hold:        'Pausiert',
  in_review:   'In Review',
  done:        'Erledigt',
  cancelled:   'Abgebrochen',
}

export const STATUS_COLORS = {
  open:        'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  hold:        'bg-orange-100 text-orange-700',
  in_review:   'bg-yellow-100 text-yellow-700',
  done:        'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-600',
}

export const STATUS_DOT = {
  open:        'bg-slate-400',
  in_progress: 'bg-blue-500',
  hold:        'bg-orange-400',
  in_review:   'bg-yellow-500',
  done:        'bg-green-500',
  cancelled:   'bg-red-400',
}

export const STATUSES = Object.keys(STATUS_LABELS)
