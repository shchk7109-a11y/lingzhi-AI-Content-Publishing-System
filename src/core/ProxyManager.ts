import type { Page } from 'puppeteer-core'
import { getDatabase } from '../database/db'
import { DEFAULT_PROXY_GATEWAY } from '../shared/constants'
import type {
  ProxyItem,
  ProxyGatewayConfig,
  StickyProxy,
  ExitIpCheckResult
} from '../shared/types'

/**
 * 派生粘性代理所需的账号最小结构。
 * 用稳定标识（优先 bit_profile_id）保证同一账号永远得到同一 session-id。
 */
export interface StickyAccountLike {
  id: number
  bit_profile_id?: string | null
  account_alias?: string | null
  region?: string | null
  // 账号自带的固定代理（网关未启用时的回退来源）
  proxy_config?: Record<string, unknown> | null
}

/**
 * 代理IP管理
 *
 * 两种工作模式：
 *  1. 住宅代理粘性会话（主）：一个网关 + 每账号稳定 session-id，出口IP在TTL内固定。
 *     这是"一号一IP"防限流的核心，通过 buildStickyProxy 派生。
 *  2. 固定IP列表（备）：proxy_pool 表存离散IP，供无住宅代理时使用。
 *
 * 熔断按"账号"维度：某账号连续失败达到阈值即冷却，避免继续用问题出口发帖。
 */
export class ProxyManager {
  private gateway: ProxyGatewayConfig
  private circuitBreaker: Map<string, { failCount: number; openUntil: number }> = new Map()
  private readonly failThreshold = 3
  private readonly cooldownMs = 300000 // 5分钟熔断

  constructor(gateway?: Partial<ProxyGatewayConfig>) {
    this.gateway = { ...DEFAULT_PROXY_GATEWAY, ...(gateway || {}) }
  }

  /**
   * 更新网关配置（Settings联动）
   */
  setGateway(gateway: Partial<ProxyGatewayConfig>): void {
    this.gateway = { ...this.gateway, ...gateway }
  }

  getGateway(): ProxyGatewayConfig {
    return this.gateway
  }

  /**
   * 由账号稳定标识派生 session-id。
   * 同一账号（同一 bit_profile_id）每次派生结果恒定 → 出口IP稳定。
   */
  deriveSessionId(account: StickyAccountLike): string {
    const seed =
      (account.bit_profile_id && String(account.bit_profile_id)) ||
      (account.account_alias && String(account.account_alias)) ||
      `acc${account.id}`

    // FNV-1a 32位哈希，输出短小的字母数字 session-id（供应商通常限制字符集）
    let hash = 0x811c9dc5
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
    const hex = (hash >>> 0).toString(36)
    return `lz${hex}`
  }

  /**
   * 为账号派生粘性代理，可直接下发到 Bit 指纹浏览器。
   *
   * - 网关启用：按 usernameTemplate 拼接 session-id，得到粘性住宅代理
   * - 网关关闭：回退到账号自带的 proxy_config（固定IP模式）
   * - 两者都无：返回 null（调用方应视为"不下发代理"或阻断发布）
   */
  buildStickyProxy(account: StickyAccountLike): StickyProxy | null {
    if (this.gateway.enabled) {
      if (!this.gateway.host || !this.gateway.port) {
        throw new Error('代理网关已启用但未配置 host/port')
      }

      const sessionId = this.deriveSessionId(account)
      const username = this.renderUsername(sessionId, account.region || '')

      return {
        protocol: this.gateway.protocol,
        host: this.gateway.host,
        port: this.gateway.port,
        username,
        password: this.gateway.password,
        sessionId
      }
    }

    // 回退：账号自带固定代理
    const fallback = this.fallbackFromAccount(account)
    if (fallback) return fallback

    return null
  }

  /**
   * 渲染 username 模板，替换供应商占位符。
   */
  private renderUsername(sessionId: string, city: string): string {
    return this.gateway.usernameTemplate
      .replaceAll('{USER}', this.gateway.username)
      .replaceAll('{SID}', sessionId)
      .replaceAll('{TTL}', String(this.gateway.sessionTtlMinutes))
      .replaceAll('{CITY}', city)
  }

  /**
   * 从账号自带 proxy_config 构造回退代理。
   */
  private fallbackFromAccount(account: StickyAccountLike): StickyProxy | null {
    const cfg = account.proxy_config
    if (!cfg || typeof cfg !== 'object') return null

    const host = typeof cfg.ip === 'string' ? cfg.ip : ''
    const port = typeof cfg.port === 'number' ? cfg.port : Number(cfg.port)
    if (!host || !Number.isFinite(port) || port <= 0) return null

    const protocol =
      cfg.protocol === 'https' || cfg.protocol === 'socks5' ? cfg.protocol : 'http'

    return {
      protocol,
      host,
      port,
      username: typeof cfg.username === 'string' ? cfg.username : '',
      password: typeof cfg.password === 'string' ? cfg.password : '',
      sessionId: `fixed-${account.id}`
    }
  }

