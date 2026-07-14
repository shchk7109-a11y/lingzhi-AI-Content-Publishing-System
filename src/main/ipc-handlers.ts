import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getDatabase } from '../database/db'
import { ContentDao, AccountDao, MatchRecordDao, TaskDao, MatchRuleDao } from '../database/dao'
import { BitBrowserManager } from '../core/BitBrowserManager'
import { WindowPool } from '../core/WindowPool'
import { ProxyManager } from '../core/ProxyManager'
import type { StickyAccountLike } from '../core/ProxyManager'
import { HumanBehaviorEngine } from '../core/HumanBehaviorEngine'
import { AccountAliasService } from '../core/accounts/AccountAliasService'
import { TaskPackageImporter } from '../core/task-package/TaskPackageImporter'
import { TaskPackageReader } from '../core/task-package/TaskPackageReader'
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
const accountAliasService = new AccountAliasService()
const taskPackageReader = new TaskPackageReader()
const taskPackageImporter = new TaskPackageImporter()

// 内存中的设置（启动时用默认值，可通过settings:update修改）
let currentSettings: SystemSettings = { ...DEFAULT_SETTINGS } as SystemSettings

const proxyManager = new ProxyManager(currentSettings.proxyGateway)

export function getProxyManager(): ProxyManager {
  return proxyManager
}

/**
 * 把数据库账号行转换为派生粘性代理所需的最小结构。
 */
