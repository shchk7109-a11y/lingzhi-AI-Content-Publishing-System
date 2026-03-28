import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getDatabase } from '../database/db'
import { ContentDao, AccountDao, MatchRecordDao, TaskDao, MatchRuleDao } from '../database/dao'
import { BitBrowserManager } from '../core/BitBrowserManager'
import { WindowPool } from '../core/WindowPool'
import { HumanBehaviorEngine } from '../core/HumanBehaviorEngine'
import { XiaohongshuPublisher } from '../core/publishers/XiaohongshuPublisher'
import type { PublishContent } from '../core/publishers/BasePublisher'
import type { SystemSettings } from '../shared/types'
import { loadSettings, saveSettings } from './settings-store'

const contentDao = new ContentDao()
const accountDao = new AccountDao()
const matchRecordDao = new MatchRecordDao()
const taskDao = new TaskDao()
const matchRuleDao = new MatchRuleDao()

// 从磁盘加载持久化设置
let currentSettings: SystemSettings = loadSettings()

// 用持久化的端口和Token初始化BitBrowserManager
const bitManager = new BitBrowserManager(currentSettings.bitApiPort, currentSettings.bitApiToken)
const windowPool = new WindowPool(bitManager, 1)

export function getBitManager(): BitBrowserManager {
  return bitManager
}

export function getWindowPool(): WindowPool {
  return windowPool
}

function syncBitSettings(settings: Record<string, unknown>): void {
  if (settings.bitApiPort !== undefined && typeof settings.bitApiPort === 'number') {
    bitManager.updatePort(settings.bitApiPort)
  }
  if (settings.bitApiToken !== undefined && typeof settings.bitApiToken === 'string') {
    bitManager.updateApiToken(settings.bitApiToken)
  }
}

