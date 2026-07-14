import { beforeEach, describe, expect, it, vi } from 'vitest'

// 避免加载 better-sqlite3（ProxyManager→db 传递依赖）
vi.mock('../database/db', () => ({ getDatabase: () => { throw new Error('db not used') } }))
// 避免加载 puppeteer-core 真实实现（WindowPool 传递依赖）
vi.mock('puppeteer-core', () => ({ default: { connect: vi.fn() } }))

const state = vi.hoisted(() => ({
  publishResult: null as unknown,
  lastPublisher: '' as string
}))

// mock 发布器：记录被实例化的是哪个平台，publish 返回预设结果
vi.mock('./publishers/XiaohongshuPublisher', () => ({
  XiaohongshuPublisher: class {
    constructor() { state.lastPublisher = 'xhs' }
    setStepCallback(): void {}
    async publish(): Promise<unknown> { return state.publishResult }
  }
}))
vi.mock('./publishers/DouyinPublisher', () => ({
  DouyinPublisher: class {
    constructor() { state.lastPublisher = 'douyin' }
    setStepCallback(): void {}
    async publish(): Promise<unknown> { return state.publishResult }
  }
}))

import { TaskExecutor } from './TaskExecutor'
import type { WindowPool } from './WindowPool'
import type { ProxyManager } from './ProxyManager'
import type { Task } from '../shared/types'

function makeFakes() {
  const windowPool = {
    acquire: vi.fn(async () => ({ browser: {}, page: {} })),
    release: vi.fn(async () => {})
  } as unknown as WindowPool

  const proxyManager = {
    isAccountTripped: vi.fn(() => false),
    buildStickyProxy: vi.fn(() => ({ protocol: 'http', host: 'h', port: 1, username: 'u', password: 'p', sessionId: 's' })),
    getGateway: vi.fn(() => ({ ipCheckUrl: '' })), // 空→跳过出口IP校验
    verifyExitIp: vi.fn(async () => ({ ok: true })),
    reportAccountSuccess: vi.fn(),
    reportAccountFailure: vi.fn()
  } as unknown as ProxyManager

  const daos = {
    content: { getById: vi.fn(() => ({ id: 10, title: 't', content: 'c', tags: '[]', image_paths: '["/x.jpg"]', video_path: '' })), updateStatus: vi.fn() },
    account: { getById: vi.fn(() => ({ id: 1, bit_profile_id: 'p1', account_alias: 'a', region: '', account_level: 'new', proxy_config: '{}' })), updatePublishCount: vi.fn() },
    task: { updateStatus: vi.fn(), updateLastStep: vi.fn() },
    publishLog: { insert: vi.fn() }
  }
  return { windowPool, proxyManager, daos }
}

function publishTask(over: Partial<Task> = {}): Task {
  return {
    id: 100, account_id: 1, content_id: 10, platform: 'xiaohongshu',
    action_type: 'publish', target_note_url: '', comment_text: '', ...over
  } as Task
}

const okResult = {
  success: true, url: 'https://xhs/note/1', error: undefined,
  screenshots: ['/shot.png'],
  steps: [{ step: 'publish', startTime: 0, endTime: 100, success: true }]
}

describe('TaskExecutor 发布分派与回写', () => {
  beforeEach(() => { state.publishResult = okResult; state.lastPublisher = '' })

  it('发布成功：回写success、内容标记published、账号计数、代理成功', async () => {
    const { windowPool, proxyManager, daos } = makeFakes()
    const ex = new TaskExecutor(windowPool, proxyManager, daos as never)

    await ex.execute(publishTask())

    expect(daos.task.updateStatus).toHaveBeenCalledWith(100, 'running', expect.any(Object))
    expect(daos.task.updateStatus).toHaveBeenCalledWith(100, 'success', expect.objectContaining({ result_url: 'https://xhs/note/1' }))
    expect(daos.content.updateStatus).toHaveBeenCalledWith(10, 'published')
    expect(daos.account.updatePublishCount).toHaveBeenCalledWith(1)
    expect(proxyManager.reportAccountSuccess).toHaveBeenCalled()
    expect(windowPool.release).toHaveBeenCalledWith('p1')
  })

  it('发布失败：回写failed、代理失败、不标记内容published', async () => {
    state.publishResult = { success: false, error: '发布失败xx', screenshots: [], steps: [] }
    const { windowPool, proxyManager, daos } = makeFakes()
    const ex = new TaskExecutor(windowPool, proxyManager, daos as never)

    await ex.execute(publishTask())

    expect(daos.task.updateStatus).toHaveBeenCalledWith(100, 'failed', expect.objectContaining({ error_log: '发布失败xx' }))
    expect(daos.content.updateStatus).not.toHaveBeenCalled()
    expect(proxyManager.reportAccountFailure).toHaveBeenCalled()
    expect(windowPool.release).toHaveBeenCalledWith('p1')
  })

  it('账号未绑定Bit Profile ID：直接失败，不开窗', async () => {
    const { windowPool, proxyManager, daos } = makeFakes()
    daos.account.getById = vi.fn(() => ({ id: 1, bit_profile_id: null, account_level: 'new', proxy_config: '{}' }))
    const ex = new TaskExecutor(windowPool, proxyManager, daos as never)

    await ex.execute(publishTask())

    expect(daos.task.updateStatus).toHaveBeenCalledWith(100, 'failed', expect.objectContaining({ error_log: expect.stringContaining('bit_profile_id') }))
    expect(windowPool.acquire).not.toHaveBeenCalled()
  })

  it('账号熔断中：直接失败，不开窗', async () => {
    const { windowPool, proxyManager, daos } = makeFakes()
    ;(proxyManager.isAccountTripped as ReturnType<typeof vi.fn>).mockReturnValue(true)
    const ex = new TaskExecutor(windowPool, proxyManager, daos as never)

    await ex.execute(publishTask())

    expect(daos.task.updateStatus).toHaveBeenCalledWith(100, 'failed', expect.objectContaining({ error_log: expect.stringContaining('熔断') }))
    expect(windowPool.acquire).not.toHaveBeenCalled()
  })

  it('抖音平台使用DouyinPublisher', async () => {
    const { windowPool, proxyManager, daos } = makeFakes()
    const ex = new TaskExecutor(windowPool, proxyManager, daos as never)

    await ex.execute(publishTask({ platform: 'douyin' }))

    expect(state.lastPublisher).toBe('douyin')
  })

  it('小红书平台使用XiaohongshuPublisher', async () => {
    const { windowPool, proxyManager, daos } = makeFakes()
    const ex = new TaskExecutor(windowPool, proxyManager, daos as never)

    await ex.execute(publishTask({ platform: 'xiaohongshu' }))

    expect(state.lastPublisher).toBe('xhs')
  })
})
