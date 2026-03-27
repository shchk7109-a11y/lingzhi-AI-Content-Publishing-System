import type { ElementHandle } from 'puppeteer-core'
import { BasePublisher } from './BasePublisher'

/**
 * 小红书发布器
 * 基于 creator.xiaohongshu.com/publish/publish 实际页面结构
 */
export class XiaohongshuPublisher extends BasePublisher {
  protected async warmup(accountLevel: string): Promise<void> {
    const intensity = accountLevel === 'new' ? 'high'
      : accountLevel === 'growing' ? 'medium'
      : 'low'
    await this.behavior.warmup(this.page, intensity)
  }

  protected async navigateToPublish(): Promise<void> {
    console.log('[XHS] Navigating to publish page...')

    await this.page.goto('https://creator.xiaohongshu.com/publish/publish', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    await this.behavior.randomDelay(2000, 4000)

    // 检测登录弹窗
    const needsLogin = await this.page.evaluate(() => {
      const html = document.body.innerHTML
      return html.includes('login') && (html.includes('二维码') || html.includes('扫码'))
    })
    if (needsLogin) {
      throw new Error('需要登录：请先在Bit浏览器中手动登录小红书')
    }

    // 等待上传区域出现
    const hasUpload = await this.behavior.waitForElement(this.page, 'input[type="file"]', 8000)
    console.log(`[XHS] Upload input found: ${hasUpload}`)

    console.log('[XHS] Publish page loaded')
  }

  protected async uploadMedia(paths: string[], isVideo: boolean): Promise<void> {
    if (paths.length === 0) throw new Error('没有媒体文件可上传')

    console.log(`[XHS] Uploading ${paths.length} ${isVideo ? 'video' : 'image'} files...`)

    // 查找 file input（可能隐藏）
    const fileInput = await this.page.$('input[type="file"]')
    if (!fileInput) throw new Error('未找到文件上传输入框')

    await fileInput.uploadFile(...paths)
    console.log(`[XHS] Files injected: ${paths.length}`)

    // 等待上传完成：图片上传后页面会切换到编辑模式
    // 检测标志：出现标题输入区域或字数统计
    console.log('[XHS] Waiting for editor to appear after upload...')
    const maxWaitMs = isVideo ? 120000 : 60000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      await this.behavior.randomDelay(1500, 2500)

      // 检查编辑器是否已出现（标题/正文区域）
      const editorReady = await this.page.evaluate(() => {
        // 查找包含"标题"placeholder的元素
        const allElements = document.querySelectorAll('[placeholder], [data-placeholder]')
        for (const el of allElements) {
          const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
          if (ph.includes('标题')) return true
        }
        // 查找字数统计 0/20
        const html = document.body.innerText
        if (html.includes('/20') || html.includes('/1000')) return true
        // 查找 contenteditable 元素（编辑模式标志）
        const editables = document.querySelectorAll('[contenteditable="true"]')
        if (editables.length >= 2) return true
        return false
      })

      if (editorReady) {
        console.log('[XHS] Editor appeared - upload complete')
        break
      }

      if (Date.now() - startTime > maxWaitMs * 0.8) {
        console.warn('[XHS] Upload wait timeout, proceeding anyway')
        break
      }
    }

    await this.behavior.randomDelay(1000, 2000)
  }

  /**
   * 填写标题（最多20字）
   * 策略：用 page.evaluate 在DOM中精确定位标题输入元素
   */
  protected async inputTitle(title: string): Promise<void> {
    const truncatedTitle = title.slice(0, 20)
    console.log(`[XHS] Inputting title: "${truncatedTitle}"`)

    // 在浏览器上下文中查找标题输入元素
    const titleEl = await this.findTitleElement()
    if (!titleEl) {
      // 打印页面调试信息
      await this.debugPageStructure('title')
      throw new Error('未找到标题输入元素')
    }

    // 点击获取焦点
    await titleEl.click()
    await this.behavior.randomDelay(300, 500)

    // 清空已有内容
    await this.page.keyboard.down('Control')
    await this.page.keyboard.press('a')
    await this.page.keyboard.up('Control')
    await this.page.keyboard.press('Backspace')
    await this.behavior.randomDelay(200, 400)

    // 输入标题
    await this.behavior.humanTypeInPlace(this.page, truncatedTitle)
    await this.behavior.randomDelay(500, 1000)

    console.log('[XHS] Title input done')
  }

