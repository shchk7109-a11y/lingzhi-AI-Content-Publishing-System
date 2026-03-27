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
      const html = document.body.innerHTML.toLowerCase()
      return html.includes('login') && (html.includes('二维码') || html.includes('扫码'))
    })
    if (needsLogin) {
      throw new Error('需要登录：请先在Bit浏览器中手动登录小红书')
    }

    // 等待 file input（它可以是隐藏的，所以不要求 visible）
    try {
      await this.page.waitForSelector('input[type="file"]', { timeout: 10000 })
      console.log('[XHS] Upload input ready')
    } catch {
      console.warn('[XHS] Upload input not found via waitForSelector, checking with $...')
      const el = await this.page.$('input[type="file"]')
      if (el) {
        console.log('[XHS] Upload input found via $')
      } else {
        throw new Error('页面未加载上传区域，可能未登录或页面结构变更')
      }
    }

    console.log('[XHS] Publish page loaded')
  }

  protected async uploadMedia(paths: string[], isVideo: boolean): Promise<void> {
    if (paths.length === 0) throw new Error('没有媒体文件可上传')

    console.log(`[XHS] Uploading ${paths.length} ${isVideo ? 'video' : 'image'} files...`)

    // 查找 file input
    const fileInput = await this.page.$('input[type="file"]')
    if (!fileInput) throw new Error('未找到文件上传输入框')

    await fileInput.uploadFile(...paths)
    console.log(`[XHS] Files injected via uploadFile()`)

    // === 关键：等待编辑器完全加载 ===
    // 上传后小红书会异步加载编辑界面（标题+正文+标签区域）
    // 用 waitForFunction 在浏览器上下文中轮询检测
    console.log('[XHS] Waiting for editor to fully load after upload...')

    const timeoutMs = isVideo ? 120000 : 60000

    try {
      await this.page.waitForFunction(() => {
        // 检测方式1：至少有1个 contenteditable 元素
        const editables = document.querySelectorAll('[contenteditable="true"]')
        if (editables.length > 0) return true

        // 检测方式2：页面文字中有字数统计（"0/20" 或 "0/1000"）
        const text = document.body.innerText || ''
        if (text.includes('/20') || text.includes('/1000')) return true

        // 检测方式3：有 placeholder 包含"标题"的元素
        const allPh = document.querySelectorAll('[placeholder], [data-placeholder]')
        for (const el of allPh) {
          const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
          if (ph.includes('\u6807\u9898')) return true  // "标题" 的Unicode
        }

        // 检测方式4：class 包含 title、editor 的元素
        if (document.querySelector('[class*="title-input"], [class*="post-title"], [class*="editor"]')) return true

        return false
      }, { timeout: timeoutMs, polling: 2000 })

      console.log('[XHS] Editor loaded successfully!')
    } catch {
      // 超时但不立即失败，先打印调试信息
      console.warn('[XHS] Editor load timeout, dumping page state...')
      await this.debugPageStructure('upload-wait-timeout')

      // 尝试截图看看当前页面状态
      await this.takeScreenshot('upload_timeout')

      throw new Error(`图片上传后编辑器未加载（等待 ${timeoutMs / 1000}s 超时）。请检查截图确认页面状态。`)
    }

    // 额外等待让 DOM 完全稳定
    await this.behavior.randomDelay(2000, 3000)

    // 验证编辑器确实存在
    const editorInfo = await this.page.evaluate(() => {
      const editables = document.querySelectorAll('[contenteditable="true"]')
      const inputs = document.querySelectorAll('input:not([type="file"]), textarea')
      return {
        editableCount: editables.length,
        inputCount: inputs.length,
        hasTitle: !!document.querySelector('[class*="title"], [placeholder*="\u6807\u9898"], [data-placeholder*="\u6807\u9898"]'),
        bodyText: document.body.innerText.slice(0, 200)
      }
    })
    console.log(`[XHS] Editor state: ${JSON.stringify(editorInfo)}`)
  }

  /**
   * 填写标题（最多20字）
   */
  protected async inputTitle(title: string): Promise<void> {
    const truncatedTitle = title.slice(0, 20)
    console.log(`[XHS] Inputting title: "${truncatedTitle}"`)

    // 先再次确认编辑器已加载
    await this.ensureEditorLoaded()

    const titleEl = await this.findTitleElement()
    if (!titleEl) {
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
   * 确保编辑器已加载，如未加载则等待
   */
  private async ensureEditorLoaded(): Promise<void> {
    const loaded = await this.page.evaluate(() => {
      const editables = document.querySelectorAll('[contenteditable="true"]')
      const inputs = document.querySelectorAll('input:not([type="file"]), textarea')
      return editables.length > 0 || inputs.length > 0
    })

    if (!loaded) {
      console.log('[XHS] Editor not ready, waiting additional 5s...')
      try {
        await this.page.waitForFunction(() => {
          return document.querySelectorAll('[contenteditable="true"]').length > 0 ||
                 document.querySelectorAll('input:not([type="file"])').length > 0
        }, { timeout: 5000, polling: 500 })
      } catch {
        console.warn('[XHS] Editor still not ready after extra wait')
      }
    }
  }

  /**
   * 查找标题输入元素（5级递进策略）
   */
  private async findTitleElement(): Promise<ElementHandle | null> {
    // 方案1: input/textarea placeholder包含"标题"
    for (const sel of [
      'input[placeholder*="\u6807\u9898"]',   // 标题
      'textarea[placeholder*="\u6807\u9898"]',
      'input[placeholder*="\u586b\u5199\u6807\u9898"]', // 填写标题
    ]) {
      const el = await this.page.$(sel)
      if (el) {
        console.log(`[XHS] Title found via selector: ${sel}`)
        return el
      }
    }

    // 方案2: contenteditable 的 placeholder/data-placeholder 包含"标题"
    const editableTitle = await this.page.evaluateHandle(() => {
      const editables = document.querySelectorAll('[contenteditable="true"]')
      for (const el of editables) {
        const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
        if (ph.includes('\u6807\u9898')) return el  // 标题
      }
      // placeholder 子元素文字匹配
      for (const el of editables) {
        const phChild = el.querySelector('[class*="placeholder"], span[class*="place"]')
        if (phChild && phChild.textContent && phChild.textContent.includes('\u6807\u9898')) return el
      }
      return null
    })
    if (editableTitle && editableTitle.asElement()) {
      console.log('[XHS] Title found via contenteditable placeholder')
      return editableTitle.asElement()
    }

    // 方案3: 靠近 "/20" 字数统计的输入元素
    const nearCount = await this.page.evaluateHandle(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent && /\/20\b/.test(node.textContent)) {
          // 从该元素向上查找最近的可编辑元素
          let parent = node.parentElement
          for (let i = 0; i < 15 && parent; i++) {
            const editable = parent.querySelector('[contenteditable="true"]')
            if (editable) return editable
            const input = parent.querySelector('input:not([type="file"]), textarea')
            if (input) return input
            parent = parent.parentElement
          }
        }
      }
      return null
    })
    if (nearCount && nearCount.asElement()) {
      console.log('[XHS] Title found via proximity to /20 counter')
      return nearCount.asElement()
    }

    // 方案4: 第一个 contenteditable（高度较小的）
    const allEditables = await this.page.$$('[contenteditable="true"]')
    console.log(`[XHS] Total contenteditable elements: ${allEditables.length}`)
    if (allEditables.length > 0) {
      // 取高度最小的 contenteditable（标题框通常比正文小）
      let minHeight = Infinity
      let titleCandidate: ElementHandle | null = null
      for (const el of allEditables) {
        const box = await el.boundingBox()
        if (box && box.height < minHeight && box.height > 10) {
          minHeight = box.height
          titleCandidate = el
        }
      }
      if (titleCandidate) {
        console.log(`[XHS] Title found via smallest contenteditable (h=${minHeight}px)`)
        return titleCandidate
      }
    }

    // 方案5: class包含title的元素
    for (const sel of [
      '[class*="title"] input',
      '[class*="title"] [contenteditable="true"]',
      '[class*="title"][contenteditable="true"]',
      '[class*="post-title"]',
    ]) {
      const el = await this.page.$(sel)
      if (el) {
        console.log(`[XHS] Title found via class selector: ${sel}`)
        return el
      }
    }

    return null
  }

  /**
   * 填写正文
   */
  protected async inputContent(content: string): Promise<void> {
    console.log(`[XHS] Inputting content (${content.length} chars)`)

    const contentEl = await this.findContentElement()
    if (!contentEl) {
      await this.debugPageStructure('content')
      throw new Error('未找到正文输入元素')
    }

    await contentEl.click()
    await this.behavior.randomDelay(300, 600)
    await this.behavior.humanTypeInPlace(this.page, content)
    await this.behavior.randomDelay(500, 1000)

    console.log('[XHS] Content input done')
  }

  /**
   * 查找正文输入元素
   */
  private async findContentElement(): Promise<ElementHandle | null> {
    // 方案1: placeholder 包含"正文"或"描述"
    const byPlaceholder = await this.page.evaluateHandle(() => {
      const editables = document.querySelectorAll('[contenteditable="true"]')
      for (const el of editables) {
        const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
        if (ph.includes('\u6b63\u6587') || ph.includes('\u63cf\u8ff0') || ph.includes('\u8f93\u5165\u6b63\u6587')) return el
        // 正文 / 描述 / 输入正文
      }
      for (const el of editables) {
        const phChild = el.querySelector('[class*="placeholder"], span[class*="place"]')
        if (phChild) {
          const t = phChild.textContent || ''
          if (t.includes('\u6b63\u6587') || t.includes('\u63cf\u8ff0')) return el
        }
      }
      return null
    })
    if (byPlaceholder && byPlaceholder.asElement()) {
      console.log('[XHS] Content found via placeholder')
      return byPlaceholder.asElement()
    }

    // 方案2: 靠近 "/1000" 的可编辑元素
    const nearCount = await this.page.evaluateHandle(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent && /\/1000/.test(node.textContent)) {
          let parent = node.parentElement
          for (let i = 0; i < 15 && parent; i++) {
            const editable = parent.querySelector('[contenteditable="true"]')
            if (editable) return editable
            parent = parent.parentElement
          }
        }
      }
      return null
    })
    if (nearCount && nearCount.asElement()) {
      console.log('[XHS] Content found via /1000 counter')
      return nearCount.asElement()
    }

    // 方案3: 编辑器类选择器
    for (const sel of ['.ql-editor', '#post-content', '[class*="editor"][contenteditable]']) {
      const el = await this.page.$(sel)
      if (el) {
        console.log(`[XHS] Content found via: ${sel}`)
        return el
      }
    }

    // 方案4: contenteditable 中高度最大的
    const editables = await this.page.$$('[contenteditable="true"]')
    console.log(`[XHS] Total editables for content search: ${editables.length}`)
    if (editables.length >= 2) {
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
        console.log(`[XHS] Content found via largest contenteditable (h=${maxHeight}px)`)
        return bestEl
      }
    }
    // 只有1个时也试试（可能标题和正文是同一种容器的不同区域）
    if (editables.length === 1) {
      console.log('[XHS] Only 1 contenteditable, using it for content')
      return editables[0]
    }

    return null
  }

  /**
   * 添加话题标签
   */
  protected async addTags(tags: string[]): Promise<void> {
    const limitedTags = tags.slice(0, 5)
    if (limitedTags.length === 0) return

    console.log(`[XHS] Adding ${limitedTags.length} tags`)

    for (const tag of limitedTags) {
      try {
        // 找"# 话题"按钮并点击
        const topicBtn = await this.findTopicButton()
        if (topicBtn) {
          await topicBtn.click()
          await this.behavior.randomDelay(500, 800)

          // 等待输入框出现并输入
          const topicInput = await this.page.evaluateHandle(() => {
            const active = document.activeElement
            if (active && (active.tagName === 'INPUT' || active.getAttribute('contenteditable'))) return active
            const inputs = document.querySelectorAll('input[placeholder*="\u641c\u7d22"], input[placeholder*="\u8bdd\u9898"], input[type="search"]')
            if (inputs.length > 0) return inputs[inputs.length - 1]
            return null
          })

          if (topicInput && topicInput.asElement()) {
            await topicInput.asElement()!.click()
            await this.behavior.randomDelay(200, 400)
            await this.behavior.humanTypeInPlace(this.page, tag)
          } else {
            await this.behavior.humanTypeInPlace(this.page, tag)
          }
        } else {
          // 在正文末尾追加 #tag
          console.log(`[XHS] Topic button not found, appending #${tag}`)
          await this.page.keyboard.press('End')
          await this.page.keyboard.insertText(` #${tag}`)
          await this.behavior.randomDelay(300, 500)
          continue
        }

        await this.behavior.randomDelay(800, 1500)

        // 等待建议列表并点击
        const clicked = await this.clickFirstSuggestion()
        if (!clicked) {
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

  private async findTopicButton(): Promise<ElementHandle | null> {
    const btn = await this.page.evaluateHandle(() => {
      // 遍历所有可点击元素找"话题"文字
      const candidates = document.querySelectorAll('button, [role="button"], span, div')
      for (const el of candidates) {
        const text = (el.textContent || '').trim()
        if ((text === '#' || text === '# \u8bdd\u9898' || text === '#\u8bdd\u9898' || text.includes('\u8bdd\u9898'))
            && el.getBoundingClientRect().width < 200) {
          return el
        }
      }
      return null
    })
    if (btn && btn.asElement()) {
      console.log('[XHS] Topic button found')
      return btn.asElement()
    }
    return null
  }

  private async clickFirstSuggestion(): Promise<boolean> {
    for (let i = 0; i < 6; i++) {
      await this.behavior.randomDelay(400, 600)
      const suggestion = await this.page.evaluateHandle(() => {
        const selectors = [
          '[class*="suggestion"] li', '[class*="topic-item"]',
          '[class*="search-result"] [class*="item"]', '[class*="dropdown"] [class*="option"]',
          '[class*="hashtag-list"] [class*="item"]', '[class*="topic-list"] > div',
          '[class*="result-list"] > div',
        ]
        for (const sel of selectors) {
          const items = document.querySelectorAll(sel)
          if (items.length > 0) return items[0]
        }
        return null
      })
      if (suggestion && suggestion.asElement()) {
        await suggestion.asElement()!.click()
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

    const buttons = await this.page.$$('button')
    console.log(`[XHS] Found ${buttons.length} buttons`)

    for (const btn of buttons) {
      const info = await btn.evaluate((el) => ({
        text: el.textContent?.trim() || '',
        disabled: (el as HTMLButtonElement).disabled,
        visible: el.offsetParent !== null
      }))
      console.log(`[XHS] Button: "${info.text}" disabled=${info.disabled} visible=${info.visible}`)

      if ((info.text === '\u53d1\u5e03' || (info.text.includes('\u53d1\u5e03') && !info.text.includes('\u6682\u5b58') && !info.text.includes('\u5b9a\u65f6')))
          && !info.disabled && info.visible) {
        // 发布 / 暂存 / 定时
        const box = await btn.boundingBox()
        if (box) {
          await this.takeScreenshot('before_publish')
          await this.behavior.humanClickAt(this.page, box.x + box.width / 2, box.y + box.height / 2)
          console.log('[XHS] Publish button clicked')
          return await this.waitForPublishResult()
        }
      }
    }

    // 备选
    for (const sel of ['button[class*="publish"]', 'button[class*="submit"]']) {
      const el = await this.page.$(sel)
      if (el) {
        await this.takeScreenshot('before_publish')
        await this.behavior.humanClick(this.page, sel)
        console.log(`[XHS] Publish clicked via: ${sel}`)
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

      const result = await this.page.evaluate(() => {
        const body = document.body.innerText || ''
        if (body.includes('\u53d1\u5e03\u6210\u529f') || body.includes('\u5df2\u53d1\u5e03')) return 'success'
        const toasts = document.querySelectorAll('[class*="toast"], [class*="message"], [class*="notification"]')
        for (const t of toasts) {
          const text = t.textContent || ''
          if (text.includes('\u5931\u8d25') || text.includes('\u9519\u8bef')) return `error:${text.trim()}`
        }
        return null
      })

      if (result === 'success') {
        console.log('[XHS] Publish success detected')
        return this.page.url()
      }
      if (result && result.startsWith('error:')) {
        throw new Error(result.slice(6))
      }
    }

    const finalUrl = this.page.url()
    if (finalUrl !== startUrl) return finalUrl

    console.warn('[XHS] No publish result after 15s')
    return null
  }

  protected async cooldown(): Promise<void> {
    await this.behavior.cooldown(this.page)
  }

  /**
   * 调试：打印页面中所有交互元素信息
   */
  private async debugPageStructure(context: string): Promise<void> {
    console.log(`[XHS DEBUG] === ${context} ===`)

    const info = await this.page.evaluate(() => {
      const lines: string[] = []

      const inputs = document.querySelectorAll('input, textarea')
      lines.push(`--- Inputs (${inputs.length}) ---`)
      inputs.forEach((el, i) => {
        lines.push(`  [${i}] <${el.tagName.toLowerCase()}> type="${el.getAttribute('type')}" placeholder="${el.getAttribute('placeholder')}" class="${(el.className || '').toString().slice(0, 80)}"`)
      })

      const editables = document.querySelectorAll('[contenteditable="true"]')
      lines.push(`--- Contenteditable (${editables.length}) ---`)
      editables.forEach((el, i) => {
        const rect = el.getBoundingClientRect()
        lines.push(`  [${i}] <${el.tagName.toLowerCase()}> ph="${el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''}" class="${(el.className || '').toString().slice(0, 80)}" size=${Math.round(rect.width)}x${Math.round(rect.height)} text="${(el.textContent || '').slice(0, 30)}"`)
      })

      const allPh = document.querySelectorAll('[placeholder], [data-placeholder]')
      lines.push(`--- Elements with placeholder attr (${allPh.length}) ---`)
      allPh.forEach((el, i) => {
        const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
        if (ph) lines.push(`  [${i}] <${el.tagName.toLowerCase()}> "${ph}" editable=${el.getAttribute('contenteditable')} class="${(el.className || '').toString().slice(0, 60)}"`)
      })

      // 查找 /20 和 /1000
      lines.push('--- Text /20 /1000 ---')
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent && (/\/20\b/.test(node.textContent) || /\/1000/.test(node.textContent))) {
          const p = node.parentElement
          lines.push(`  "${(node.textContent || '').trim()}" parent=<${p?.tagName.toLowerCase()}> class="${(p?.className || '').toString().slice(0, 60)}"`)
        }
      }

      // 页面URL和标题
      lines.push(`--- Page: ${location.href} ---`)
      lines.push(`--- Body text (first 300 chars): ${document.body.innerText.slice(0, 300)} ---`)

      return lines.join('\n')
    })

    console.log(info)
    console.log(`[XHS DEBUG] === end ${context} ===`)
  }
}
