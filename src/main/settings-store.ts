import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { DEFAULT_SETTINGS } from '../shared/constants'
import type { SystemSettings } from '../shared/types'

const SETTINGS_FILE = 'settings.json'

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

/**
 * 从磁盘加载设置，不存在则返回默认值
 */
export function loadSettings(): SystemSettings {
  const filePath = getSettingsPath()
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const saved = JSON.parse(raw) as Record<string, unknown>
      // 合并默认值（确保新增字段有默认值）
      const merged = { ...DEFAULT_SETTINGS, ...saved }
      console.log(`[Settings] Loaded from ${filePath}`)
      return merged as SystemSettings
    }
  } catch (err) {
    console.error('[Settings] Failed to load:', err)
  }
  console.log('[Settings] Using defaults')
  return { ...DEFAULT_SETTINGS } as SystemSettings
}

/**
 * 保存设置到磁盘
 */
export function saveSettings(settings: SystemSettings): void {
  const filePath = getSettingsPath()
  try {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
    console.log(`[Settings] Saved to ${filePath}`)
  } catch (err) {
    console.error('[Settings] Failed to save:', err)
  }
}