  /**
   * 在浏览器页面内校验真实出口IP（而非Node层），确保发帖走的是预期出口。
   *
   * @param page       已连接目标浏览器的 puppeteer Page
   * @param expectedCity 期望城市（来自账号 region），提供时会做一致性比对
   */
  async verifyExitIp(page: Page, expectedCity?: string): Promise<ExitIpCheckResult> {
    const url = this.gateway.ipCheckUrl
    if (!url) {
      return { ok: false, error: '未配置出口IP校验接口(ipCheckUrl)' }
    }

    try {
      const raw = await page.evaluate(async (checkUrl: string) => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10000)
        try {
          const resp = await fetch(checkUrl, { signal: controller.signal })
          const text = await resp.text()
          return { status: resp.status, text }
        } finally {
          clearTimeout(timer)
        }
      }, url)

      if (!raw || raw.status < 200 || raw.status >= 300) {
        return { ok: false, error: `IP查询接口返回异常: HTTP ${raw?.status}` }
      }

      const { ip, city } = this.parseIpResponse(raw.text)
      if (!ip) {
        return { ok: false, error: 'IP查询接口未返回可识别的IP' }
      }

      const cityMatched = expectedCity
        ? city.includes(expectedCity) || expectedCity.includes(city)
        : undefined

      return { ok: true, ip, city, cityMatched }
    } catch (error) {
      return {
        ok: false,
        error: `出口IP校验失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * 解析常见IP查询接口的响应，尽量兼容多家格式。
   */
  private parseIpResponse(text: string): { ip: string; city: string } {
    let ip = ''
    let city = ''

    try {
      const json = JSON.parse(text) as Record<string, unknown>
      // 百度 qifu: { data: { ip, prov, city } }
      const data = (json.data as Record<string, unknown>) || json
      ip = this.firstString(data.ip, json.ip, json.query, data.query)
      city = this.firstString(data.city, data.prov, json.city, json.region, data.region)
    } catch {
      // 非JSON：尝试从文本中提取IPv4
      const match = text.match(/\d{1,3}(?:\.\d{1,3}){3}/)
      if (match) ip = match[0]
    }

    return { ip, city }
  }

  private firstString(...values: unknown[]): string {
    for (const v of values) {
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return ''
  }

  // ===== 账号级熔断 =====

  /**
   * 该账号当前是否处于熔断冷却中。
   */
  isAccountTripped(accountKey: string): boolean {
    const state = this.circuitBreaker.get(accountKey)
    if (!state) return false
    if (state.openUntil > Date.now()) return true
    // 冷却结束，重置
    if (state.openUntil !== 0) this.circuitBreaker.delete(accountKey)
    return false
  }

  /**
   * 报告账号发布/代理失败，累计到阈值触发熔断。
   */
  reportAccountFailure(accountKey: string): void {
    const state = this.circuitBreaker.get(accountKey) || { failCount: 0, openUntil: 0 }
    state.failCount++
    if (state.failCount >= this.failThreshold) {
      state.openUntil = Date.now() + this.cooldownMs
    }
    this.circuitBreaker.set(accountKey, state)
  }

  /**
   * 报告账号成功，重置熔断计数。
   */
  reportAccountSuccess(accountKey: string): void {
    this.circuitBreaker.delete(accountKey)
  }

  // ===== 固定IP列表模式（proxy_pool 表，备用） =====

  /**
   * 添加固定代理到池
   */
  addProxy(proxy: Omit<ProxyItem, 'id' | 'last_check_at' | 'usage_count' | 'fail_count' | 'created_at'>): void {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO proxy_pool (ip, port, protocol, city, provider, type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(proxy.ip, proxy.port, proxy.protocol, proxy.city, proxy.provider, proxy.type, proxy.status)
  }

  /**
   * 批量导入固定代理（事务，跳过缺少 ip/port 的行）
   */
  batchImport(
    proxies: Array<{ ip: string; port: number; protocol?: string; city?: string; provider?: string; type?: string }>
  ): number {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO proxy_pool (ip, port, protocol, city, provider, type, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `)

    let count = 0
    const tx = db.transaction(() => {
      for (const p of proxies) {
        if (!p.ip || !Number.isFinite(p.port) || p.port <= 0) continue
        stmt.run(p.ip, p.port, p.protocol || 'http', p.city || '', p.provider || '', p.type || 'pool')
        count++
      }
    })
    tx()
    return count
  }

  /**
   * 报告固定代理失败（更新数据库熔断状态）
   */
  reportPoolProxyFailure(proxyId: number): void {
    const db = getDatabase()
    db.prepare('UPDATE proxy_pool SET fail_count = fail_count + 1 WHERE id = ?').run(proxyId)
    const row = db.prepare('SELECT fail_count FROM proxy_pool WHERE id = ?').get(proxyId) as
      | { fail_count: number }
      | undefined
    if (row && row.fail_count >= this.failThreshold) {
      db.prepare("UPDATE proxy_pool SET status = 'cooldown' WHERE id = ?").run(proxyId)
    }
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
