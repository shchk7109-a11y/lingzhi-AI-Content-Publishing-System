import { create } from 'zustand'
import type { SystemSettings } from '../../shared/types'

interface SettingsState {
  settings: SystemSettings | null
  loading: boolean
  loadSettings: () => Promise<void>
  saveSettings: (settings: Partial<SystemSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    try {
      const data = await window.api.settingsGet()
      set({ settings: data })
    } catch {
      // 开发模式下API可能未就绪
    }
    set({ loading: false })
  },

  saveSettings: async (newSettings) => {
    set({ loading: true })
    try {
      await window.api.settingsSave(newSettings as Record<string, unknown>)
      set({ settings: newSettings as SystemSettings })
    } catch {
      throw new Error('保存设置失败')
    }
    set({ loading: false })
  }
}))
