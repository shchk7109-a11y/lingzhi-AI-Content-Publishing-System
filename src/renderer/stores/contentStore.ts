import { create } from 'zustand'
import type { ContentItem } from '../../shared/types'

interface ContentState {
  items: ContentItem[]
  loading: boolean
  loadContents: (filters?: Record<string, string>) => Promise<void>
  importContents: (contents: Record<string, unknown>[]) => Promise<void>
  deleteContent: (id: number) => Promise<void>
}

export const useContentStore = create<ContentState>((set) => ({
  items: [],
  loading: false,

  loadContents: async (filters?) => {
    set({ loading: true })
    try {
      const data = await window.api.contentList(filters)
      const items = data.map((row: Record<string, unknown>) => ({
        ...row,
        tags: JSON.parse((row.tags as string) || '[]'),
        image_paths: JSON.parse((row.image_paths as string) || '[]')
      }))
      set({ items })
    } catch {
      // 开发模式下API可能未就绪
    }
    set({ loading: false })
  },

  importContents: async (contents) => {
    await window.api.contentImport(contents)
  },

  deleteContent: async (id) => {
    await window.api.contentDelete(id)
  }
}))
