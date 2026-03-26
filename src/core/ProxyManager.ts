import { getDatabase } from '../database/db'
import type { ProxyItem, ProxyConfig } from '../shared/types'

/**
 * 代理IP管理
 * 粘性IP + 区域IP池 + 健康检测 + 熔断
 */
export class ProxyManager {
  private circuitBreaker: Map<number, { failCount: number; openUntil: number }> = new Map()
  private readonly failThreshold = 3
  private readonly cooldownMs = 300000 // 5分钟熔断

  /**
   * 获取一个可用代理（按城市匹配）
   * @param city 目标城市
   * @param type 代理类型
   */
  async getProxy(city?: string, type: 'sticky' | 'pool' = 'pool'): Promise<ProxyConfig | null> {
    // TODO: implement
    // 1. 从proxy_pool表查询匹配的活跃代理
    // 2. 检查熔断状态
    // 3. 返回可用代理
    // 4. 更新usage_count
    void city
    void type
    return null
  }

  /**
   * 添加代理到池
   */
  addProxy(proxy: Omit<ProxyItem, 'id' | 'last_check_at' | 'usage_count' | 'fail_count' | 'created_at'>): void {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO proxy_pool (ip, port, protocol, city, provider, type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(proxy.ip, proxy.port, proxy.protocol, proxy.city, proxy.provider, proxy.type, proxy.status)
  }

  /**
   * 批量导入代理
   */
  batchImport(proxies: Array<{ ip: string; port: number; protocol?: string; city?: string; provider?: string }>): number {
    // TODO: implement
    void proxies
    return 0
  }

  /**
   * 健康检测：检查代理是否可用
   * @param proxyId 代理ID
   */
  async healthCheck(proxyId: number): Promise<boolean> {
    // TODO: implement
    // 1. 通过代理发送HTTP请求到测试URL
    // 2. 检查响应状态和延迟
    // 3. 更新last_check_at和状态
    void proxyId
    return false
  }

  /**
   * 批量健康检测
   */
  async batchHealthCheck(): Promise<{ checked: number; failed: number }> {
    // TODO: implement
    // 遍历所有active代理，执行健康检测
    return { checked: 0, failed: 0 }
  }

  /**
   * 报告代理失败（触发熔断机制）
   */
  reportFailure(proxyId: number): void {
    // TODO: implement
    // 1. 增加fail_count
    // 2. 如果连续失败达到阈值，触发熔断
    // 3. 更新数据库状态
    const state = this.circuitBreaker.get(proxyId) || { failCount: 0, openUntil: 0 }
    state.failCount++
    if (state.failCount >= this.failThreshold) {
      state.openUntil = Date.now() + this.cooldownMs
      const db = getDatabase()
      db.prepare("UPDATE proxy_pool SET status = 'cooldown' WHERE id = ?").run(proxyId)
    }
    this.circuitBreaker.set(proxyId, state)
  }

  /**
   * 报告代理成功（重置熔断计数）
   */
  reportSuccess(proxyId: number): void {
    this.circuitBreaker.delete(proxyId)
  }

  /**
   * 获取代理池统计
   */
  getPoolStats(): { total: number; active: number; failed: number; cooldown: number } {
    const db = getDatabase()
    const total = (db.prepare('SELECT COUNT(*) as c FROM proxy_pool').get() as { c: number }).c
    const active = (db.prepare("SELECT COUNT(*) as c FROM proxy_pool WHERE status = 'active'").get() as { c: number }).c
    const failed = (db.prepare("SELECT COUNT(*) as c FROM proxy_pool WHERE status = 'failed'").get() as { c: number }).c
    const cooldown = (db.prepare("SELECT COUNT(*) as c FROM proxy_pool WHERE status = 'cooldown'").get() as { c: number }).c
    return { total, active, failed, cooldown }
  }
}
