import { create } from 'zustand'

export const useWikiStore = create((set) => ({
  pages: [],        // flat list of top-level pages
  currentPage: null,

  setPages: (pages) => set({ pages }),
  setCurrentPage: (page) => set({ currentPage: page }),
  upsertPage: (page) =>
    set((s) => {
      const idx = s.pages.findIndex((p) => p.slug === page.slug)
      if (idx >= 0) {
        const updated = [...s.pages]
        updated[idx] = page
        return { pages: updated }
      }
      return { pages: [page, ...s.pages] }
    }),
  removePage: (slug) =>
    set((s) => ({ pages: s.pages.filter((p) => p.slug !== slug) })),
}))
