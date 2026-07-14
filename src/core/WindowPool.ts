import puppeteer, { Browser, Page } from 'puppeteer-core'
import { BitBrowserManager } from './BitBrowserManager'
import type { StickyProxy } from '../shared/types'

export interface AcquireOptions {
  // 开窗前把粘性代理下发到该 Bit profile（"一号一IP"下发链路）
  proxy?: StickyProxy | null
}

interface WindowSlot {
  profileId: string
  browser: Browser
  page: Page
  startTime: number
  status: 'active' | 'releasing'
}

// 唤醒回调：granted=true 表示有空位可重新申请，false 表示池关闭应放弃
type WaitResolver = (granted: boolean) => void

/**
 * 并发窗口池
 * 信号量机制 + 资源监控
 */
export class WindowPool {
  private maxConcurrency: number
  private activeSlots: Map<string, WindowSlot> = new Map()
  private bitManager: BitBrowserManager
  private waitQueue: WaitResolver[] = []
  private lastAcquireTime = 0
  private readonly minIntervalMs: number // 窗口间最小间隔，默认30秒
  private readonly staleTimeoutMs = 600000 // 10分钟超时
  private readonly acquireTimeoutMs: number // 排队等待超时，默认5分钟

  constructor(
    bitManager: BitBrowserManager,
    maxConcurrency: number = 1,
    options?: { minIntervalMs?: number; acquireTimeoutMs?: number }
  ) {
    this.bitManager = bitManager
    this.maxConcurrency = Math.max(1, maxConcurrency)
    this.minIntervalMs = options?.minIntervalMs ?? 30000
    this.acquireTimeoutMs = options?.acquireTimeoutMs ?? 300000
  }

  /**
   * 动态调整最大并发数（Settings联动）
   * 缩小时不强制关闭已活跃窗口，仅影响后续申请
   */
  setMaxConcurrency(n: number): void {
    this.maxConcurrency = Math.max(1, Math.floor(n))
    console.log(`[WindowPool] Max concurrency set to ${this.maxConcurrency}`)
    // 若放宽了并发，唤醒等待者尝试获取
    while (this.activeSlots.size < this.maxConcurrency && this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()
      if (next) next(true)
    }
  }

  /**
   * 申请一个窗口（信号量acquire）
   * - 活跃数 < maxConcurrency → 立即分配
   * - 否则排队等待，超时5分钟返回null
   */
  async acquire(profileId: string, options?: AcquireOptions): Promise<{ browser: Browser; page: Page } | null> {
    // 等待最小间隔
    const now = Date.now()
    const timeSinceLastAcquire = now - this.lastAcquireTime
    if (this.lastAcquireTime > 0 && timeSinceLastAcquire < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - timeSinceLastAcquire
      console.log(`[WindowPool] Waiting ${waitTime}ms before acquiring (min interval)`)
      await new Promise((r) => setTimeout(r, waitTime))
    }

    // 信号量检查
    if (this.activeSlots.size >= this.maxConcurrency) {
      console.log(`[WindowPool] Max concurrency reached (${this.maxConcurrency}), queueing...`)

      // 排队等待空位；超时返回false
      const gotSlot = await this.waitForSlot()
      if (!gotSlot) {
        console.warn('[WindowPool] Acquire timed out after 5 minutes')
        return null
      }

      // 被唤醒（有空位了）→ 重新完整申请，为自己的 profileId 创建窗口
      // 注意：不能复用别人的窗口，每个 profileId 必须开自己的指纹浏览器
      return this.acquire(profileId, options)
    }

    // 实际创建窗口
    try {
      // 开窗前下发粘性代理，确保该账号走绑定的固定出口IP
      if (options?.proxy) {
        console.log(`[WindowPool] Applying sticky proxy for profile ${profileId} (session: ${options.proxy.sessionId})`)
        await this.bitManager.updateProfileProxy(profileId, {
          type: options.proxy.protocol,
          host: options.proxy.host,
          port: options.proxy.port,
          username: options.proxy.username,
          password: options.proxy.password
        })
      }

      console.log(`[WindowPool] Opening browser for profile ${profileId}...`)
      const { ws } = await this.bitManager.openBrowser(profileId)

      console.log(`[WindowPool] Connecting puppeteer to ${ws}`)
      const browser = await puppeteer.connect({
        browserWSEndpoint: ws,
        defaultViewport: null
      })

      // 获取第一个page或新建tab
      const pages = await browser.pages()
      const page = pages.length > 0 ? pages[0] : await browser.newPage()

      const slot: WindowSlot = {
        profileId,
        browser,
        page,
        startTime: Date.now(),
        status: 'active'
      }

      this.activeSlots.set(profileId, slot)
      this.lastAcquireTime = Date.now()

      console.log(`[WindowPool] Acquired: ${profileId} (active: ${this.activeSlots.size}/${this.maxConcurrency})`)

      return { browser, page }
    } catch (error) {
      console.error(`[WindowPool] Failed to acquire ${profileId}:`, error)
      throw error
    }
  }

