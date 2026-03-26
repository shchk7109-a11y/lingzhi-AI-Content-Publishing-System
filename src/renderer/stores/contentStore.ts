import { create } from 'zustand'
import type { ContentItem } from '../../shared/types'

interface ContentFilters {
  status?: string
  platform?: string
  search?: string
}

interface ContentState {
  items: ContentItem[]
  loading: boolean
  filters: ContentFilters
  setFilters: (f: Partial<ContentFilters>) => void
  loadContents: () => Promise<void>
  importContents: (contents: Record<string, unknown>[]) => Promise<number>
  deleteContent: (id: number) => Promise<void>
  updateTags: (id: number, tags: string[]) => Promise<void>
}

export const useContentStore = create<ContentState>((set, get) => ({
  items: [],
  loading: false,
  filters: {},

  setFilters: (f) => {
    set((state) => ({ filters: { ...state.filters, ...f } }))
  },

  loadContents: async () => {
    set({ loading: true })
    try {
      const { filters } = get()
      const data = await window.api.content.getAll(filters as Record<string, string>)
      set({ items: data as ContentItem[] })
    } catch {
      // 开发模式下API可能未就绪
    }
    set({ loading: false })
  },

  importContents: async (contents) => {
    const count = await window.api.content.batchInsert(contents)
    await get().loadContents()
    return count as number
  },

  deleteContent: async (id) => {
    await window.api.content.delete(id)
    await get().loadContents()
  },

  updateTags: async (id, tags) => {
    await window.api.content.updateTags(id, tags)
    await get().loadContents()
  }
}))
