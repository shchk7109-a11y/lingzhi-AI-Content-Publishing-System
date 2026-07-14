import { afterEach, describe, expect, it, vi } from 'vitest'

// ProxyManager 导入了 getDatabase；粘性会话相关方法不触库，这里给个占位 mock
vi.mock('../database/db', () => ({
  getDatabase: () => {
    throw new Error('database not used in sticky-session tests')
  }
}))

import { ProxyManager, type StickyAccountLike } from './ProxyManager'
import type { Page } from 'puppeteer-core'

const account = (over: Partial<StickyAccountLike> = {}): StickyAccountLike => ({
  id: 1,
  bit_profile_id: 'profile-abc',
  account_alias: 'xhs-01',
  region: '杭州',
  proxy_config: null,
  ...over
})

const enabledGateway = {
  enabled: true,
  host: 'gw.residential.example',
  port: 8000,
  protocol: 'http' as const,
  username: 'custuser',
  password: 'secret',
  usernameTemplate: '{USER}-session-{SID}-time-{TTL}',
  sessionTtlMinutes: 30,
  ipCheckUrl: 'https://ip.example/geo'
}

describe('ProxyManager 粘性会话派生', () => {
  it('同一账号派生的 session-id 恒定，不同账号不同', () => {
    const pm = new ProxyManager(enabledGateway)
    const a = pm.deriveSessionId(account())
    const b = pm.deriveSessionId(account())
    const c = pm.deriveSessionId(account({ id: 2, bit_profile_id: 'profile-xyz' }))

    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it('优先用 bit_profile_id 作为 session 种子', () => {
    const pm = new ProxyManager(enabledGateway)
    // 改 alias 但 profile 不变 → session 应不变（出口IP稳定）
    const withAlias = pm.deriveSessionId(account({ account_alias: 'changed' }))
    const original = pm.deriveSessionId(account())
    expect(withAlias).toBe(original)
  })

  it('网关启用时按模板拼接 username', () => {
    const pm = new ProxyManager(enabledGateway)
    const proxy = pm.buildStickyProxy(account())
    const sid = pm.deriveSessionId(account())

    expect(proxy).not.toBeNull()
    expect(proxy!.host).toBe('gw.residential.example')
    expect(proxy!.port).toBe(8000)
    expect(proxy!.username).toBe(`custuser-session-${sid}-time-30`)
    expect(proxy!.password).toBe('secret')
    expect(proxy!.sessionId).toBe(sid)
  })

  it('网关启用但缺 host/port 时抛错', () => {
    const pm = new ProxyManager({ ...enabledGateway, host: '' })
    expect(() => pm.buildStickyProxy(account())).toThrow(/host\/port/)
  })

  it('网关关闭时回退到账号自带固定代理', () => {
    const pm = new ProxyManager({ ...enabledGateway, enabled: false })
    const proxy = pm.buildStickyProxy(
      account({
        proxy_config: { ip: '1.2.3.4', port: 9999, protocol: 'socks5', username: 'u', password: 'p' }
      })
    )
    expect(proxy).toEqual({
      protocol: 'socks5',
      host: '1.2.3.4',
      port: 9999,
      username: 'u',
      password: 'p',
      sessionId: 'fixed-1'
    })
  })

  it('网关关闭且无固定代理时返回 null', () => {
    const pm = new ProxyManager({ ...enabledGateway, enabled: false })
    expect(pm.buildStickyProxy(account({ proxy_config: null }))).toBeNull()
  })
})

describe('ProxyManager 账号级熔断', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('连续失败达阈值后熔断，成功后重置', () => {
    const pm = new ProxyManager(enabledGateway)
    pm.reportAccountFailure('k1')
    pm.reportAccountFailure('k1')
    expect(pm.isAccountTripped('k1')).toBe(false)
    pm.reportAccountFailure('k1')
    expect(pm.isAccountTripped('k1')).toBe(true)

    pm.reportAccountSuccess('k1')
    expect(pm.isAccountTripped('k1')).toBe(false)
  })

  it('熔断在冷却期结束后自动解除', () => {
    vi.useFakeTimers()
    const pm = new ProxyManager(enabledGateway)
    pm.reportAccountFailure('k2')
    pm.reportAccountFailure('k2')
    pm.reportAccountFailure('k2')
    expect(pm.isAccountTripped('k2')).toBe(true)

    vi.advanceTimersByTime(300000 + 1)
    expect(pm.isAccountTripped('k2')).toBe(false)
  })
})

describe('ProxyManager 出口IP校验', () => {
  const fakePage = (text: string, status = 200): Page =>
    ({
      evaluate: async () => ({ status, text })
    }) as unknown as Page

  it('解析百度 qifu 格式并比对城市', async () => {
    const pm = new ProxyManager(enabledGateway)
    const page = fakePage(JSON.stringify({ code: 'Success', data: { ip: '110.55.1.9', prov: '浙江省', city: '杭州市' } }))
    const result = await pm.verifyExitIp(page, '杭州')

    expect(result.ok).toBe(true)
    expect(result.ip).toBe('110.55.1.9')
    expect(result.city).toBe('杭州市')
    expect(result.cityMatched).toBe(true)
  })

  it('城市不一致时 cityMatched 为 false', async () => {
    const pm = new ProxyManager(enabledGateway)
    const page = fakePage(JSON.stringify({ data: { ip: '1.1.1.1', city: '广州市' } }))
    const result = await pm.verifyExitIp(page, '杭州')
    expect(result.ok).toBe(true)
    expect(result.cityMatched).toBe(false)
  })

  it('纯文本响应也能提取 IPv4', async () => {
    const pm = new ProxyManager(enabledGateway)
    const page = fakePage('current ip = 203.0.113.45 done')
    const result = await pm.verifyExitIp(page)
    expect(result.ok).toBe(true)
    expect(result.ip).toBe('203.0.113.45')
  })

  it('未配置 ipCheckUrl 时返回未通过', async () => {
    const pm = new ProxyManager({ ...enabledGateway, ipCheckUrl: '' })
    const result = await pm.verifyExitIp(fakePage('{}'))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('ipCheckUrl')
  })
})
