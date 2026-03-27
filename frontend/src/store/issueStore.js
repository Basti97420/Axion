import { create } from 'zustand'

export const useIssueStore = create((set) => ({
  issues: [],
  currentIssue: null,
  setIssues: (issues) => set({ issues }),
  setCurrentIssue: (issue) => set({ currentIssue: issue }),
  upsertIssue: (issue) =>
    set((state) => {
      const exists = state.issues.find((i) => i.id === issue.id)
      return {
        issues: exists
          ? state.issues.map((i) => (i.id === issue.id ? issue : i))
          : [issue, ...state.issues],
        currentIssue: state.currentIssue?.id === issue.id ? issue : state.currentIssue,
      }
    }),
  removeIssue: (id) =>
    set((state) => ({
      issues: state.issues.filter((i) => i.id !== id),
      currentIssue: state.currentIssue?.id === id ? null : state.currentIssue,
    })),
}))
