import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { useToastStore } from '../../store/toastStore'

export default function ConfirmDialog() {
  const confirmData = useToastStore((s) => s.confirmData)
  const resolveConfirm = useToastStore((s) => s.resolveConfirm)
  const confirmBtnRef = useRef(null)

  useEffect(() => {
    if (!confirmData) return
    // Fokus auf Abbrechen-Button (sicherer Standard)
    const onKey = (e) => { if (e.key === 'Escape') resolveConfirm(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmData, resolveConfirm])

  if (!confirmData) return null

  const isDanger = /löschen|entfernen|löschen|delete|remove/i.test(confirmData.message)

  return createPortal(
    <div
      className="fixed inset-0 z-[9600] bg-black/40 flex items-center justify-center p-4"
      onClick={() => resolveConfirm(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-gray-800 leading-relaxed mb-6 whitespace-pre-wrap">
          {confirmData.message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => resolveConfirm(false)}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            ref={confirmBtnRef}
            onClick={() => resolveConfirm(true)}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {isDanger ? 'Löschen' : 'Bestätigen'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
