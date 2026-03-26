import puppeteer, { Browser, Page } from 'puppeteer-core'
import { BitBrowserManager } from './BitBrowserManager'

interface WindowSlot {
  profileId: string
  browser: Browser
  page: Page
  startTime: number
  status: 'active' | 'releasing'
}

type WaitResolver = (slot: WindowSlot | null) => void

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
  private readonly minIntervalMs = 30000 // 窗口间最小间隔30秒
  private readonly staleTimeoutMs = 600000 // 10分钟超时

  constructor(bitManager: BitBrowserManager, maxConcurrency: number = 1) {
    this.bitManager = bitManager
    this.maxConcurrency = maxConcurrency
  }

  /**
   * 申请一个窗口（信号量acquire）
   * - 活跃数 < maxConcurrency → 立即分配
   * - 否则排队等待，超时5分钟返回null
   */
  async acquire(profileId: string): Promise<{ browser: Browser; page: Page } | null> {
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

      // 排队等待，超时5分钟
      const slot = await Promise.race([
        new Promise<WindowSlot | null>((resolve) => {
          this.waitQueue.push(resolve)
        }),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 300000)
        })
      ])

      if (!slot) {
        console.warn('[WindowPool] Acquire timed out after 5 minutes')
        return null
      }

      return { browser: slot.browser, page: slot.page }
    }

    // 实际创建窗口
    try {
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

    // 通知等待队列中的下一个
    if (this.waitQueue.length > 0) {
      const nextResolver = this.waitQueue.shift()!
      // 不直接resolve旧slot，让等待者重新acquire
      nextResolver(null)
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

    const profileIds = Array.from(this.activeSlots.keys())
    for (const id of profileIds) {
      await this.release(id)
    }

    // 拒绝所有等待中的请求
    while (this.waitQueue.length > 0) {
      const resolver = this.waitQueue.shift()!
      resolver(null)
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
