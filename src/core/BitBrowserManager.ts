import { DEFAULT_SETTINGS } from '../shared/constants'

interface BitBrowserProfile {
  id: string
  name: string
  groupId: string
  proxyConfig: Record<string, unknown>
}

interface BitBrowserActive {
  id: string
  name: string
  ws: string
  status: 'running' | 'stopped'
}

/**
 * Bit指纹浏览器API封装
 * 负责浏览器窗口生命周期管理（创建、连接、关闭）
 */
export class BitBrowserManager {
  private baseUrl: string
  private apiToken: string
  private wsEndpoints: Map<string, string> = new Map()
  private readonly requestTimeoutMs = 10000

  constructor(port?: number, apiToken?: string) {
    const p = port || DEFAULT_SETTINGS.bitApiPort
    this.baseUrl = `http://127.0.0.1:${p}`
    this.apiToken = apiToken || ''
  }

  /**
   * 更新API端口（Settings联动）
   */
  updatePort(port: number): void {
    this.baseUrl = `http://127.0.0.1:${port}`
  }

  /**
   * 更新API Token（Settings联动）
   */
  updateApiToken(token: string): void {
    this.apiToken = token
  }

  /**
   * 检查Bit浏览器服务是否运行
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('GET', '/')
      return response !== null
    } catch {
      return false
    }
  }

  /**
   * 启动指定profileId的浏览器窗口
   * 内置重试机制（最多2次，间隔3秒）
   */
  async openBrowser(profileId: string): Promise<{ ws: string; port: number }> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await this.request('POST', '/browser/open', { id: profileId })

        if (!data || !data.data) {
          throw new Error(`Bit浏览器返回数据异常: ${JSON.stringify(data)}`)
        }

        const ws = data.data.ws as string
        const port = data.data.port as number || 0

        if (!ws) {
          throw new Error('Bit浏览器未返回WebSocket地址')
        }

        // 缓存ws地址
        this.wsEndpoints.set(profileId, ws)
        console.log(`[BitBrowser] Opened profile ${profileId}, ws: ${ws}`)

        return { ws, port }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`[BitBrowser] Open attempt ${attempt + 1}/3 failed for ${profileId}: ${lastError.message}`)

        if (attempt < 2) {
          await this.sleep(3000)
        }
      }
    }

    throw new Error(`打开浏览器失败(已重试3次): ${lastError?.message}`)
  }

  /**
   * 关闭指定profileId的浏览器窗口
   */
  async closeBrowser(profileId: string): Promise<void> {
    try {
      await this.request('POST', '/browser/close', { id: profileId })
      this.wsEndpoints.delete(profileId)
      console.log(`[BitBrowser] Closed profile ${profileId}`)
    } catch (error) {
      console.error(`[BitBrowser] Failed to close ${profileId}:`, error)
      // 即使关闭失败也移除缓存，避免内存泄漏
      this.wsEndpoints.delete(profileId)
    }
  }

  /**
   * 获取所有已打开的浏览器窗口状态
   */
  async getActiveBrowsers(): Promise<BitBrowserActive[]> {
    try {
      const data = await this.request('POST', '/browser/list/running', { page: 0, pageSize: 100 })
      if (!data?.data?.list) return []

      return (data.data.list as Array<Record<string, unknown>>).map((item) => ({
        id: item.id as string,
        name: item.name as string || '',
        ws: item.ws as string || '',
        status: 'running' as const
      }))
    } catch (error) {
      console.error('[BitBrowser] Failed to get active browsers:', error)
      return []
    }
  }

  /**
   * 强制关闭所有打开的浏览器窗口（崩溃恢复用）
   */
  async forceCloseAll(): Promise<void> {
    try {
      const active = await this.getActiveBrowsers()
      for (const browser of active) {
        try {
          await this.closeBrowser(browser.id)
        } catch {
          // 忽略单个关闭失败
        }
      }
      this.wsEndpoints.clear()
      console.log(`[BitBrowser] Force closed all browsers (${active.length} total)`)
    } catch (error) {
      console.error('[BitBrowser] Force close all failed:', error)
    }
  }

  /**
   * 获取缓存的ws地址（不发起HTTP请求）
   */
  getWsEndpoint(profileId: string): string | undefined {
    return this.wsEndpoints.get(profileId)
  }

  /**
   * 获取Bit浏览器中所有已创建的profile列表
   */
  async getProfileList(page: number = 0, pageSize: number = 100): Promise<BitBrowserProfile[]> {
    try {
      const data = await this.request('POST', '/browser/list', { page, pageSize })
      if (!data?.data?.list) return []

      return (data.data.list as Array<Record<string, unknown>>).map((item) => ({
        id: item.id as string,
        name: item.name as string || '',
        groupId: item.groupId as string || '',
        proxyConfig: (item.proxyConfig || {}) as Record<string, unknown>
      }))
    } catch (error) {
      console.error('[BitBrowser] Failed to get profile list:', error)
      return []
    }
  }

  /**
   * 更新指定profile的代理配置
   */
  async updateProfileProxy(profileId: string, proxyConfig: {
    type: string
    host: string
    port: number
    username?: string
    password?: string
  }): Promise<void> {
    await this.request('POST', '/browser/update', {
      id: profileId,
      proxyConfig: {
        proxyType: proxyConfig.type,
        proxyServer: proxyConfig.host,
        proxyPort: proxyConfig.port,
        proxyUserName: proxyConfig.username || '',
        proxyPassword: proxyConfig.password || ''
      }
    })
    console.log(`[BitBrowser] Updated proxy for profile ${profileId}`)
  }

  /**
   * 发送HTTP请求到Bit浏览器API
   */
  private async request(method: string, path: string, body?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs)

    try {
      const url = `${this.baseUrl}${path}`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (this.apiToken) {
        headers['X-API-KEY'] = this.apiToken
      }

      const options: RequestInit = {
        method,
        signal: controller.signal,
        headers
      }

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const text = await response.text()
      if (!text) return null

      return JSON.parse(text) as Record<string, unknown>
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Bit浏览器API请求超时 (${this.requestTimeoutMs}ms): ${path}`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
