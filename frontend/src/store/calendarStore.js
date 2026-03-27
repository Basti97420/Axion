import { create } from 'zustand'

export const useCalendarStore = create((set) => ({
  icloudEvents: [],
  icloudConfigured: false,
  setIcloudEvents: (events) => set({ icloudEvents: events }),
  setIcloudConfigured: (val) => set({ icloudConfigured: val }),
  addIcloudEvent: (event) => set((s) => ({ icloudEvents: [...s.icloudEvents, event] })),
  removeIcloudEvent: (uid) => set((s) => ({
    icloudEvents: s.icloudEvents.filter((e) => e.uid !== uid),
  })),
}))
