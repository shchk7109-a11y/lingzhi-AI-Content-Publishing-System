import type { Page } from 'puppeteer-core'

/**
 * 防自动化检测
 * 有条件注入stealth脚本，通过 evaluateOnNewDocument 确保每个新页面都生效
 */
export class StealthInjector {
  /**
   * 检测当前页面是否需要注入stealth脚本
   * 如果 navigator.webdriver === undefined，说明Bit已处理
   */
  async needsInjection(page: Page): Promise<boolean> {
    try {
      const webdriver = await page.evaluate(() => (navigator as any).webdriver)
      return webdriver === true || webdriver === undefined ? false : true
    } catch {
      return true
    }
  }

  /**
   * 注入核心反检测脚本
   * 使用 evaluateOnNewDocument 确保新页面也会执行
   */
  async inject(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(() => {
      // 1. 覆盖 navigator.webdriver 为 undefined
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      })

      // 2. 修改 navigator.plugins（添加常见插件）
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
          ] as any
        },
        configurable: true
      })

      // 3. 修改 navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en'],
        configurable: true
      })

      // 4. 移除 CDP 特征标记
      const cdcProps = Object.getOwnPropertyNames(window).filter(
        (p) => p.startsWith('cdc_') || p.startsWith('__webdriver')
      )
      for (const prop of cdcProps) {
        try {
          delete (window as any)[prop]
        } catch { /* ignore */ }
      }

      // 5. 覆盖 Permissions query
      const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions)
      ;(window.navigator.permissions as any).query = (params: any) => {
        if (params.name === 'notifications') {
          return Promise.resolve({ state: 'denied', onchange: null } as any)
        }
        return originalQuery(params)
      }

      // 6. 覆盖 chrome.runtime 使其看起来不像自动化
      if (!(window as any).chrome) {
        (window as any).chrome = {}
      }
      if (!(window as any).chrome.runtime) {
        (window as any).chrome.runtime = {
          connect: () => {},
          sendMessage: () => {}
        }
      }
    })

    console.log('[StealthInjector] Anti-detection scripts injected')
  }

  /**
   * 条件注入：只在需要时注入
   */
  async applyIfNeeded(page: Page): Promise<boolean> {
    const needed = await this.needsInjection(page)
    // 无论是否"需要"，都注入 evaluateOnNewDocument 以确保后续页面安全
    await this.inject(page)
    return needed
  }
}
