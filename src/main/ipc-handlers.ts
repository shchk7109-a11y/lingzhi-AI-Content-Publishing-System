import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getDatabase } from '../database/db'
import { ContentDao, AccountDao, MatchRecordDao, TaskDao, MatchRuleDao } from '../database/dao'
import { BitBrowserManager } from '../core/BitBrowserManager'
import { WindowPool } from '../core/WindowPool'
import { HumanBehaviorEngine } from '../core/HumanBehaviorEngine'
import { XiaohongshuPublisher } from '../core/publishers/XiaohongshuPublisher'
import type { PublishContent } from '../core/publishers/BasePublisher'
import { DEFAULT_SETTINGS } from '../shared/constants'
import type { SystemSettings } from '../shared/types'

const contentDao = new ContentDao()
const accountDao = new AccountDao()
const matchRecordDao = new MatchRecordDao()
const taskDao = new TaskDao()
const matchRuleDao = new MatchRuleDao()
const bitManager = new BitBrowserManager()
const windowPool = new WindowPool(bitManager, 1)

// 内存中的设置（启动时用默认值，可通过settings:update修改）
let currentSettings: SystemSettings = { ...DEFAULT_SETTINGS } as SystemSettings

export function getBitManager(): BitBrowserManager {
  return bitManager
}

export function getWindowPool(): WindowPool {
  return windowPool
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

    // 如果更新了Bit端口，同步到BitBrowserManager
    if (key === 'bitApiPort' && typeof value === 'number') {
      bitManager.updatePort(value)
    }

    return { success: true }
  })

  ipcMain.handle('settings:save', (_event, settings: Record<string, unknown>) => {
    currentSettings = { ...currentSettings, ...settings } as SystemSettings

    if (settings.bitApiPort && typeof settings.bitApiPort === 'number') {
      bitManager.updatePort(settings.bitApiPort)
    }

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
    const win = BrowserWindow.getFocusedWindow()

    const sendStep = (data: Record<string, unknown>) => {
      win?.webContents.send('publish:step-update', data)
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

      // 设置步骤进度回调
      publisher.setStepCallback((update) => {
        sendStep(update)
      })

      const publishContent: PublishContent = {
        title: params.title,
        content: params.content,
        tags: params.tags,
        imagePaths: params.imagePaths
      }

      const result = await publisher.publish(publishContent, params.accountLevel)

      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      sendStep({ step: 'error', status: 'failed', error: errMsg })
      return { success: false, error: errMsg, screenshots: [], steps: [] }
    } finally {
      if (acquired) {
        try {
          await windowPool.release(params.profileId)
        } catch { /* ignore */ }
      }
    }
  })

  // ===== 窗口池状态 =====
  ipcMain.handle('windowPool:status', () => {
    return windowPool.getStatus()
  })
}
