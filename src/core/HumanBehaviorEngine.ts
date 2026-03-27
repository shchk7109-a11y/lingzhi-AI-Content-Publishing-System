import type { Page } from 'puppeteer-core'

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function isAscii(char: string): boolean {
  return char.charCodeAt(0) < 128
}

function isPunctuation(char: string): boolean {
  return /[，。！？、；：""''…—,.!?;:'"()\-]/.test(char)
}

/**
 * 三阶贝塞尔曲线插值
 */
function cubicBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/**
 * 拟人行为引擎
 * 模拟人类操作：打字、鼠标移动、浏览、滚动、点赞等
 */
export class HumanBehaviorEngine {
  private lastMouseX = 0
  private lastMouseY = 0

  /**
   * 模拟真人打字（带选择器，先点击输入框）
   */
  async humanType(page: Page, selector: string, text: string): Promise<void> {
    await this.humanClick(page, selector)
    await this.randomDelay(200, 500)
    await this.humanTypeInPlace(page, text)
  }

  /**
   * 模拟真人打字（在当前焦点元素上直接输入）
   * - 每字符间隔 80-200ms
   * - 每输入 15-30 个字符后停顿 300-800ms
   * - 标点符号后额外停顿 200-500ms
   */
  async humanTypeInPlace(page: Page, text: string): Promise<void> {
    let charsSinceBreak = 0
    const breakInterval = randomBetween(15, 30)

    for (const char of text) {
      // ASCII字符用 press，中文等非ASCII用 insertText
      if (isAscii(char) && char.length === 1 && char !== ' ') {
        await page.keyboard.press(char as any)
      } else {
        await page.keyboard.insertText(char)
      }

      charsSinceBreak++

      // 基础字符间隔
      await this.randomDelay(80, 200)

      // 标点符号后额外停顿
      if (isPunctuation(char)) {
        await this.randomDelay(200, 500)
      }

      // 定期"思考"停顿
      if (charsSinceBreak >= breakInterval) {
        await this.randomDelay(300, 800)
        charsSinceBreak = 0
      }
    }
  }

  /**
   * 贝塞尔曲线鼠标移动
   * - 3阶贝塞尔曲线，随机控制点
   * - 20-40步离散化
   * - ease-in-out速度曲线
   * - 最终偏离2-5px模拟手抖
   */
  async humanMouseMove(page: Page, targetX: number, targetY: number): Promise<void> {
    const startX = this.lastMouseX
    const startY = this.lastMouseY
    const steps = randomBetween(20, 40)
    const path = this.generateBezierPath(startX, startY, targetX, targetY, steps)

    for (let i = 0; i < path.length; i++) {
      await page.mouse.move(path[i].x, path[i].y)
      // ease-in-out: 首尾慢，中间快
      const progress = i / path.length
      const delay = progress < 0.3 || progress > 0.7
        ? randomBetween(8, 20)
        : randomBetween(2, 8)
      await new Promise((r) => setTimeout(r, delay))
    }

    this.lastMouseX = targetX
    this.lastMouseY = targetY
  }

  /**
   * 模拟真人点击
   * - 贝塞尔移动到目标附近
   * - 随机偏移 2-5px
   * - mousedown/mouseup 间隔 50-150ms
   */
  async humanClick(page: Page, selector: string): Promise<void> {
    const el = await page.$(selector)
    if (!el) throw new Error(`Element not found: ${selector}`)

    const box = await el.boundingBox()
    if (!box) throw new Error(`Element not visible: ${selector}`)

    const x = box.x + box.width / 2 + randomBetween(-3, 3)
    const y = box.y + box.height / 2 + randomBetween(-3, 3)

    await this.humanClickAt(page, x, y)
  }

  /**
   * 模拟真人点击坐标位置
   */
  async humanClickAt(page: Page, x: number, y: number): Promise<void> {
    // 加微小偏移
    const offsetX = x + randomBetween(-2, 2)
    const offsetY = y + randomBetween(-2, 2)

    await this.humanMouseMove(page, offsetX, offsetY)
    await this.randomDelay(50, 150)

    await page.mouse.down()
    await this.randomDelay(50, 150)
    await page.mouse.up()
  }

  /**
   * 模拟页面滚动浏览
   * - 变速滚动：每次 100-400px
   * - 滚动间隔 800-2000ms
   * - 10% 概率回滚 50-200px
   */
  async humanScroll(page: Page, scrollCount: number = 3): Promise<void> {
    for (let i = 0; i < scrollCount; i++) {
      const distance = randomBetween(100, 400)
      await page.mouse.wheel({ deltaY: distance })
      await this.randomDelay(800, 2000)

      // 10% 概率回滚
      if (Math.random() < 0.1) {
        const backDistance = randomBetween(50, 200)
        await page.mouse.wheel({ deltaY: -backDistance })
        await this.randomDelay(500, 1000)
      }
    }
  }

  /**
   * 发布前预热：浏览小红书首页
   */
  async warmup(page: Page, intensity: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const browseCount = intensity === 'high' ? 2
      : intensity === 'medium' ? randomBetween(1, 2)
      : randomBetween(0, 1)

    console.log(`[HumanBehavior] Warmup: browsing ${browseCount} notes (intensity=${intensity})`)

    if (browseCount === 0) {
      console.log('[HumanBehavior] Warmup skipped (mature account)')
      return
    }

    // 浏览首页
    await page.goto('https://www.xiaohongshu.com/explore', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    }).catch(() => { /* 可能已在首页 */ })

    await this.randomDelay(1500, 3000)

    // 快速滚动首页
    await this.humanScroll(page, randomBetween(1, 2))

    // 随机点击笔记浏览
    for (let i = 0; i < browseCount; i++) {
      try {
        const noteLinks = await page.$$('a[href*="/explore/"]')
        if (noteLinks.length === 0) break

        const randomIndex = randomBetween(0, Math.min(noteLinks.length - 1, 10))
        const link = noteLinks[randomIndex]
        const box = await link.boundingBox()
        if (box) {
          await this.humanClickAt(page, box.x + box.width / 2, box.y + box.height / 2)

          // 停留时间大幅缩短
          const stayTime = intensity === 'high' ? randomBetween(3000, 5000)
            : randomBetween(2000, 4000)
          await this.randomDelay(stayTime, stayTime + 1000)

          // 快速滚动1次
          await this.humanScroll(page, 1)

          // 返回
          await page.goBack().catch(() => {})
          await this.randomDelay(1000, 2000)
        }
      } catch {
        // 单个笔记浏览失败，继续下一个
        await this.randomDelay(1000, 2000)
      }
    }

    console.log('[HumanBehavior] Warmup completed')
  }

  /**
   * 发布后冷却
   */
  async cooldown(page: Page): Promise<void> {
    console.log('[HumanBehavior] Cooldown: post-publish browsing')

    try {
      // 回到首页浏览
      await page.goto('https://www.xiaohongshu.com/explore', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      }).catch(() => {})

      await this.randomDelay(2000, 5000)
      await this.humanScroll(page, randomBetween(1, 3))

      // 可能浏览1篇笔记
      if (Math.random() < 0.5) {
        const noteLinks = await page.$$('a[href*="/explore/"]')
        if (noteLinks.length > 0) {
          const link = noteLinks[randomBetween(0, Math.min(noteLinks.length - 1, 5))]
          const box = await link.boundingBox()
          if (box) {
            await this.humanClickAt(page, box.x + box.width / 2, box.y + box.height / 2)
            await this.randomDelay(3000, 8000)
          }
        }
      }
    } catch {
      // 冷却失败不影响主流程
    }

    // 最后停留一会儿
    await this.randomDelay(5000, 15000)
    console.log('[HumanBehavior] Cooldown completed')
  }

  /**
   * 随机等待
   */
  async randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = randomBetween(minMs, maxMs)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  /**
   * 等待元素出现并可见，带超时和重试
   */
  async waitForElement(page: Page, selector: string, timeoutMs: number = 10000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: timeoutMs })
      return true
    } catch {
      return false
    }
  }

  /**
   * 生成贝塞尔曲线路径点
   */
  private generateBezierPath(
    startX: number, startY: number,
    endX: number, endY: number,
    steps: number
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = []

    // 随机控制点（在起点和终点的中间区域偏移）
    const midX = (startX + endX) / 2
    const midY = (startY + endY) / 2
    const spread = Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) * 0.3

    const cp1x = midX + randomBetween(-spread, spread) * 0.5
    const cp1y = midY + randomBetween(-spread, spread) * 0.5
    const cp2x = midX + randomBetween(-spread, spread) * 0.5
    const cp2y = midY + randomBetween(-spread, spread) * 0.5

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      points.push({
        x: Math.round(cubicBezier(t, startX, cp1x, cp2x, endX)),
        y: Math.round(cubicBezier(t, startY, cp1y, cp2y, endY))
      })
    }

    return points
  }
}