export function registerIpcHandlers(): void {
  // ===== 内容池操作 =====
  ipcMain.handle('db:content:getAll', (_event, filters?: Record<string, string>) => {
    return contentDao.getAll(filters)
  })

  ipcMain.handle('db:content:getById', (_event, id: number) => {
    return contentDao.getById(id)
  })

  ipcMain.handle('db:content:insert', (_event, data: Record<string, unknown>) => {
    return contentDao.insert(data as Parameters<ContentDao['insert']>[0])
  })

  ipcMain.handle('db:content:batchInsert', (_event, items: Record<string, unknown>[]) => {
    return contentDao.batchInsert(items as Parameters<ContentDao['batchInsert']>[0])
  })

  ipcMain.handle('db:content:updateStatus', (_event, id: number, status: string) => {
    contentDao.updateStatus(id, status)
    return { success: true }
  })

  ipcMain.handle('db:content:updateTags', (_event, id: number, tags: string[]) => {
    contentDao.updateTags(id, tags)
    return { success: true }
  })

  ipcMain.handle('db:content:delete', (_event, id: number) => {
    contentDao.delete(id)
    return { success: true }
  })

  // ===== 账号操作 =====
  ipcMain.handle('db:accounts:getAll', (_event, filters?: Record<string, string>) => {
    return accountDao.getAll(filters)
  })

  ipcMain.handle('db:accounts:getById', (_event, id: number) => {
    return accountDao.getById(id)
  })

  ipcMain.handle('db:accounts:insert', (_event, data: Record<string, unknown>) => {
    return accountDao.insert(data as Parameters<AccountDao['insert']>[0])
  })

  ipcMain.handle('db:accounts:batchInsert', (_event, items: Record<string, unknown>[]) => {
    return accountDao.batchInsert(items as Parameters<AccountDao['batchInsert']>[0])
  })

  ipcMain.handle('db:accounts:updatePersona', (_event, id: number, persona: Record<string, string>) => {
    accountDao.updatePersona(id, persona)
    return { success: true }
  })

  ipcMain.handle('db:accounts:updateStatus', (_event, id: number, status: string) => {
    accountDao.updateStatus(id, status)
    return { success: true }
  })

  ipcMain.handle('db:accounts:delete', (_event, id: number) => {
    accountDao.delete(id)
    return { success: true }
  })

  // ===== 匹配记录操作 =====
  ipcMain.handle('db:matchRecords:getAll', (_event, filters?: Record<string, string>) => {
    return matchRecordDao.getAll(filters)
  })

  ipcMain.handle('db:matchRecords:insert', (_event, data: Record<string, unknown>) => {
    return matchRecordDao.insert(data as Parameters<MatchRecordDao['insert']>[0])
  })

  ipcMain.handle('db:matchRecords:updateStatus', (_event, id: number, status: string) => {
    matchRecordDao.updateStatus(id, status)
    return { success: true }
  })

  // ===== 任务操作 =====
  ipcMain.handle('db:tasks:getAll', (_event, filters?: Record<string, string>) => {
    return taskDao.getAll(filters)
  })

  ipcMain.handle('db:tasks:getById', (_event, id: number) => {
    return taskDao.getById(id)
  })

  ipcMain.handle('db:tasks:updateStatus', (_event, id: number, status: string, extra?: Record<string, unknown>) => {
    taskDao.updateStatus(id, status, extra as Parameters<TaskDao['updateStatus']>[2])
    return { success: true }
  })

  ipcMain.handle('db:tasks:getRunning', () => {
    return taskDao.getRunningTasks()
  })

  ipcMain.handle('db:tasks:getQueued', (_event, limit?: number) => {
    return taskDao.getQueuedTasks(limit)
  })

  // ===== 匹配规则操作 =====
  ipcMain.handle('db:matchRules:getAll', () => {
    return matchRuleDao.getAll()
  })

  ipcMain.handle('db:matchRules:insert', (_event, rule: Record<string, unknown>) => {
    return matchRuleDao.insert(rule as Parameters<MatchRuleDao['insert']>[0])
  })

  ipcMain.handle('db:matchRules:updateEnabled', (_event, id: number, enabled: boolean) => {
    matchRuleDao.updateEnabled(id, enabled)
    return { success: true }
  })

  ipcMain.handle('db:matchRules:delete', (_event, id: number) => {
    matchRuleDao.delete(id)
    return { success: true }
  })

  // ===== 统计数据 =====
  ipcMain.handle('db:stats:dashboard', () => {
    const db = getDatabase()
    const totalContent = (db.prepare('SELECT COUNT(*) as count FROM content_pool').get() as { count: number }).count
    const totalAccounts = (db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number }).count
    const totalTasks = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count
    const successTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'success'").get() as { count: number }).count
    const pendingTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status IN ('pending', 'queued')").get() as { count: number }).count
    const activeAccounts = (db.prepare("SELECT COUNT(*) as count FROM accounts WHERE status = 'active'").get() as { count: number }).count

    const successRate = totalTasks > 0 ? Math.round((successTasks / totalTasks) * 100) : 0

    return {
      totalContent,
      totalAccounts,
      totalTasks,
      successTasks,
      pendingTasks,
      activeAccounts,
      successRate
    }
  })

  // ===== Bit浏览器操作 =====
  ipcMain.handle('bit:healthCheck', async () => {
    return bitManager.healthCheck()
  })

  ipcMain.handle('bit:openBrowser', async (_event, profileId: string) => {
    return bitManager.openBrowser(profileId)
  })

  ipcMain.handle('bit:closeBrowser', async (_event, profileId: string) => {
    return bitManager.closeBrowser(profileId)
  })

  ipcMain.handle('bit:getActiveBrowsers', async () => {
    return bitManager.getActiveBrowsers()
  })

  ipcMain.handle('bit:getProfileList', async (_event, page?: number, pageSize?: number) => {
    return bitManager.getProfileList(page, pageSize)
  })

  // ===== 设置 =====
  ipcMain.handle('settings:get', () => {
    return currentSettings
  })

  ipcMain.handle('settings:update', (_event, key: string, value: unknown) => {
    ;(currentSettings as Record<string, unknown>)[key] = value
    syncBitSettings({ [key]: value })
    saveSettings(currentSettings)
    return { success: true }
  })

  ipcMain.handle('settings:save', (_event, settings: Record<string, unknown>) => {
    currentSettings = { ...currentSettings, ...settings } as SystemSettings
    syncBitSettings(settings)
    saveSettings(currentSettings)
    return { success: true }
  })

  ipcMain.handle('settings:testBitConnection', async () => {
    return bitManager.healthCheck()
  })

  // ===== 文件选择对话框 =====
  ipcMain.handle('dialog:selectImages', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })
    return result.filePaths
  })

  // ===== 发布测试 =====
  ipcMain.handle('publish:test', async (_event, params: {
    profileId: string
    title: string
    content: string
    tags: string[]
    imagePaths: string[]
    accountLevel: string
  }) => {
    // 获取所有窗口中的第一个（不依赖焦点状态）
    const allWindows = BrowserWindow.getAllWindows()
    const win = allWindows.length > 0 ? allWindows[0] : null
    console.log(`[publish:test] Window available: ${!!win}, params: profileId=${params.profileId}, images=${params.imagePaths.length}`)

    const sendStep = (data: Record<string, unknown>) => {
      console.log(`[publish:test] Step update: ${JSON.stringify(data)}`)
      try {
        if (win && !win.isDestroyed()) {
          win.webContents.send('publish:step-update', data)
        }
      } catch (e) {
        console.error('[publish:test] Failed to send step update:', e)
      }
    }

    let acquired = false
    try {
      sendStep({ step: 'acquire', status: 'running' })

      const slot = await windowPool.acquire(params.profileId)
      if (!slot) {
        throw new Error('获取浏览器窗口超时')
      }
      acquired = true

      sendStep({ step: 'acquire', status: 'completed', duration: 0 })

      const behavior = new HumanBehaviorEngine()
      const publisher = new XiaohongshuPublisher(slot.page, behavior)

      publisher.setStepCallback((update) => {
        sendStep(update)
      })

      const publishContent: PublishContent = {
        title: params.title,
        content: params.content,
        tags: params.tags,
        imagePaths: params.imagePaths
      }

      console.log(`[publish:test] Starting publish flow...`)
      const result = await publisher.publish(publishContent, params.accountLevel)
      console.log(`[publish:test] Publish result: success=${result.success}, error=${result.error}`)

      // 写入任务记录到数据库（让Dashboard统计能看到）
      // 用直接SQL绕过外键约束（测试发布没有真实的content/account记录）
      try {
        const db = getDatabase()
        const now = new Date().toISOString()
        const status = result.success ? 'success' : 'failed'
        db.prepare(`
          INSERT INTO tasks (account_id, content_id, platform, status, priority, scheduled_at, started_at, finished_at, error_log, result_url)
          VALUES (0, 0, 'xiaohongshu', ?, 0, ?, ?, ?, ?, ?)
        `).run(status, now, now, new Date().toISOString(), result.error || null, result.url || null)
        console.log(`[publish:test] Task record saved (status=${status})`)
      } catch (dbErr) {
        // 如果外键约束失败，临时关闭外键检查再插入
        try {
          const db = getDatabase()
          const now = new Date().toISOString()
          const status = result.success ? 'success' : 'failed'
          db.pragma('foreign_keys = OFF')
          db.prepare(`
            INSERT INTO tasks (account_id, content_id, platform, status, priority, scheduled_at, started_at, finished_at, error_log, result_url)
            VALUES (0, 0, 'xiaohongshu', ?, 0, ?, ?, ?, ?, ?)
          `).run(status, now, now, new Date().toISOString(), result.error || null, result.url || null)
          db.pragma('foreign_keys = ON')
          console.log(`[publish:test] Task record saved (FK off, status=${status})`)
        } catch (e2) {
          console.warn('[publish:test] Failed to save task record:', e2)
        }
      }

      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error(`[publish:test] FATAL ERROR: ${errMsg}`)
      if (error instanceof Error && error.stack) {
        console.error(error.stack)
      }
      sendStep({ step: 'error', status: 'failed', error: errMsg })
      return { success: false, error: errMsg, screenshots: [], steps: [] }
    } finally {
      if (acquired) {
        try {
          await windowPool.release(params.profileId)
        } catch (e) {
          console.error('[publish:test] Release error:', e)
        }
      }
    }
  })

  // ===== 窗口池状态 =====
  ipcMain.handle('windowPool:status', () => {
    return windowPool.getStatus()
  })
}