  /**
   * 查找标题输入元素
   */
  private async findTitleElement(): Promise<ElementHandle | null> {
    // 方案1: placeholder 包含"标题"的 input 元素
    const selectors = [
      'input[placeholder*="标题"]',
      'input[placeholder*="填写标题"]',
      'textarea[placeholder*="标题"]',
    ]
    for (const sel of selectors) {
      const el = await this.page.$(sel)
      if (el) {
        console.log(`[XHS] Title found via selector: ${sel}`)
        return el
      }
    }

    // 方案2: placeholder/data-placeholder 包含"标题"的 contenteditable div
    const editableTitle = await this.page.evaluateHandle(() => {
      // 查找所有 contenteditable 元素
      const editables = document.querySelectorAll('[contenteditable="true"]')
      for (const el of editables) {
        const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
        if (ph.includes('标题')) return el
      }
      // 查找带 placeholder 子元素包含"标题"文字的 contenteditable
      for (const el of editables) {
        const placeholderChild = el.querySelector('[class*="placeholder"]')
        if (placeholderChild && placeholderChild.textContent?.includes('标题')) return el
      }
      return null
    })
    if (editableTitle && editableTitle.asElement()) {
      console.log('[XHS] Title found via contenteditable with placeholder "标题"')
      return editableTitle.asElement()
    }

    // 方案3: 靠近 "/20" 字数统计的输入元素
    const nearCountEl = await this.page.evaluateHandle(() => {
      // 找到包含 "/20" 的元素
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent && /\/20/.test(node.textContent)) {
          // 从该元素向上/向前查找最近的输入元素
          let parent = node.parentElement
          for (let i = 0; i < 10 && parent; i++) {
            const input = parent.querySelector('input, textarea, [contenteditable="true"]')
            if (input) return input
            parent = parent.parentElement
          }
          // 查找前面的兄弟元素
          const container = node.parentElement?.parentElement
          if (container) {
            const editable = container.querySelector('[contenteditable="true"]')
            if (editable) return editable
            const inputEl = container.querySelector('input, textarea')
            if (inputEl) return inputEl
          }
        }
      }
      return null
    })
    if (nearCountEl && nearCountEl.asElement()) {
      console.log('[XHS] Title found via proximity to "/20" counter')
      return nearCountEl.asElement()
    }

    // 方案4: 第一个 contenteditable（上传图片后编辑模式通常第一个是标题）
    const firstEditable = await this.page.$('[contenteditable="true"]')
    if (firstEditable) {
      const box = await firstEditable.boundingBox()
      if (box && box.height < 100) {
        console.log('[XHS] Title found via first contenteditable (small height)')
        return firstEditable
      }
    }

    // 方案5: class 名包含 title 的输入元素
    const classTitle = await this.page.$('[class*="title"] input, [class*="title"] [contenteditable="true"], [class*="title"][contenteditable="true"]')
    if (classTitle) {
      console.log('[XHS] Title found via class containing "title"')
      return classTitle
    }

    return null
  }

  /**
   * 填写正文
   * 策略：查找标题之外的第二个 contenteditable 或包含"正文"placeholder的元素
   */
  protected async inputContent(content: string): Promise<void> {
    console.log(`[XHS] Inputting content (${content.length} chars)`)

    const contentEl = await this.findContentElement()
    if (!contentEl) {
      await this.debugPageStructure('content')
      throw new Error('未找到正文输入元素')
    }

    // 点击获取焦点
    await contentEl.click()
    await this.behavior.randomDelay(300, 600)

    // 输入正文
    await this.behavior.humanTypeInPlace(this.page, content)
    await this.behavior.randomDelay(500, 1000)

    console.log('[XHS] Content input done')
  }

  /**
   * 查找正文输入元素
   */
  private async findContentElement(): Promise<ElementHandle | null> {
    // 方案1: placeholder 包含"正文"或"描述"
    const contentEl = await this.page.evaluateHandle(() => {
      const editables = document.querySelectorAll('[contenteditable="true"]')
      for (const el of editables) {
        const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
        if (ph.includes('正文') || ph.includes('描述') || ph.includes('输入正文')) return el
      }
      // 查找 placeholder 子元素
      for (const el of editables) {
        const placeholderChild = el.querySelector('[class*="placeholder"]')
        if (placeholderChild) {
          const text = placeholderChild.textContent || ''
          if (text.includes('正文') || text.includes('描述')) return el
        }
      }
      return null
    })
    if (contentEl && contentEl.asElement()) {
      console.log('[XHS] Content found via placeholder containing "正文/描述"')
      return contentEl.asElement()
    }

    // 方案2: 靠近 "/1000" 字数统计的元素
    const nearCount = await this.page.evaluateHandle(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent && /\/1000/.test(node.textContent)) {
          let parent = node.parentElement
          for (let i = 0; i < 10 && parent; i++) {
            const editable = parent.querySelector('[contenteditable="true"]')
            if (editable) return editable
            parent = parent.parentElement
          }
        }
      }
      return null
    })
    if (nearCount && nearCount.asElement()) {
      console.log('[XHS] Content found via proximity to "/1000" counter')
      return nearCount.asElement()
    }

    // 方案3: .ql-editor 或常见编辑器类
    for (const sel of ['.ql-editor', '#post-content', '[class*="editor"][contenteditable]']) {
      const el = await this.page.$(sel)
      if (el) {
        console.log(`[XHS] Content found via selector: ${sel}`)
        return el
      }
    }

    // 方案4: 第二个 contenteditable（第一个通常是标题）
    const editables = await this.page.$$('[contenteditable="true"]')
    console.log(`[XHS] Found ${editables.length} contenteditable elements total`)
    if (editables.length >= 2) {
      // 找高度最大的那个（正文区域通常更高）
      let maxHeight = 0
      let bestEl: ElementHandle | null = null
      for (const el of editables) {
        const box = await el.boundingBox()
        if (box && box.height > maxHeight) {
          maxHeight = box.height
          bestEl = el
        }
      }
      if (bestEl) {
        console.log(`[XHS] Content found via largest contenteditable (height: ${maxHeight}px)`)
        return bestEl
      }
      // 退而求其次：取第二个
      console.log('[XHS] Content found via second contenteditable')
      return editables[1]
    }

    return null
  }

  /**
   * 添加话题标签
   * 策略：查找 "# 话题" 按钮或标签输入区
   */
  protected async addTags(tags: string[]): Promise<void> {
    const limitedTags = tags.slice(0, 5)
    if (limitedTags.length === 0) return

    console.log(`[XHS] Adding ${limitedTags.length} tags`)

    for (const tag of limitedTags) {
      try {
        // 方案1: 找到"# 话题"按钮并点击
        const topicBtn = await this.findTopicButton()
        if (topicBtn) {
          await topicBtn.click()
          await this.behavior.randomDelay(500, 800)

          // 等待输入框出现
          const topicInput = await this.page.evaluateHandle(() => {
            // 查找当前聚焦的input或最近出现的搜索输入框
            const active = document.activeElement
            if (active && (active.tagName === 'INPUT' || active.getAttribute('contenteditable'))) return active
            // 查找话题搜索输入
            const inputs = document.querySelectorAll('input[placeholder*="搜索"], input[placeholder*="话题"], input[type="search"]')
            if (inputs.length > 0) return inputs[inputs.length - 1]
            return null
          })

          if (topicInput && topicInput.asElement()) {
            const inputEl = topicInput.asElement()!
            await inputEl.click()
            await this.behavior.randomDelay(200, 400)
            await this.behavior.humanTypeInPlace(this.page, tag)
          } else {
            // 直接打字（可能焦点已经在输入框）
            await this.behavior.humanTypeInPlace(this.page, tag)
          }
        } else {
          // 方案2: 在正文末尾手动输入 #tag
          console.log(`[XHS] Topic button not found, appending #${tag} to content`)
          // 先点击正文区域末尾
          await this.page.keyboard.press('End')
          await this.page.keyboard.insertText(` #${tag}`)
          await this.behavior.randomDelay(300, 500)
          continue
        }

        await this.behavior.randomDelay(800, 1500)

        // 等待建议列表并点击第一个
        const clicked = await this.clickFirstSuggestion()
        if (!clicked) {
          // 没有建议，按 Enter 确认
          await this.page.keyboard.press('Enter')
          console.log(`[XHS] Tag "${tag}" confirmed via Enter`)
        } else {
          console.log(`[XHS] Tag "${tag}" selected from suggestions`)
        }

        await this.behavior.randomDelay(500, 800)
      } catch (error) {
        console.warn(`[XHS] Failed to add tag "${tag}":`, (error as Error).message)
      }
    }
  }

  /**
   * 查找 "# 话题" 按钮
   */
  private async findTopicButton(): Promise<ElementHandle | null> {
    // 遍历按钮/可点击元素，找文本包含"话题"或"#"的
    const btn = await this.page.evaluateHandle(() => {
      const candidates = document.querySelectorAll('button, [role="button"], span[class*="topic"], div[class*="topic"], [class*="hash-tag"], [class*="hashtag"]')
      for (const el of candidates) {
        const text = el.textContent?.trim() || ''
        if (text === '#' || text === '# 话题' || text === '#话题' || text.includes('话题')) {
          return el
        }
      }
      // 查找 SVG+文字组合的话题按钮
      const allEls = document.querySelectorAll('div, span')
      for (const el of allEls) {
        if (el.children.length <= 3 && el.textContent?.trim() === '# 话题') return el
      }
      return null
    })
    if (btn && btn.asElement()) {
      console.log('[XHS] Topic button found')
      return btn.asElement()
    }
    console.log('[XHS] Topic button not found')
    return null
  }

  /**
   * 点击建议列表的第一个结果
   */
  private async clickFirstSuggestion(): Promise<boolean> {
    // 等待最多3秒
    for (let i = 0; i < 6; i++) {
      await this.behavior.randomDelay(400, 600)

      const suggestion = await this.page.evaluateHandle(() => {
        // 查找下拉建议列表的第一个可点击项
        const selectors = [
          '[class*="suggestion"] li',
          '[class*="topic-item"]',
          '[class*="search-result"] [class*="item"]',
          '[class*="dropdown"] [class*="option"]',
          '[class*="hashtag-list"] [class*="item"]',
          '[class*="topic-list"] > div',
          '[class*="result-list"] > div',
        ]
        for (const sel of selectors) {
          const items = document.querySelectorAll(sel)
          if (items.length > 0) return items[0]
        }
        return null
      })

      if (suggestion && suggestion.asElement()) {
        const el = suggestion.asElement()!
        await el.click()
        return true
      }
    }
    return false
  }

  /**
   * 点击发布按钮
   */
  protected async clickPublish(): Promise<string | null> {
    console.log('[XHS] Looking for publish button...')

    // 遍历所有 button，找文本为"发布"的（排除"暂存"）
    const buttons = await this.page.$$('button')
    console.log(`[XHS] Found ${buttons.length} buttons on page`)

    for (const btn of buttons) {
      const text = await btn.evaluate((el) => el.textContent?.trim() || '')
      const isDisabled = await btn.evaluate((el) => (el as HTMLButtonElement).disabled)
      console.log(`[XHS] Button: "${text}" disabled=${isDisabled}`)

      if (text === '发布' || (text.includes('发布') && !text.includes('暂存') && !text.includes('定时'))) {
        if (isDisabled) {
          console.warn('[XHS] Publish button found but disabled')
          continue
        }
        const box = await btn.boundingBox()
        if (box) {
          await this.takeScreenshot('before_publish')
          await this.behavior.humanClickAt(this.page, box.x + box.width / 2, box.y + box.height / 2)
          console.log('[XHS] Publish button clicked')
          return await this.waitForPublishResult()
        }
      }
    }

    // 备选: 查找 class 包含 publish/submit 的按钮
    for (const sel of ['[class*="publish"] button', 'button[class*="publish"]', 'button[class*="submit"]']) {
      const el = await this.page.$(sel)
      if (el) {
        await this.takeScreenshot('before_publish')
        await this.behavior.humanClick(this.page, sel)
        console.log(`[XHS] Publish button clicked via selector: ${sel}`)
        return await this.waitForPublishResult()
      }
    }

    throw new Error('未找到发布按钮')
  }

  private async waitForPublishResult(): Promise<string | null> {
    const startUrl = this.page.url()

    for (let i = 0; i < 30; i++) {
      await this.behavior.randomDelay(400, 600)

      const currentUrl = this.page.url()
      if (currentUrl !== startUrl && currentUrl.includes('xiaohongshu.com')) {
        console.log(`[XHS] Publish success! URL: ${currentUrl}`)
        return currentUrl
      }

      // 检查成功提示（弹窗或 toast）
      const hasSuccess = await this.page.evaluate(() => {
        const body = document.body.innerText
        return body.includes('发布成功') || body.includes('已发布')
      })
      if (hasSuccess) {
        console.log('[XHS] Publish success detected via text')
        return this.page.url()
      }

      // 检查错误提示
      const errorText = await this.page.evaluate(() => {
        const toasts = document.querySelectorAll('[class*="toast"], [class*="message"], [class*="notification"]')
        for (const t of toasts) {
          const text = t.textContent || ''
          if (text.includes('失败') || text.includes('错误') || text.includes('不能')) return text.trim()
        }
        return null
      })
      if (errorText) {
        throw new Error(`发布失败: ${errorText}`)
      }
    }

    const finalUrl = this.page.url()
    if (finalUrl !== startUrl) return finalUrl

    console.warn('[XHS] No clear publish result after 15s')
    return null
  }

  protected async cooldown(): Promise<void> {
    await this.behavior.cooldown(this.page)
  }

  /**
   * 调试：打印页面中所有可交互元素的信息
   */
  private async debugPageStructure(context: string): Promise<void> {
    console.log(`[XHS DEBUG] === ${context} element scan ===`)

    const info = await this.page.evaluate(() => {
      const result: string[] = []

      // 所有 input
      const inputs = document.querySelectorAll('input, textarea')
      result.push(`--- Inputs (${inputs.length}) ---`)
      inputs.forEach((el, i) => {
        result.push(`  [${i}] <${el.tagName.toLowerCase()}> type="${el.getAttribute('type')}" placeholder="${el.getAttribute('placeholder')}" class="${el.className?.toString().slice(0, 60)}"`)
      })

      // 所有 contenteditable
      const editables = document.querySelectorAll('[contenteditable="true"]')
      result.push(`--- Contenteditable (${editables.length}) ---`)
      editables.forEach((el, i) => {
        const rect = el.getBoundingClientRect()
        result.push(`  [${i}] <${el.tagName.toLowerCase()}> placeholder="${el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''}" class="${el.className?.toString().slice(0, 60)}" size=${Math.round(rect.width)}x${Math.round(rect.height)}`)
      })

      // 包含"标题"或"正文"文字的元素
      const allEls = document.querySelectorAll('[placeholder], [data-placeholder]')
      result.push(`--- Elements with placeholder (${allEls.length}) ---`)
      allEls.forEach((el, i) => {
        const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
        if (ph) result.push(`  [${i}] <${el.tagName.toLowerCase()}> "${ph}" editable=${el.getAttribute('contenteditable')}`)
      })

      // 字数统计元素
      result.push('--- Text containing /20 or /1000 ---')
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent && (/\/20\b/.test(node.textContent) || /\/1000/.test(node.textContent))) {
          const parent = node.parentElement
          result.push(`  "${node.textContent.trim()}" parent=<${parent?.tagName.toLowerCase()}> class="${parent?.className?.toString().slice(0, 60)}"`)
        }
      }

      return result.join('\n')
    })

    console.log(info)
    console.log(`[XHS DEBUG] === end ${context} scan ===`)
  }
}
