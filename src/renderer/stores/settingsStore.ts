import { create } from 'zustand'
import type { SystemSettings } from '../../shared/types'

interface SettingsState {
  settings: SystemSettings | null
  loading: boolean
  loadSettings: () => Promise<void>
  saveSettings: (settings: Partial<SystemSettings>) => Promise<void>
  updateSetting: (key: string, value: unknown) => Promise<void>
  testBitConnection: () => Promise<boolean>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    try {
      const data = await window.api.settings.get()
      set({ settings: data as SystemSettings })
    } catch {
      // 开发模式下API可能未就绪
    }
    set({ loading: false })
  },

  saveSettings: async (newSettings) => {
    set({ loading: true })
    try {
      await window.api.settings.save(newSettings as Record<string, unknown>)
      set((state) => ({ settings: { ...state.settings, ...newSettings } as SystemSettings }))
    } catch {
      throw new Error('保存设置失败')
    }
    set({ loading: false })
  },

  updateSetting: async (key, value) => {
    await window.api.settings.update(key, value)
    set((state) => {
      if (!state.settings) return state
      return { settings: { ...state.settings, [key]: value } as SystemSettings }
    })
  },

  testBitConnection: async () => {
    return (await window.api.settings.testBitConnection()) as boolean
  }
}))