function toStickyAccount(row: Record<string, unknown>): StickyAccountLike {
  let proxyConfig: Record<string, unknown> | null = null
  if (typeof row.proxy_config === 'string' && row.proxy_config.trim()) {
    try {
      proxyConfig = JSON.parse(row.proxy_config) as Record<string, unknown>
    } catch {
      proxyConfig = null
    }
  } else if (row.proxy_config && typeof row.proxy_config === 'object') {
    proxyConfig = row.proxy_config as Record<string, unknown>
  }

  return {
    id: Number(row.id),
    bit_profile_id: (row.bit_profile_id as string) || null,
    account_alias: (row.account_alias as string) || null,
    region: (row.region as string) || null,
    proxy_config: proxyConfig
  }
}

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

  ipcMain.handle('accounts:generateAlias', (_event, input: { platform: string; bloggerId: string; sequence: number }) => {
    return accountAliasService.generateAlias(input)
  })

  ipcMain.handle('taskPackage:preview', (_event, packageDir: string) => {
    return taskPackageReader.read(packageDir)
  })

  ipcMain.handle('taskPackage:import', (_event, packageDir: string) => {
    const readResult = taskPackageReader.read(packageDir)
    if (!readResult.ok) {
      return {
        success: false,
        partialSuccess: false,
        importedContent: 0,
        importedTasks: 0,
        skippedRows: 0,
        errors: readResult.errors
      }
    }

    const importResult = taskPackageImporter.import(readResult.value)
    const hasImportedRows = importResult.importedContent > 0 || importResult.importedTasks > 0
    return {
      success: hasImportedRows || importResult.errors.length === 0,
      partialSuccess: hasImportedRows && importResult.errors.length > 0,
      ...importResult
    }
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

  ipcMain.handle('db:tasks:confirm', (_event, id: number) => {
    const confirmed = taskDao.confirmTask(id)
    return { success: confirmed, confirmed }
  })

  ipcMain.handle('db:tasks:pendingConfirmation', () => {
    return taskDao.getPendingConfirmation()
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
    (currentSettings as Record<string, unknown>)[key] = value

    // 如果更新了Bit端口，同步到BitBrowserManager
    if (key === 'bitApiPort' && typeof value === 'number') {
      bitManager.updatePort(value)
    }

    // 代理网关配置联动
    if (key === 'proxyGateway' && value && typeof value === 'object') {
      proxyManager.setGateway(value as Parameters<ProxyManager['setGateway']>[0])
    }

    return { success: true }
  })

  ipcMain.handle('settings:save', (_event, settings: Record<string, unknown>) => {
    currentSettings = { ...currentSettings, ...settings } as SystemSettings

    if (settings.bitApiPort && typeof settings.bitApiPort === 'number') {
      bitManager.updatePort(settings.bitApiPort)
    }

    if (settings.proxyGateway && typeof settings.proxyGateway === 'object') {
      proxyManager.setGateway(settings.proxyGateway as Parameters<ProxyManager['setGateway']>[0])
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

  ipcMain.handle('dialog:selectDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0] || null
  })

  // ===== 发布测试 =====
  ipcMain.handle('publish:test', async (_event, params: {
    profileId: string
    accountId?: number
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

    // 若指定账号：派生粘性代理，开窗前下发；账号处于熔断中则直接拒绝
    let stickyProxy = null
    let stickyAccount: StickyAccountLike | null = null
    if (params.accountId) {
      const row = accountDao.getById(params.accountId)
      if (row) {
        stickyAccount = toStickyAccount(row)
        const accountKey = stickyAccount.bit_profile_id || `acc${stickyAccount.id}`
        if (proxyManager.isAccountTripped(accountKey)) {
          const errMsg = '该账号代理处于熔断冷却中，暂不发布'
          sendStep({ step: 'proxy', status: 'failed', error: errMsg })
          return { success: false, error: errMsg, screenshots: [], steps: [] }
        }
        stickyProxy = proxyManager.buildStickyProxy(stickyAccount)
      }
    }

    let acquired = false
    try {
      sendStep({ step: 'acquire', status: 'running' })

      const slot = await windowPool.acquire(params.profileId, { proxy: stickyProxy })
      if (!slot) {
        throw new Error('获取浏览器窗口超时')
      }
      acquired = true

      sendStep({ step: 'acquire', status: 'completed', duration: 0 })

      // 出口IP校验：确认发帖浏览器走的是绑定的固定出口
      if (stickyProxy && proxyManager.getGateway().ipCheckUrl) {
        sendStep({ step: 'verify_ip', status: 'running' })
        const ipResult = await proxyManager.verifyExitIp(slot.page, stickyAccount?.region || undefined)
        if (!ipResult.ok) {
          const accountKey = stickyAccount?.bit_profile_id || `acc${stickyAccount?.id}`
          proxyManager.reportAccountFailure(accountKey)
          throw new Error(`出口IP校验未通过: ${ipResult.error}`)
        }
        if (ipResult.cityMatched === false) {
          console.warn(`[Publish] 出口城市(${ipResult.city})与账号region(${stickyAccount?.region})不一致`)
        }
        sendStep({
          step: 'verify_ip',
          status: 'completed',
          duration: 0,
          error: undefined
        })
        console.log(`[Publish] 出口IP: ${ipResult.ip} 城市: ${ipResult.city}`)
      }

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

      // 回报账号级熔断计数
      if (stickyAccount) {
        const accountKey = stickyAccount.bit_profile_id || `acc${stickyAccount.id}`
        if (result.success) {
          proxyManager.reportAccountSuccess(accountKey)
        } else {
          proxyManager.reportAccountFailure(accountKey)
        }
      }

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

  // ===== 代理（住宅粘性会话） =====

  // 派生某账号的粘性代理预览（不联网，密码打码）
  ipcMain.handle('proxy:preview', (_event, accountId: number) => {
    const row = accountDao.getById(accountId)
    if (!row) return { ok: false, error: '账号不存在' }

    try {
      const proxy = proxyManager.buildStickyProxy(toStickyAccount(row))
      if (!proxy) return { ok: false, error: '未配置网关且账号无固定代理' }
      return {
        ok: true,
        proxy: { ...proxy, password: proxy.password ? '******' : '' }
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 端到端诊断：派生 → 下发Bit → 开窗 → 校验出口IP → 关窗
  ipcMain.handle('proxy:checkAccount', async (_event, accountId: number) => {
    const row = accountDao.getById(accountId)
    if (!row) return { ok: false, error: '账号不存在' }

    const account = toStickyAccount(row)
    const profileId = account.bit_profile_id
    if (!profileId) return { ok: false, error: '账号未绑定 Bit 指纹浏览器(bit_profile_id)' }

    let proxy = null
    try {
      proxy = proxyManager.buildStickyProxy(account)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
    if (!proxy) return { ok: false, error: '未配置网关且账号无固定代理' }

    let acquired = false
    try {
      const slot = await windowPool.acquire(profileId, { proxy })
      if (!slot) return { ok: false, error: '获取浏览器窗口超时' }
      acquired = true

      const ipResult = await proxyManager.verifyExitIp(slot.page, account.region || undefined)
      return {
        ok: ipResult.ok,
        sessionId: proxy.sessionId,
        exitIp: ipResult.ip,
        city: ipResult.city,
        cityMatched: ipResult.cityMatched,
        error: ipResult.error
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    } finally {
      if (acquired) {
        try {
          await windowPool.release(profileId)
        } catch { /* ignore */ }
      }
    }
  })

  ipcMain.handle('proxy:poolStats', () => {
    return proxyManager.getPoolStats()
  })

  ipcMain.handle('proxy:batchImport', (_event, proxies: Array<{ ip: string; port: number; protocol?: string; city?: string; provider?: string; type?: string }>) => {
    const imported = proxyManager.batchImport(proxies)
    return { success: true, imported }
  })
}
