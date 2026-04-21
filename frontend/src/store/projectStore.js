import { create } from 'zustand'

export const useProjectStore = create((set) => ({
  projects: [],
  currentProject: null,
  currentProjectStatuses: [],
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentProjectStatuses: (statuses) => set({ currentProjectStatuses: statuses }),
  upsertProject: (project) =>
    set((state) => {
      const exists = state.projects.find((p) => p.id === project.id)
      return {
        projects: exists
          ? state.projects.map((p) => (p.id === project.id ? project : p))
          : [project, ...state.projects],
      }
    }),
  removeProject: (id) =>
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),
}))
