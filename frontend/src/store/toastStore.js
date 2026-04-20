import { create } from 'zustand'

let nextId = 1

export const useToastStore = create((set, get) => ({
  toasts: [],
  confirmData: null,   // { message, resolve }

  // Toast anzeigen — type: 'error' | 'success' | 'info'
  showToast(message, type = 'error') {
    const id = nextId++
    const duration = type === 'error' ? 6000 : 4000
    set((s) => ({ toasts: [{ id, message, type }, ...s.toasts].slice(0, 5) }))
    setTimeout(() => get().dismissToast(id), duration)
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  // Bestätigungs-Dialog — gibt Promise<boolean> zurück
  showConfirm(message) {
    return new Promise((resolve) => {
      set({ confirmData: { message, resolve } })
    })
  },

  resolveConfirm(result) {
    const { confirmData } = get()
    if (confirmData) {
      confirmData.resolve(result)
      set({ confirmData: null })
    }
  },
}))
