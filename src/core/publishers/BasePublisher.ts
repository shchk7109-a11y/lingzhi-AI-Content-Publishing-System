import type { Page } from 'puppeteer-core'
import type { ContentItem, Account, Task } from '../../shared/types'
import { PublishStep } from '../../shared/types'
import { HumanBehaviorEngine } from '../HumanBehaviorEngine'
import { StealthInjector } from '../StealthInjector'
import { CrashRecovery } from '../CrashRecovery'

export interface PublishResult {
  success: boolean
  resultUrl?: string
  screenshotPath?: string
  error?: string
}

/**
 * 发布器基类
 * 定义通用发布流程接口，具体平台继承并实现
 */
export abstract class BasePublisher {
  protected page: Page
  protected humanEngine: HumanBehaviorEngine
  protected stealthInjector: StealthInjector
  protected crashRecovery: CrashRecovery

  constructor(page: Page) {
    this.page = page
    this.humanEngine = new HumanBehaviorEngine(page)
    this.stealthInjector = new StealthInjector()
    this.crashRecovery = new CrashRecovery()
  }

  /**
   * 完整发布流程
   */
  async publish(content: ContentItem, account: Account, task: Task): Promise<PublishResult> {
    try {
      // 注入stealth脚本
      await this.stealthInjector.applyIfNeeded(this.page)

      // 暖号阶段
      this.crashRecovery.recordStep(task.id, PublishStep.WARMUP)
      await this.warmup()

      // 导航到发布页
      this.crashRecovery.recordStep(task.id, PublishStep.NAVIGATE)
      await this.navigateToPublish()

      // 上传媒体
      this.crashRecovery.recordStep(task.id, PublishStep.UPLOAD_MEDIA)
      await this.uploadMedia(content)

      // 输入标题
      this.crashRecovery.recordStep(task.id, PublishStep.INPUT_TITLE)
      await this.inputTitle(content.title)

      // 输入正文
      this.crashRecovery.recordStep(task.id, PublishStep.INPUT_CONTENT)
      await this.inputContent(content.content)

      // 添加标签
      this.crashRecovery.recordStep(task.id, PublishStep.ADD_TAGS)
      await this.addTags(content.tags)

      // 点击发布
      this.crashRecovery.recordStep(task.id, PublishStep.PUBLISH)
      const resultUrl = await this.clickPublish()

      // 冷却期
      this.crashRecovery.recordStep(task.id, PublishStep.COOLDOWN)
      await this.cooldown()

      return { success: true, resultUrl }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      return { success: false, error: errMsg }
    }
  }

  /** 暖号：浏览首页模拟正常用户行为 */
  protected async warmup(): Promise<void> {
    await this.humanEngine.warmup()
  }

  /** 导航到发布页面 */
  protected abstract navigateToPublish(): Promise<void>

  /** 上传图片/视频媒体 */
  protected abstract uploadMedia(content: ContentItem): Promise<void>

  /** 输入标题 */
  protected abstract inputTitle(title: string): Promise<void>

  /** 输入正文 */
  protected abstract inputContent(content: string): Promise<void>

  /** 添加标签 */
  protected abstract addTags(tags: string[]): Promise<void>

  /** 点击发布按钮并返回发布结果URL */
  protected abstract clickPublish(): Promise<string>

  /** 发布后冷却期 */
  protected async cooldown(): Promise<void> {
    await this.humanEngine.randomDelay(5000, 15000)
  }

  /** 截图 */
  protected async takeScreenshot(name: string): Promise<string> {
    // TODO: implement - 保存截图到screenshots目录
    void name
    return ''
  }
}
