import type { Page } from 'puppeteer-core'
import { WindowPool } from './WindowPool'
import { ProxyManager, type StickyAccountLike } from './ProxyManager'
import { HumanBehaviorEngine } from './HumanBehaviorEngine'
import { XiaohongshuPublisher } from './publishers/XiaohongshuPublisher'
import { DouyinPublisher } from './publishers/DouyinPublisher'
import type { BasePublisher, PublishContent } from './publishers/BasePublisher'
import { XiaohongshuInteractionAdapter, type InteractionAction } from './interactions/XiaohongshuInteractionAdapter'
import type { ContentDao, AccountDao, TaskDao, PublishLogDao } from '../database/dao'
import type { Task } from '../shared/types'

export interface TaskExecutorDaos {
  content: ContentDao
  account: AccountDao
  task: TaskDao
  publishLog: PublishLogDao
}

// 执行进度回调（转发给渲染层展示）
export type ExecutorProgress = (taskId: number, update: Record<string, unknown>) => void

const INTERACTION_ACTIONS = new Set(['comment', 'favorite', 'collect', 'browse'])

function sqlNow(): string {
  // 与 sqlite datetime('now') 一致，使用 UTC 'YYYY-MM-DD HH:MM:SS'
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v))
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
  } catch {
    return []
  }
}

/**
 * 任务执行器
 * 把一条待执行任务完整跑通：派生代理→下发→开窗→出口IP校验→发布/互动→回写状态。
 * execute 内部全程 try/catch，保证绝不向调度器抛出异常。
 */
export class TaskExecutor {
  constructor(
    private readonly windowPool: WindowPool,
    private readonly proxyManager: ProxyManager,
    private readonly daos: TaskExecutorDaos,
    private readonly onProgress?: ExecutorProgress
  ) {}

  async execute(task: Task): Promise<void> {
    const taskId = task.id
    const sendStep = (update: Record<string, unknown>): void => this.onProgress?.(taskId, update)

    this.daos.task.updateStatus(taskId, 'running', { started_at: sqlNow() })

    // 解析账号
    const accountRow = this.daos.account.getById(task.account_id)
    if (!accountRow) {
      return this.fail(taskId, '账号不存在')
    }
    const account = this.toStickyAccount(accountRow)
    const profileId = account.bit_profile_id
    if (!profileId) {
      return this.fail(taskId, '账号未绑定 Bit 指纹浏览器(bit_profile_id)')
    }
    const accountKey = profileId

    // 熔断检查
    if (this.proxyManager.isAccountTripped(accountKey)) {
      return this.fail(taskId, '该账号代理处于熔断冷却中')
    }

    // 派生粘性代理
    let proxy = null
    try {
      proxy = this.proxyManager.buildStickyProxy(account)
    } catch (error) {
      return this.fail(taskId, this.msg(error))
    }

    let acquired = false
    try {
      sendStep({ step: 'acquire', status: 'running' })
      const slot = await this.windowPool.acquire(profileId, { proxy })
      if (!slot) {
        return this.fail(taskId, '获取浏览器窗口超时')
      }
      acquired = true
      sendStep({ step: 'acquire', status: 'completed' })

      // 出口IP校验
      if (proxy && this.proxyManager.getGateway().ipCheckUrl) {
        sendStep({ step: 'verify_ip', status: 'running' })
        const ipResult = await this.proxyManager.verifyExitIp(slot.page, account.region || undefined)
        if (!ipResult.ok) {
          this.proxyManager.reportAccountFailure(accountKey)
          return this.fail(taskId, `出口IP校验未通过: ${ipResult.error}`)
        }
        sendStep({ step: 'verify_ip', status: 'completed' })
      }

      const behavior = new HumanBehaviorEngine()
      const accountLevel = String(accountRow.account_level || 'new')

      if (task.action_type === 'publish') {
        await this.runPublish(task, slot.page, behavior, accountLevel, accountKey, sendStep)
      } else if (INTERACTION_ACTIONS.has(task.action_type)) {
        await this.runInteraction(task, slot.page, behavior, accountKey)
      } else {
        return this.fail(taskId, `不支持的 action_type: ${task.action_type}`)
      }
    } catch (error) {
      this.proxyManager.reportAccountFailure(accountKey)
      this.fail(taskId, this.msg(error))
    } finally {
      if (acquired) {
        try {
          await this.windowPool.release(profileId)
        } catch { /* ignore */ }
      }
    }
  }

