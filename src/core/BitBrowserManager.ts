import type { BitBrowserWindow, ProxyConfig } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/constants'

/**
 * Bit指纹浏览器API封装
 * 负责浏览器窗口生命周期管理（创建、连接、关闭）
 */
export class BitBrowserManager {
  private apiBase: string

  constructor(apiUrl?: string, apiPort?: number) {
    const url = apiUrl || DEFAULT_SETTINGS.bitApiUrl
    const port = apiPort || DEFAULT_SETTINGS.bitApiPort
    this.apiBase = `${url}:${port}`
  }

  /**
   * 打开浏览器窗口并返回WebSocket调试地址
   * @param profileId Bit浏览器配置ID
   * @returns 窗口信息（含wsEndpoint）
   */
  async openBrowser(profileId: string): Promise<BitBrowserWindow> {
    // TODO: implement
    // 1. POST /browser/open { id: profileId }
    // 2. 解析返回的ws调试地址
    // 3. 返回BitBrowserWindow对象
    void profileId
    throw new Error('Not implemented')
  }

  /**
   * 关闭浏览器窗口
   * @param profileId Bit浏览器配置ID
   */
  async closeBrowser(profileId: string): Promise<void> {
    // TODO: implement
    // POST /browser/close { id: profileId }
    void profileId
  }

  /**
   * 获取已打开的浏览器列表
   */
  async listOpenBrowsers(): Promise<BitBrowserWindow[]> {
    // TODO: implement
    // GET /browser/list
    return []
  }

  /**
   * 更新浏览器配置的代理设置
   * @param profileId 配置ID
   * @param proxy 代理配置
   */
  async updateProxy(profileId: string, proxy: ProxyConfig): Promise<void> {
    // TODO: implement
    // PUT /browser/update { id: profileId, proxy: {...} }
    void profileId
    void proxy
  }

  /**
   * 检查Bit浏览器API是否可用
   */
  async healthCheck(): Promise<boolean> {
    // TODO: implement
    // GET /
    // 检查连接是否正常
    try {
      const response = await fetch(`${this.apiBase}/`)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * 创建新的浏览器配置
   */
  async createProfile(name: string, proxy?: ProxyConfig): Promise<string> {
    // TODO: implement
    // POST /browser/create { name, proxy }
    // 返回新配置的profileId
    void name
    void proxy
    throw new Error('Not implemented')
  }

  /**
   * 删除浏览器配置
   */
  async deleteProfile(profileId: string): Promise<void> {
    // TODO: implement
    // POST /browser/delete { id: profileId }
    void profileId
  }
}
