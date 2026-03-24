import { BasePublisher } from './BasePublisher'

/**
 * 小红书发布器
 * 支持图文和视频发布，完整链路：预热→导航→上传→填写→发布→冷却
 */
export class XiaohongshuPublisher extends BasePublisher {
  /**
   * 预热浏览
   */
  protected async warmup(accountLevel: string): Promise<void> {
    const intensity = accountLevel === 'new' ? 'high'
      : accountLevel === 'growing' ? 'medium'
      : 'low'
    await this.behavior.warmup(this.page, intensity)
  }

  /**
   * 导航到创作页面
   */
  protected async navigateToPublish(): Promise<void> {
    console.log('[XHS] Navigating to publish page...')

    await this.page.goto('https://creator.xiaohongshu.com/publish/publish', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    await this.behavior.randomDelay(2000, 4000)

    // 检测是否需要登录（如果出现登录弹窗）
    const loginModal = await this.page.$('.login-modal, .login-container, [class*="login-box"]')
    if (loginModal) {
      throw new Error('需要登录：检测到登录弹窗，请先在Bit浏览器中手动登录小红书')
    }

    // 等待上传区域出现
    const uploadAreaSelectors = [
      'input[type="file"]',
      '.upload-wrapper',
      '.upload-input',
      '[class*="upload"]',
      '.drag-over'
    ]

    let found = false
    for (const sel of uploadAreaSelectors) {
      if (await this.behavior.waitForElement(this.page, sel, 5000)) {
        found = true
        break
      }
    }

    if (!found) {
      // 可能页面结构变了，不阻塞继续
      console.warn('[XHS] Upload area not found with known selectors, proceeding anyway')
    }

    console.log('[XHS] Publish page loaded')
  }

  /**
   * 上传图片/视频
   * 优先通过 input[type="file"] 注入文件
   */
  protected async uploadMedia(paths: string[], isVideo: boolean): Promise<void> {
    if (paths.length === 0) {
      throw new Error('没有媒体文件可上传')
    }

    console.log(`[XHS] Uploading ${paths.length} ${isVideo ? 'video' : 'image'} files...`)

    // 查找文件输入元素
    const fileInputSelectors = [
      'input[type="file"]',
      'input[accept*="image"]',
      'input[accept*="video"]',
      '.upload-input input',
      'input.upload-file'
    ]

    let fileInput = null
    for (const sel of fileInputSelectors) {
      fileInput = await this.page.$(sel)
      if (fileInput) break
    }

    if (!fileInput) {
      // 尝试查找所有隐藏的file input
      const allInputs = await this.page.$$('input[type="file"]')
      if (allInputs.length > 0) {
        fileInput = allInputs[0]
      }
    }

    if (!fileInput) {
      throw new Error('未找到文件上传输入框，小红书页面结构可能已变更')
    }

    // 通过 uploadFile 注入文件
    await fileInput.uploadFile(...paths)
    console.log(`[XHS] Files injected: ${paths.length}`)

    // 等待上传完成
    const maxWaitMs = isVideo ? 120000 : 60000
    const startTime = Date.now()

    // 轮询检查上传进度
    while (Date.now() - startTime < maxWaitMs) {
      await this.behavior.randomDelay(1500, 3000)

      // 检查是否有上传进度条还在
      const progressBar = await this.page.$('.progress-bar:not(.complete), [class*="uploading"], [class*="progress"]:not([class*="complete"])')
      if (!progressBar) {
        // 检查是否有缩略图（上传成功的标志）
        const thumbnail = await this.page.$('.image-item, .upload-item, [class*="thumbnail"], img[class*="preview"]')
        if (thumbnail) {
          console.log('[XHS] Upload completed - thumbnails detected')
          break
        }
      }

      if (Date.now() - startTime > maxWaitMs * 0.8) {
        console.warn('[XHS] Upload taking too long, proceeding anyway')
        break
      }
    }

    await this.behavior.randomDelay(1000, 2000)
    console.log('[XHS] Media upload step done')
  }

  /**
   * 填写标题（最多20字）
   */
  protected async inputTitle(title: string): Promise<void> {
    const truncatedTitle = title.slice(0, 20)
    console.log(`[XHS] Inputting title: "${truncatedTitle}"`)

    const titleSelectors = [
      '#title',
      'input[placeholder*="标题"]',
      'input[placeholder*="填写标题"]',
      '.title-input',
      '[data-testid="title-input"]',
      'input[maxlength="20"]',
      '.c-input_inner[placeholder*="标题"]'
    ]

    const selector = await this.findElement(titleSelectors)

    if (selector) {
      await this.behavior.humanType(this.page, selector, truncatedTitle)
    } else {
      // 备选：查找第一个看起来像标题输入的contenteditable
      const editables = await this.page.$$('[contenteditable="true"]')
      if (editables.length > 0) {
        await editables[0].click()
        await this.behavior.randomDelay(300, 500)
        await this.behavior.humanTypeInPlace(this.page, truncatedTitle)
      } else {
        throw new Error('未找到标题输入框')
      }
    }

    await this.behavior.randomDelay(500, 1000)
  }

  /**
   * 填写正文
   */
  protected async inputContent(content: string): Promise<void> {
    console.log(`[XHS] Inputting content (${content.length} chars)`)

    const contentSelectors = [
      '#post-content',
      '.ql-editor',
      '[contenteditable="true"]:not(#title)',
      '.content-input',
      'div[data-placeholder*="正文"]',
      'div[data-placeholder*="内容"]',
      '.DraftEditor-root',
      '[class*="editor"][contenteditable="true"]'
    ]

    // 优先找到正文编辑器（排除标题输入框）
    let targetSelector: string | null = null

    for (const sel of contentSelectors) {
      const elements = await this.page.$$(sel)
      for (const el of elements) {
        const tagName = await el.evaluate((e) => e.tagName.toLowerCase())
        // 正文通常是 div 而非 input
        if (tagName === 'div' || sel.includes('editor') || sel.includes('content')) {
          const box = await el.boundingBox()
          if (box && box.height > 50) {
            targetSelector = sel
            break
          }
        }
      }
      if (targetSelector) break
    }

    if (targetSelector) {
      // 点击编辑区域获取焦点
      await this.behavior.humanClick(this.page, targetSelector)
      await this.behavior.randomDelay(300, 600)
      // 在焦点处直接输入
      await this.behavior.humanTypeInPlace(this.page, content)
    } else {
      // 最终备选：Tab到下一个区域
      await this.page.keyboard.press('Tab')
      await this.behavior.randomDelay(500, 800)
      await this.behavior.humanTypeInPlace(this.page, content)
    }

    await this.behavior.randomDelay(500, 1000)
  }

  /**
   * 添加话题标签（最多5个）
   */
  protected async addTags(tags: string[]): Promise<void> {
    const limitedTags = tags.slice(0, 5)
    if (limitedTags.length === 0) return

    console.log(`[XHS] Adding ${limitedTags.length} tags`)

    // 查找标签输入区域
    const tagInputSelectors = [
      '#post-topic',
      '.tag-input',
      'input[placeholder*="标签"]',
      'input[placeholder*="话题"]',
      '[class*="topic"] input',
      '[class*="tag"] input',
      '.add-topic input'
    ]

    for (const tag of limitedTags) {
      try {
        const tagSelector = await this.findElement(tagInputSelectors)

        if (tagSelector) {
          // 在标签输入框输入 # + 标签文字
          await this.behavior.humanType(this.page, tagSelector, `#${tag}`)
        } else {
          // 备选：在正文末尾添加
          await this.page.keyboard.insertText(` #${tag}`)
        }

        await this.behavior.randomDelay(800, 1500)

        // 等待下拉建议出现
        const suggestionSelectors = [
          '.tag-suggestion-item:first-child',
          '[class*="suggestion"] li:first-child',
          '[class*="topic-item"]:first-child',
          '.search-result-item:first-child',
          '[class*="dropdown"] [class*="item"]:first-child'
        ]

        let clicked = false
        for (const sugSel of suggestionSelectors) {
          if (await this.behavior.waitForElement(this.page, sugSel, 3000)) {
            try {
              await this.behavior.humanClick(this.page, sugSel)
              clicked = true
              break
            } catch { /* 继续尝试下一个选择器 */ }
          }
        }

        // 如果没有建议可点，按Enter确认
        if (!clicked) {
          await this.page.keyboard.press('Enter')
        }

        await this.behavior.randomDelay(500, 1000)
      } catch (error) {
        console.warn(`[XHS] Failed to add tag "${tag}":`, (error as Error).message)
        // 单个标签失败不阻塞
      }
    }
  }

  /**
   * 点击发布按钮
   */
  protected async clickPublish(): Promise<string | null> {
    console.log('[XHS] Looking for publish button...')

    // 查找发布按钮
    const publishBtnSelectors = [
      'button:has-text("发布")',
      'button[class*="publish"]',
      '.publish-btn',
      '[class*="submit"] button',
      'button.css-k4lz0r' // 小红书常见class
    ]

    let publishBtn: string | null = null

    // 先尝试固定选择器
    publishBtn = await this.findElement(publishBtnSelectors)

    // 如果固定选择器找不到，遍历所有button检查文字
    if (!publishBtn) {
      const buttons = await this.page.$$('button')
      for (const btn of buttons) {
        const text = await btn.evaluate((el) => el.textContent?.trim() || '')
        if (text.includes('发布') && !text.includes('暂存') && !text.includes('定时')) {
          const box = await btn.boundingBox()
          if (box) {
            // 用截图记录发布前状态
            await this.takeScreenshot('before_publish')
            await this.behavior.humanClickAt(this.page, box.x + box.width / 2, box.y + box.height / 2)
            console.log('[XHS] Publish button clicked')

            // 等待结果
            return await this.waitForPublishResult()
          }
        }
      }
      throw new Error('未找到发布按钮')
    }

    await this.takeScreenshot('before_publish')
    await this.behavior.humanClick(this.page, publishBtn)
    console.log('[XHS] Publish button clicked')

    return await this.waitForPublishResult()
  }

  /**
   * 等待发布结果
   */
  private async waitForPublishResult(): Promise<string | null> {
    const startUrl = this.page.url()

    // 等待最多15秒检测结果
    for (let i = 0; i < 30; i++) {
      await this.behavior.randomDelay(400, 600)

      // 检查URL变化（跳转到笔记详情页 = 成功）
      const currentUrl = this.page.url()
      if (currentUrl !== startUrl && currentUrl.includes('xiaohongshu.com')) {
        console.log(`[XHS] Publish success! URL: ${currentUrl}`)
        return currentUrl
      }

      // 检查成功提示
      const successToast = await this.page.$('[class*="success"], .toast-success, [class*="toast"][class*="success"]')
      if (successToast) {
        console.log('[XHS] Publish success detected via toast')
        return this.page.url()
      }

      // 检查错误提示
      const errorEl = await this.page.$('[class*="error"], .toast-error, [class*="toast"][class*="error"]')
      if (errorEl) {
        const errorText = await errorEl.evaluate((el) => el.textContent?.trim() || '')
        if (errorText) {
          throw new Error(`发布失败: ${errorText}`)
        }
      }
    }

    // 15秒内没有明确结果，检查URL是否变化
    const finalUrl = this.page.url()
    if (finalUrl !== startUrl) {
      return finalUrl
    }

    console.warn('[XHS] No clear publish result after 15s, assuming success')
    return null
  }

  /**
   * 冷却
   */
  protected async cooldown(): Promise<void> {
    await this.behavior.cooldown(this.page)
  }
}