  /**
   * 执行发布任务
   */
  private async runPublish(
    task: Task,
    page: Page,
    behavior: HumanBehaviorEngine,
    accountLevel: string,
    accountKey: string,
    sendStep: (u: Record<string, unknown>) => void
  ): Promise<void> {
    const taskId = task.id
    if (task.content_id == null) {
      return this.fail(taskId, '发布任务缺少 content_id')
    }
    const contentRow = this.daos.content.getById(task.content_id)
    if (!contentRow) {
      return this.fail(taskId, '内容不存在')
    }

    const publishContent: PublishContent = {
      title: String(contentRow.title || ''),
      content: String(contentRow.content || ''),
      tags: parseJsonArray(contentRow.tags),
      imagePaths: parseJsonArray(contentRow.image_paths),
      videoPath: contentRow.video_path ? String(contentRow.video_path) : undefined
    }

    const publisher: BasePublisher =
      task.platform === 'douyin'
        ? new DouyinPublisher(page, behavior)
        : new XiaohongshuPublisher(page, behavior)

    publisher.setStepCallback((update) => {
      sendStep(update)
      this.daos.task.updateLastStep(taskId, update.step)
    })

    const result = await publisher.publish(publishContent, accountLevel)

    // 记录每步日志
    for (const step of result.steps) {
      this.daos.publishLog.insert({
        task_id: taskId,
        step: step.step,
        action: 'publish',
        duration_ms: step.endTime - step.startTime,
        screenshot_path: step.screenshotPath,
        error: step.error
      })
    }

    const lastScreenshot = result.screenshots[result.screenshots.length - 1]

    if (result.success) {
      this.daos.task.updateStatus(taskId, 'success', {
        finished_at: sqlNow(),
        result_url: result.url,
        screenshot_path: lastScreenshot
      })
      this.daos.content.updateStatus(task.content_id, 'published')
      this.daos.account.updatePublishCount(task.account_id)
      this.proxyManager.reportAccountSuccess(accountKey)
    } else {
      this.daos.task.updateStatus(taskId, 'failed', {
        finished_at: sqlNow(),
        error_log: result.error || '发布失败',
        screenshot_path: lastScreenshot
      })
      this.proxyManager.reportAccountFailure(accountKey)
    }
  }

  /**
   * 执行互动任务（评论/点赞/收藏/浏览）
   */
  private async runInteraction(
    task: Task,
    page: Page,
    behavior: HumanBehaviorEngine,
    accountKey: string
  ): Promise<void> {
    const taskId = task.id
    const adapter = new XiaohongshuInteractionAdapter(behavior)
    const result = await adapter.run({
      page,
      action: task.action_type as InteractionAction,
      targetUrl: task.target_note_url,
      commentText: task.comment_text
    })

    if (result.success) {
      this.daos.task.updateStatus(taskId, 'success', { finished_at: sqlNow() })
      this.proxyManager.reportAccountSuccess(accountKey)
    } else {
      const lastError = result.steps.find((s) => !s.success)?.error
      this.daos.task.updateStatus(taskId, 'failed', {
        finished_at: sqlNow(),
        error_log: lastError || '互动失败'
      })
      this.proxyManager.reportAccountFailure(accountKey)
    }
  }

  private toStickyAccount(row: Record<string, unknown>): StickyAccountLike {
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

  private fail(taskId: number, error: string): void {
    this.daos.task.updateStatus(taskId, 'failed', { finished_at: sqlNow(), error_log: error })
    this.onProgress?.(taskId, { step: 'error', status: 'failed', error })
  }

  private msg(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
