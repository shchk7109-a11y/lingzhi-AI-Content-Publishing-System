import { beforeEach, describe, expect, it, vi } from 'vitest'

// mock puppeteer-core：connect 返回一个假的 browser
const fakePage = { url: () => 'about:blank' }
const makeFakeBrowser = (): unknown => ({
  pages: async () => [fakePage],
  newPage: async () => fakePage,
  isConnected: () => true,
  disconnect: () => {}
})

vi.mock('puppeteer-core', () => ({
  default: {
    connect: vi.fn(async () => makeFakeBrowser())
  }
}))

import { WindowPool } from './WindowPool'
import type { BitBrowserManager } from './BitBrowserManager'

// 假的 BitBrowserManager：openBrowser 返回 ws，其余空实现
function makeFakeBitManager(): BitBrowserManager {
  return {
    openBrowser: vi.fn(async (id: string) => ({ ws: `ws://fake/${id}`, port: 0 })),
    closeBrowser: vi.fn(async () => {}),
    updateProfileProxy: vi.fn(async () => {})
  } as unknown as BitBrowserManager
}

// 测试用：关闭最小间隔，缩短排队超时
const fastOptions = { minIntervalMs: 0, acquireTimeoutMs: 500 }

describe('WindowPool 信号量与排队', () => {
  let bit: BitBrowserManager

  beforeEach(() => {
    bit = makeFakeBitManager()
  })

  it('活跃数未达上限时立即分配', async () => {
    const pool = new WindowPool(bit, 2, fastOptions)
    const slot = await pool.acquire('p1')
    expect(slot).not.toBeNull()
    expect(pool.getActiveCount()).toBe(1)
  })

  it('满并发时第二个申请排队，释放后被唤醒并成功获取（回归：不再误返回null）', async () => {
    const pool = new WindowPool(bit, 1, fastOptions)

    const first = await pool.acquire('p1')
    expect(first).not.toBeNull()
    expect(pool.getActiveCount()).toBe(1)

    // 第二个申请应进入排队（不立即 resolve）
    let secondResolved = false
    const secondPromise = pool.acquire('p2').then((s) => {
      secondResolved = true
      return s
    })

    // 让事件循环转一圈，确认仍在排队
    await new Promise((r) => setTimeout(r, 50))
    expect(secondResolved).toBe(false)
    expect(pool.getStatus().waitingCount).toBe(1)

    // 释放第一个 → 唤醒排队者
    await pool.release('p1')

    const second = await secondPromise
    expect(second).not.toBeNull() // 关键：修复前这里会是 null
    expect(pool.getActiveCount()).toBe(1)
    expect(pool.getStatus().activeProfiles).toContain('p2')
  })

  it('排队超时返回null并从等待队列清理', async () => {
    const pool = new WindowPool(bit, 1, { minIntervalMs: 0, acquireTimeoutMs: 100 })
    await pool.acquire('p1')

    const start = Date.now()
    const second = await pool.acquire('p2')
    expect(second).toBeNull()
    expect(Date.now() - start).toBeGreaterThanOrEqual(90)
    // 超时后不应残留在等待队列
    expect(pool.getStatus().waitingCount).toBe(0)
  })

  it('setMaxConcurrency 放宽后唤醒等待者', async () => {
    const pool = new WindowPool(bit, 1, fastOptions)
    await pool.acquire('p1')

    let secondResolved = false
    const secondPromise = pool.acquire('p2').then((s) => {
      secondResolved = true
      return s
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(secondResolved).toBe(false)

    // 放宽并发上限 → 应唤醒排队者
    pool.setMaxConcurrency(2)

    const second = await secondPromise
    expect(second).not.toBeNull()
    expect(pool.getActiveCount()).toBe(2)
  })

  it('releaseAll 让排队者放弃并返回null', async () => {
    const pool = new WindowPool(bit, 1, fastOptions)
    await pool.acquire('p1')

    const secondPromise = pool.acquire('p2')
    await new Promise((r) => setTimeout(r, 50))

    await pool.releaseAll()

    const second = await secondPromise
    expect(second).toBeNull()
    expect(pool.getActiveCount()).toBe(0)
    expect(pool.getStatus().waitingCount).toBe(0)
  })
})
