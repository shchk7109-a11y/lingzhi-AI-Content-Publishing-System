import { BasePublisher } from './BasePublisher'

/**
 * 抖音发布器
 * 支持视频与图文发布，完整链路：预热→导航→上传→填写→话题→发布→冷却
 *
 * ⚠️ 抖音创作者中心（creator.douyin.com）页面结构变动频繁，
 * 以下选择器采用多候选容错策略，首次上线需在真机对照实际 DOM 校准。
 */
export class DouyinPublisher extends BasePublisher {
  // 由 uploadMedia 根据 isVideo 设置，供 inputTitle 判断是否有独立标题框
  private isVideoMode = true

  /**
   * 预热：抖音创作页无信息流，做轻量停留模拟人工即可
   */
  protected async warmup(accountLevel: string): Promise<void> {
    const range = accountLevel === 'new' ? [4000, 8000]
      : accountLevel === 'growing' ? [2000, 5000]
      : [1000, 3000]
    await this.behavior.randomDelay(range[0], range[1])
  }

  /**
   * 导航到抖音创作者中心上传页
   */
  protected async navigateToPublish(): Promise<void> {
    console.log('[Douyin] Navigating to upload page...')
    await this.page.goto('https://creator.douyin.com/creator-micro/content/upload', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    await this.behavior.randomDelay(2000, 4000)

    // 登录检测：跳到登录/passport 说明未登录
    const url = this.page.url()
    if (url.includes('login') || url.includes('passport')) {
      throw new Error('需要登录：请先在Bit浏览器中手动登录抖音创作者中心')
    }
    console.log('[Douyin] Upload page loaded')
  }

  /**
   * 上传视频或图片
   */
  protected async uploadMedia(paths: string[], isVideo: boolean): Promise<void> {
    if (paths.length === 0) {
      throw new Error('没有媒体文件可上传')
    }
    this.isVideoMode = isVideo
    console.log(`[Douyin] Uploading ${paths.length} ${isVideo ? 'video' : 'image'} file(s)...`)

    // 图文模式：先切到"发布图文"
    if (!isVideo) {
      await this.switchToImageTextMode()
    }

    const fileInput = await this.findFileInput()
    if (!fileInput) {
      throw new Error('未找到文件上传输入框，抖音页面结构可能已变更')
    }

    await fileInput.uploadFile(...paths)
    console.log(`[Douyin] Files injected: ${paths.length}`)

    // 等待上传/转码完成——出现描述框或标题框视为进入编辑态
    const maxWaitMs = isVideo ? 180000 : 60000
    const start = Date.now()
    while (Date.now() - start < maxWaitMs) {
      await this.behavior.randomDelay(2000, 4000)
      const editor = await this.page.$(
        '[contenteditable="true"], textarea[placeholder*="描述"], input[placeholder*="标题"]'
      )
      if (editor) {
        console.log('[Douyin] Editor detected, upload/transcode done')
        break
      }
      if (Date.now() - start > maxWaitMs * 0.9) {
        console.warn('[Douyin] Upload taking too long, proceeding anyway')
        break
      }
    }
    await this.behavior.randomDelay(1000, 2000)
  }

  /**
   * 切换到"发布图文"模式
   */
  private async switchToImageTextMode(): Promise<void> {
    const candidates = await this.page.$$('div, span, button')
    for (const el of candidates) {
      const text = await el.evaluate((node) => node.textContent?.trim() || '')
      if (text === '发布图文' || text === '图文') {
        try {
          const box = await el.boundingBox()
          if (box) {
            await this.behavior.humanClickAt(this.page, box.x + box.width / 2, box.y + box.height / 2)
            await this.behavior.randomDelay(1000, 2000)
            console.log('[Douyin] Switched to image-text mode')
            return
          }
        } catch { /* 尝试下一个 */ }
      }
    }
    console.warn('[Douyin] Image-text switch not found, assuming already in image mode')
  }

  /**
   * 查找文件上传输入框
   */
  private async findFileInput(): ReturnType<typeof this.page.$> {
    const selectors = [
      'input[type="file"]',
      'input[accept*="video"]',
      'input[accept*="image"]',
      '.upload-btn input'
    ]
    for (const sel of selectors) {
      const el = await this.page.$(sel)
      if (el) return el
    }
    const all = await this.page.$$('input[type="file"]')
    return all.length > 0 ? all[0] : null
  }

  /**
   * 填写标题（仅图文模式有独立标题框；视频模式标题并入作品描述）
   */
  protected async inputTitle(title: string): Promise<void> {
    if (this.isVideoMode) return

    const titleSelectors = [
      'input[placeholder*="标题"]',
      'input[placeholder*="填写标题"]',
      '.title-input input',
      '[class*="title"] input'
    ]
    const sel = await this.findElement(titleSelectors)
    if (sel) {
      console.log('[Douyin] Inputting title')
      await this.behavior.humanType(this.page, sel, title.slice(0, 30))
      await this.behavior.randomDelay(500, 1000)
    }
  }

  /**
   * 填写作品描述/正文
   */
  protected async inputContent(content: string): Promise<void> {
    console.log(`[Douyin] Inputting content (${content.length} chars)`)
    const contentSelectors = [
      'div[contenteditable="true"][data-placeholder*="作品"]',
      'div[contenteditable="true"][data-placeholder*="描述"]',
      '.editor-kit-container [contenteditable="true"]',
      'textarea[placeholder*="描述"]',
      'textarea[placeholder*="正文"]',
      'div[contenteditable="true"]'
    ]
    const sel = await this.findElement(contentSelectors)
    if (sel) {
      await this.behavior.humanClick(this.page, sel)
      await this.behavior.randomDelay(300, 600)
      await this.behavior.humanTypeInPlace(this.page, content)
    } else {
      throw new Error('未找到作品描述输入框')
    }
    await this.behavior.randomDelay(500, 1000)
  }

  /**
   * 添加话题（最多5个）：在描述框输入 #话题 触发下拉并选中
   */
  protected async addTags(tags: string[]): Promise<void> {
    const limited = tags.slice(0, 5)
    if (limited.length === 0) return
    console.log(`[Douyin] Adding ${limited.length} topics`)

    for (const tag of limited) {
      try {
        await this.page.keyboard.type(` #${tag}`)
        await this.behavior.randomDelay(800, 1500)

        const suggestion = await this.page.$(
          '[class*="suggest"] [class*="item"], [class*="topic"] li, [class*="mention"] [class*="item"]'
        )
        if (suggestion) {
          const box = await suggestion.boundingBox()
          if (box) {
            await this.behavior.humanClickAt(this.page, box.x + box.width / 2, box.y + box.height / 2)
          } else {
            await this.page.keyboard.press('Space')
          }
        } else {
          // 无下拉建议则用空格确认话题
          await this.page.keyboard.press('Space')
        }
        await this.behavior.randomDelay(500, 1000)
      } catch (error) {
        console.warn(`[Douyin] Failed to add topic "${tag}":`, (error as Error).message)
      }
    }
  }

  /**
   * 点击发布
   */
  protected async clickPublish(): Promise<string | null> {
    console.log('[Douyin] Looking for publish button...')
    await this.takeScreenshot('before_publish')

    const publishSelectors = [
      'button.publish-btn',
      '[class*="publish"] button',
      'button[class*="submit"]'
    ]
    let clicked = false

    const sel = await this.findElement(publishSelectors)
    if (sel) {
      await this.behavior.humanClick(this.page, sel)
      clicked = true
    } else {
      const buttons = await this.page.$$('button')
      for (const btn of buttons) {
        const text = await btn.evaluate((el) => el.textContent?.trim() || '')
        if (text.includes('发布') && !text.includes('定时') && !text.includes('草稿')) {
          const box = await btn.boundingBox()
          if (box) {
            await this.behavior.humanClickAt(this.page, box.x + box.width / 2, box.y + box.height / 2)
            clicked = true
            break
          }
        }
      }
    }

    if (!clicked) {
      throw new Error('未找到发布按钮')
    }
    console.log('[Douyin] Publish button clicked')
    return await this.waitForPublishResult()
  }

  /**
   * 等待发布结果（成功跳转到作品管理页）
   */
  private async waitForPublishResult(): Promise<string | null> {
    const startUrl = this.page.url()

    for (let i = 0; i < 30; i++) {
      await this.behavior.randomDelay(400, 600)

      const currentUrl = this.page.url()
      if (currentUrl !== startUrl && !currentUrl.includes('upload') && currentUrl.includes('creator')) {
        console.log(`[Douyin] Publish success! URL: ${currentUrl}`)
        return currentUrl
      }

      const successToast = await this.page.$('[class*="success"], [class*="toast"][class*="success"]')
      if (successToast) {
        console.log('[Douyin] Publish success detected via toast')
        return this.page.url()
      }

      const errorEl = await this.page.$('[class*="error-toast"], [class*="toast"][class*="error"]')
      if (errorEl) {
        const errorText = await errorEl.evaluate((el) => el.textContent?.trim() || '')
        if (errorText) {
          throw new Error(`发布失败: ${errorText}`)
        }
      }
    }

    const finalUrl = this.page.url()
    if (finalUrl !== startUrl && !finalUrl.includes('upload')) {
      return finalUrl
    }
    console.warn('[Douyin] No clear publish result after ~15s, assuming success')
    return null
  }

  /**
   * 冷却
   */
  protected async cooldown(): Promise<void> {
    await this.behavior.randomDelay(3000, 8000)
  }
}
