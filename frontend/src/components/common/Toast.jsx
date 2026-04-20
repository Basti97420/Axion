import { createPortal } from 'react-dom'
import { useToastStore } from '../../store/toastStore'

const TYPE_STYLES = {
  error:   'bg-red-600 text-white',
  success: 'bg-green-600 text-white',
  info:    'bg-blue-600 text-white',
}

const TYPE_ICONS = {
  error:   '✕',
  success: '✓',
  info:    'ℹ',
}

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed top-4 right-4 z-[9500] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium pointer-events-auto
            animate-in slide-in-from-right-4 fade-in duration-200 ${TYPE_STYLES[t.type] || TYPE_STYLES.error}`}
        >
          <span className="shrink-0 font-bold">{TYPE_ICONS[t.type] || '!'}</span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity ml-1"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
