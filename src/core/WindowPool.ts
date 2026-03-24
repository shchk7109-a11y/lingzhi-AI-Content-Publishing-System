import type { Browser } from 'puppeteer-core'
import { BitBrowserManager } from './BitBrowserManager'
import type { BitBrowserWindow } from '../shared/types'

interface PooledWindow {
  profileId: string
  browser: Browser
  windowInfo: BitBrowserWindow
  busy: boolean
  createdAt: number
}

/**
 * 并发窗口池
 * 信号量机制 + 资源监控
 */
export class WindowPool {
  private pool: Map<string, PooledWindow> = new Map()
  private maxConcurrency: number
  private bitManager: BitBrowserManager
  private waitQueue: Array<(window: PooledWindow) => void> = []

  constructor(maxConcurrency: number = 3) {
    this.maxConcurrency = maxConcurrency
    this.bitManager = new BitBrowserManager()
  }

  /**
   * 获取一个可用的浏览器窗口（信号量机制）
   * 如果池中无可用窗口且未达上限，创建新窗口
   * 如果已达上限，排队等待
   */
  async acquire(profileId: string): Promise<PooledWindow> {
    // TODO: implement
    // 1. 检查是否有空闲窗口
    // 2. 如果没有且未达上限，打开新窗口
    // 3. 如果已达上限，加入等待队列
    // 4. 标记窗口为busy
    void profileId
    throw new Error('Not implemented')
  }

  /**
   * 归还浏览器窗口到池中
   */
  release(profileId: string): void {
    // TODO: implement
    // 1. 标记窗口为非busy
    // 2. 如果等待队列不为空，唤醒第一个等待者
    void profileId
  }

  /**
   * 关闭并移除指定窗口
   */
  async destroy(profileId: string): Promise<void> {
    // TODO: implement
    // 1. 关闭puppeteer连接
    // 2. 调用BitBrowserManager关闭窗口
    // 3. 从池中移除
    void profileId
  }

  /**
   * 关闭所有窗口并清空池
   */
  async destroyAll(): Promise<void> {
    // TODO: implement
    for (const [profileId] of this.pool) {
      await this.destroy(profileId)
    }
    this.pool.clear()
  }

  /**
   * 获取当前池状态
   */
  getStatus(): { total: number; busy: number; idle: number; waiting: number } {
    let busy = 0
    let idle = 0
    for (const w of this.pool.values()) {
      if (w.busy) busy++
      else idle++
    }
    return {
      total: this.pool.size,
      busy,
      idle,
      waiting: this.waitQueue.length
    }
  }

  /**
   * 资源监控：检测僵尸窗口并清理
   */
  async cleanupStaleWindows(maxAgeMs: number = 600000): Promise<number> {
    // TODO: implement
    // 遍历池中窗口，关闭超时的窗口
    void maxAgeMs
    return 0
  }
}
