import type { Page } from 'puppeteer-core'
import { describe, expect, it, vi } from 'vitest'
import { XiaohongshuInteractionAdapter } from './XiaohongshuInteractionAdapter'

function createPage(overrides: Partial<Page> = {}): Page {
  return {
    goto: vi.fn(),
    ...overrides
  } as unknown as Page
}

function createBehavior() {
  return {
    randomDelay: vi.fn().mockResolvedValue(undefined),
    humanScroll: vi.fn().mockResolvedValue(undefined)
  }
}

describe('XiaohongshuInteractionAdapter', () => {
  it('requires comment text for comment actions', async () => {
    const adapter = new XiaohongshuInteractionAdapter(createBehavior())

    await expect(
      adapter.run({
        page: createPage(),
        action: 'comment',
        targetUrl: 'https://www.xiaohongshu.com/explore/comment-target',
        commentText: '   '
      })
    ).rejects.toThrow('comment_text is required for comment action')
  })

  it('navigates to the target before queuing a comment placeholder', async () => {
    const page = createPage()
    const behavior = createBehavior()
    const adapter = new XiaohongshuInteractionAdapter(behavior)

    const result = await adapter.run({
      page,
      action: 'comment',
      targetUrl: 'https://www.xiaohongshu.com/explore/comment-target',
      commentText: '这杯看起来很适合下午喝'
    })

    expect(page.goto).toHaveBeenCalledWith('https://www.xiaohongshu.com/explore/comment-target', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    expect(behavior.randomDelay).toHaveBeenCalledWith(2000, 4000)
    expect(result).toEqual({
      success: true,
      steps: [
        { step: 'navigate_target', success: true },
        { step: 'comment_queued_for_selector_mapping', success: true }
      ]
    })
  })

  it('browses the target with an optional human scroll step', async () => {
    const page = createPage()
    const behavior = createBehavior()
    const adapter = new XiaohongshuInteractionAdapter(behavior)

    const result = await adapter.run({
      page,
      action: 'browse',
      targetUrl: 'https://www.xiaohongshu.com/explore/browse-target'
    })

    expect(behavior.humanScroll).toHaveBeenCalledWith(page, 1)
    expect(result).toEqual({
      success: true,
      steps: [
        { step: 'navigate_target', success: true },
        { step: 'browse_target', success: true }
      ]
    })
  })

  it.each(['favorite', 'collect'] as const)(
    'queues %s for selector mapping without live platform selectors',
    async (action) => {
      const page = createPage()
      const behavior = createBehavior()
      const adapter = new XiaohongshuInteractionAdapter(behavior)

      const result = await adapter.run({
        page,
        action,
        targetUrl: `https://www.xiaohongshu.com/explore/${action}-target`
      })

      expect(behavior.humanScroll).not.toHaveBeenCalled()
      expect(result).toEqual({
        success: true,
        steps: [
          { step: 'navigate_target', success: true },
          { step: `${action}_queued_for_selector_mapping`, success: true }
        ]
      })
    }
  )

  it.each([
    { targetUrl: '', error: 'targetUrl is required' },
    { targetUrl: 'ftp://www.xiaohongshu.com/explore/abc', error: 'targetUrl must be an http or https URL' },
    { targetUrl: 'notaurl', error: 'targetUrl must be an http or https URL' }
  ])('rejects invalid target URL: $targetUrl', async ({ targetUrl, error }) => {
    const adapter = new XiaohongshuInteractionAdapter(createBehavior())

    await expect(
      adapter.run({
        page: createPage(),
        action: 'browse',
        targetUrl
      })
    ).rejects.toThrow(error)
  })

  it('rejects publish actions at runtime', async () => {
    const adapter = new XiaohongshuInteractionAdapter(createBehavior())

    await expect(
      adapter.run({
        page: createPage(),
        action: 'publish',
        targetUrl: 'https://www.xiaohongshu.com/explore/publish-target'
      } as unknown as Parameters<XiaohongshuInteractionAdapter['run']>[0])
    ).rejects.toThrow('publish action is not accepted by interaction adapter')
  })

  it('returns a failed navigate step when target navigation fails', async () => {
    const page = createPage({
      goto: vi.fn().mockRejectedValue(new Error('navigation timeout')) as Page['goto']
    })
    const adapter = new XiaohongshuInteractionAdapter(createBehavior())

    const result = await adapter.run({
      page,
      action: 'browse',
      targetUrl: 'https://www.xiaohongshu.com/explore/navigation-fail'
    })

    expect(result).toEqual({
      success: false,
      steps: [
        { step: 'navigate_target', success: false, error: 'navigation timeout' }
      ]
    })
  })

  it('returns a failed browse step when human scrolling fails', async () => {
    const behavior = {
      randomDelay: vi.fn().mockResolvedValue(undefined),
      humanScroll: vi.fn().mockRejectedValue(new Error('scroll failed'))
    }
    const adapter = new XiaohongshuInteractionAdapter(behavior)

    const result = await adapter.run({
      page: createPage(),
      action: 'browse',
      targetUrl: 'https://www.xiaohongshu.com/explore/scroll-fail'
    })

    expect(result).toEqual({
      success: false,
      steps: [
        { step: 'navigate_target', success: true },
        { step: 'browse_target', success: false, error: 'scroll failed' }
      ]
    })
  })

  it('rejects unsupported runtime actions', async () => {
    const adapter = new XiaohongshuInteractionAdapter(createBehavior())

    await expect(
      adapter.run({
        page: createPage(),
        action: 'share',
        targetUrl: 'https://www.xiaohongshu.com/explore/share-target'
      } as unknown as Parameters<XiaohongshuInteractionAdapter['run']>[0])
    ).rejects.toThrow('unsupported interaction action: share')
  })
})