  /**
   * 排队等待空位。
   * @returns true=有空位可申请；false=超时
   * 超时或被唤醒后都会把自己从等待队列移除，避免泄漏与"唤醒已超时者"。
   */
  private waitForSlot(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false

      const resolver: WaitResolver = (granted: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.removeFromQueue(resolver)
        resolve(granted)
      }

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        this.removeFromQueue(resolver)
        resolve(false)
      }, this.acquireTimeoutMs)

      this.waitQueue.push(resolver)
    })
  }

  private removeFromQueue(resolver: WaitResolver): void {
    const idx = this.waitQueue.indexOf(resolver)
    if (idx >= 0) this.waitQueue.splice(idx, 1)
  }

  /**
   * 释放窗口
   */
  async release(profileId: string): Promise<void> {
    const slot = this.activeSlots.get(profileId)
    if (!slot) {
      console.warn(`[WindowPool] Profile ${profileId} not found in pool`)
      return
    }

    slot.status = 'releasing'

    try {
      // 断开puppeteer连接（不关闭浏览器进程）
      if (slot.browser.isConnected()) {
        slot.browser.disconnect()
      }
    } catch {
      // 忽略断开连接错误
    }

    try {
      // 通过Bit API关闭浏览器窗口
      await this.bitManager.closeBrowser(profileId)
    } catch (error) {
      console.warn(`[WindowPool] Failed to close bit browser ${profileId}:`, error)
    }

    this.activeSlots.delete(profileId)
    console.log(`[WindowPool] Released: ${profileId} (active: ${this.activeSlots.size}/${this.maxConcurrency})`)

    // 通知等待队列中的下一个：有空位了，让其重新acquire
    if (this.waitQueue.length > 0) {
      const nextResolver = this.waitQueue.shift()!
      nextResolver(true)
    }
  }

  /**
   * 获取当前活跃窗口数
   */
  getActiveCount(): number {
    return this.activeSlots.size
  }

  /**
   * 获取池状态
   */
  getStatus(): {
    maxConcurrency: number
    activeCount: number
    activeProfiles: string[]
    waitingCount: number
  } {
    return {
      maxConcurrency: this.maxConcurrency,
      activeCount: this.activeSlots.size,
      activeProfiles: Array.from(this.activeSlots.keys()),
      waitingCount: this.waitQueue.length
    }
  }

  /**
   * 强制释放所有窗口
   */
  async releaseAll(): Promise<void> {
    console.log(`[WindowPool] Releasing all ${this.activeSlots.size} windows...`)

    // 先拒绝所有等待者（池关闭，放弃），避免 release 过程中把它们唤醒去重试
    while (this.waitQueue.length > 0) {
      const resolver = this.waitQueue.shift()!
      resolver(false)
    }

    const profileIds = Array.from(this.activeSlots.keys())
    for (const id of profileIds) {
      await this.release(id)
    }
  }

  /**
   * 清理超时窗口（活跃超过10分钟）
   */
  async cleanupStale(): Promise<number> {
    const now = Date.now()
    let cleaned = 0

    for (const [profileId, slot] of this.activeSlots) {
      if (now - slot.startTime > this.staleTimeoutMs) {
        console.warn(`[WindowPool] Cleaning stale window: ${profileId} (age: ${Math.round((now - slot.startTime) / 1000)}s)`)
        await this.release(profileId)
        cleaned++
      }
    }

    return cleaned
  }
}
