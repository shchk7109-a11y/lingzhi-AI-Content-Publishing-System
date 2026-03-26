import type { Page } from 'puppeteer-core'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { HumanBehaviorEngine } from '../HumanBehaviorEngine'
import { StealthInjector } from '../StealthInjector'

export interface PublishContent {
  title: string
  content: string
  tags: string[]
  imagePaths: string[]
  videoPath?: string
}

export interface StepLog {
  step: string
  startTime: number
  endTime: number
  success: boolean
  error?: string
  screenshotPath?: string
}

export interface PublishResult {
  success: boolean
  url?: string
  error?: string
  screenshots: string[]
  steps: StepLog[]
}

// 步骤进度回调
export type StepCallback = (update: {
  step: string
  status: 'running' | 'completed' | 'failed'
  duration?: number
  screenshotPath?: string
  error?: string
}) => void

/**
 * 发布器基类 — 模板方法模式
 */
export abstract class BasePublisher {
  protected page: Page
  protected behavior: HumanBehaviorEngine
  protected stealthInjector: StealthInjector
  protected screenshotDir: string
  protected onStepUpdate?: StepCallback

  constructor(page: Page, behavior: HumanBehaviorEngine, screenshotDir?: string) {
    this.page = page
    this.behavior = behavior
    this.stealthInjector = new StealthInjector()

    this.screenshotDir = screenshotDir ||
      path.join(app.getPath('userData'), 'screenshots', `task_${Date.now()}`)

    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true })
    }
  }

  /**
   * 设置步骤进度回调
   */
  setStepCallback(cb: StepCallback): void {
    this.onStepUpdate = cb
  }

  /**
   * 执行完整发布流程
   */
  async publish(content: PublishContent, accountLevel: string): Promise<PublishResult> {
    const steps: StepLog[] = []
    const screenshots: string[] = []

    // 注入stealth
    await this.stealthInjector.applyIfNeeded(this.page)

    const stepNames = [
      { name: 'warmup', label: '预热浏览', fn: () => this.warmup(accountLevel) },
      { name: 'navigate', label: '导航到创作页', fn: () => this.navigateToPublish() },
      {
        name: 'upload_media', label: '上传媒体',
        fn: () => this.uploadMedia(content.imagePaths, !!content.videoPath)
      },
      { name: 'input_title', label: '填写标题', fn: () => this.inputTitle(content.title) },
      { name: 'input_content', label: '填写正文', fn: () => this.inputContent(content.content) },
      { name: 'add_tags', label: '添加标签', fn: () => this.addTags(content.tags) },
      { name: 'publish', label: '发布', fn: () => this.clickPublish() },
      { name: 'cooldown', label: '冷却浏览', fn: () => this.cooldown() }
    ]

    let publishUrl: string | null = null
    let lastError: string | undefined

    for (const stepDef of stepNames) {
      const stepLog = await this.executeStep(stepDef.name, async () => {
        const result = await stepDef.fn()
        // clickPublish 返回URL
        if (stepDef.name === 'publish' && typeof result === 'string') {
          publishUrl = result
        }
      })

      steps.push(stepLog)
      if (stepLog.screenshotPath) screenshots.push(stepLog.screenshotPath)

      if (!stepLog.success) {
        lastError = stepLog.error
        break
      }
    }

    const allSuccess = steps.every((s) => s.success)

    return {
      success: allSuccess,
      url: publishUrl || undefined,
      error: lastError,
      screenshots,
      steps
    }
  }

  /**
   * 执行单个步骤，前后截图，记录耗时
   */
  protected async executeStep(stepName: string, fn: () => Promise<void>): Promise<StepLog> {
    const startTime = Date.now()
    this.onStepUpdate?.({ step: stepName, status: 'running' })

    try {
      await fn()
      const endTime = Date.now()
      const screenshotPath = await this.takeScreenshot(`${stepName}_done`)

      this.onStepUpdate?.({
        step: stepName,
        status: 'completed',
        duration: endTime - startTime,
        screenshotPath
      })

      return { step: stepName, startTime, endTime, success: true, screenshotPath }
    } catch (error) {
      const endTime = Date.now()
      const errMsg = error instanceof Error ? error.message : String(error)
      const screenshotPath = await this.takeScreenshot(`${stepName}_error`)

      this.onStepUpdate?.({
        step: stepName,
        status: 'failed',
        duration: endTime - startTime,
        screenshotPath,
        error: errMsg
      })

      return { step: stepName, startTime, endTime, success: false, error: errMsg, screenshotPath }
    }
  }

  /**
   * 截图并保存
   */
  protected async takeScreenshot(name: string): Promise<string> {
    try {
      const filename = `${name}_${Date.now()}.png`
      const filepath = path.join(this.screenshotDir, filename)
      await this.page.screenshot({ path: filepath, fullPage: false })
      return filepath
    } catch {
      return ''
    }
  }

  /**
   * 在多个选择器中找到第一个可用的元素
   */
  protected async findElement(selectors: string[]): Promise<string | null> {
    for (const sel of selectors) {
      const el = await this.page.$(sel)
      if (el) return sel
    }
    return null
  }

  // 子类实现
  protected abstract warmup(accountLevel: string): Promise<void>
  protected abstract navigateToPublish(): Promise<void>
  protected abstract uploadMedia(paths: string[], isVideo: boolean): Promise<void>
  protected abstract inputTitle(title: string): Promise<void>
  protected abstract inputContent(content: string): Promise<void>
  protected abstract addTags(tags: string[]): Promise<void>
  protected abstract clickPublish(): Promise<string | null>
  protected abstract cooldown(): Promise<void>
}
