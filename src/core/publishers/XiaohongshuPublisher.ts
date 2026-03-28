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
    console.log('[XHS] Navigating to publish page (image mode)...')

    // 直接用 target=image 参数打开图文上传页
    await this.page.goto('https://creator.xiaohongshu.com/publish/publish?from=menu&target=image', {
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

    // 备选：如果URL参数没生效，手动点击"上传图文"标签
    const currentUrl = this.page.url()
    console.log(`[XHS] Current URL: ${currentUrl}`)

    const isImageMode = await this.page.evaluate(() => {
      // 检查当前激活的tab是否是图文
      const activeTabs = document.querySelectorAll('[class*="active"], [aria-selected="true"]')
      for (const tab of activeTabs) {
        const text = (tab.textContent || '').trim()
        if (text.includes('\u56fe\u6587')) return true  // 图文
      }
      // 检查页面是否有图片相关的上传区域（不是纯视频上传）
      const inputs = document.querySelectorAll('input[type="file"]')
      for (const inp of inputs) {
        const accept = inp.getAttribute('accept') || ''
        if (accept.includes('image') || accept.includes('jpg') || accept.includes('png')) return true
      }
      // 检查上传区域是否提示"拖拽/点击上传图片"
      const bodyText = document.body.innerText || ''
      if (bodyText.includes('\u56fe\u7247') || bodyText.includes('\u62d6\u62fd\u56fe\u7247')) return true  // 图片 / 拖拽图片
      return false
    })

    if (!isImageMode) {
      console.log('[XHS] Not in image mode, clicking image tab...')
      const clicked = await this.page.evaluate(() => {
        // 查找所有可能的tab元素，点击包含"图文"的那个
        const candidates = document.querySelectorAll('div, span, a, button, li')
        for (const el of candidates) {
          const text = (el.textContent || '').trim()
          const rect = el.getBoundingClientRect()
          // "上传图文" 且是较小的可点击元素（不是整个容器）
          if (text.includes('\u56fe\u6587') && rect.width > 20 && rect.width < 300 && rect.height > 10 && rect.height < 80) {
            (el as HTMLElement).click()
            return text
          }
        }
        return null
      })

      if (clicked) {
        console.log(`[XHS] Clicked image tab: ${clicked}`)
        await this.behavior.randomDelay(1500, 2500)
      } else {
        console.warn('[XHS] Could not find image tab to click')
      }
    } else {
      console.log('[XHS] Already in image mode')
    }

    // 等待图文上传区域出现
    await this.takeScreenshot('after_tab_switch')

    // 打印当前页面所有 file input 信息
    const fileInputs = await this.page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="file"]')
      return Array.from(inputs).map((el, i) => ({
        i,
        accept: el.getAttribute('accept') || '(none)',
        multiple: el.hasAttribute('multiple'),
        cls: el.className
      }))
    })
    console.log(`[XHS] File inputs: ${JSON.stringify(fileInputs)}`)

    console.log('[XHS] Publish page ready')
    console.log('[XHS] Publish page loaded')
  }

  /**
   * 上传图片
   * 核心策略：用 page.waitForFileChooser() 拦截文件对话框
   * 比直接操作 input 元素更可靠
   */
  protected async uploadMedia(paths: string[], isVideo: boolean): Promise<void> {
    if (paths.length === 0) throw new Error('没有媒体文件可上传')

    console.log(`[XHS] Uploading ${paths.length} files...`)
    // 路径可能有中文，逐条打印避免编码问题
    paths.forEach((p, i) => console.log(`[XHS]   File[${i}]: ${p}`))

    // 策略1: 用 waitForFileChooser 拦截文件选择对话框
    const uploaded = await this.uploadViaFileChooser(paths)
    if (uploaded) {
      console.log('[XHS] Upload via FileChooser succeeded')
    } else {
      // 策略2: 直接找图片 input（可能存在但隐藏）
      console.log('[XHS] FileChooser failed, trying direct input...')
      await this.uploadViaInput(paths)
    }

    // 等待编辑器加载
    await this.waitForEditorAfterUpload(isVideo)
  }

  /**
   * 策略1: 点击上传区域 + 拦截 FileChooser
   */
  private async uploadViaFileChooser(paths: string[]): Promise<boolean> {
    try {
      // 找到上传区域（拖拽区/上传按钮/上传提示）
      const uploadArea = await this.page.evaluateHandle(() => {
        // 查找上传区域的常见模式
        const selectors = [
          '[class*="upload-wrapper"]',
          '[class*="upload-area"]',
          '[class*="drag"]',
          '[class*="upload"] [class*="icon"]',
          '[class*="upload"] [class*="text"]',
          '[class*="upload-btn"]',
        ]
        for (const sel of selectors) {
          const el = document.querySelector(sel)
          if (el) return el
        }
        // 查找包含"上传"或"拖拽"文字的元素
        const allDivs = document.querySelectorAll('div, span, button')
        for (const el of allDivs) {
          const text = (el.textContent || '').trim()
          if ((text.includes('\u4e0a\u4f20') || text.includes('\u62d6\u62fd')) && el.getBoundingClientRect().width > 50) {
            return el
          }
        }
        return null
      })

      if (!uploadArea || !uploadArea.asElement()) {
        console.log('[XHS] No upload area found for FileChooser approach')
        return false
      }

      const area = uploadArea.asElement()!
      const box = await area.boundingBox()
      if (!box) {
        console.log('[XHS] Upload area has no bounding box')
        return false
      }

      console.log(`[XHS] Found upload area at ${Math.round(box.x)},${Math.round(box.y)} size ${Math.round(box.width)}x${Math.round(box.height)}`)

      // 同时设置 FileChooser 监听和点击
      const [fileChooser] = await Promise.all([
        this.page.waitForFileChooser({ timeout: 5000 }),
        this.behavior.humanClickAt(this.page, box.x + box.width / 2, box.y + box.height / 2)
      ])

      // 通过 FileChooser 选择文件
      await fileChooser.accept(paths)
      console.log(`[XHS] FileChooser accepted ${paths.length} files`)
      return true
    } catch (err) {
      console.log(`[XHS] FileChooser approach failed: ${(err as Error).message}`)
      return false
    }
  }

  /**
   * 策略2: 直接通过 input 元素上传
   */
  private async uploadViaInput(paths: string[]): Promise<void> {
    const allInputs = await this.page.$$('input[type="file"]')
    console.log(`[XHS] Found ${allInputs.length} file inputs`)

    if (allInputs.length === 0) {
      throw new Error('页面上没有任何 file input 元素')
    }

    // 打印每个 input 信息
    for (let i = 0; i < allInputs.length; i++) {
      const info = await allInputs[i].evaluate(el => ({
        accept: el.getAttribute('accept') || '(none)',
        multiple: el.hasAttribute('multiple'),
        class: el.className
      }))
      console.log(`[XHS] Input[${i}]: accept=${info.accept} multiple=${info.multiple} class=${info.class}`)
    }

    // 选择最合适的 input：优先图片类型，其次通用，最后修改视频类型
    let targetInput = allInputs[0]
    for (const input of allInputs) {
      const accept = await input.evaluate(el => el.getAttribute('accept') || '')
      if (accept.includes('image') || accept.includes('jpg') || accept.includes('png')) {
        targetInput = input
        break
      }
      if (!accept) {
        targetInput = input
        break
      }
    }

    // 强制设置 accept 和 multiple
    await targetInput.evaluate(el => {
      el.setAttribute('accept', 'image/*,.jpg,.jpeg,.png,.webp')
      el.setAttribute('multiple', 'true')
    })

    try {
      await targetInput.uploadFile(...paths)
      console.log(`[XHS] Direct input upload success: ${paths.length} files`)
    } catch (err) {
      // 多文件失败时逐个上传
      console.log(`[XHS] Batch upload failed: ${(err as Error).message}, trying one by one...`)
      for (let i = 0; i < paths.length; i++) {
        const input = await this.page.$('input[type="file"]')
        if (!input) break
        await input.evaluate(el => {
          el.setAttribute('accept', 'image/*,.jpg,.jpeg,.png,.webp')
        })
        await input.uploadFile(paths[i])
        console.log(`[XHS] Single file ${i + 1}/${paths.length} uploaded`)
        if (i < paths.length - 1) await this.behavior.randomDelay(1000, 2000)
      }
    }
  }

  /**
   * 等待编辑器在上传后加载完成
   */
  private async waitForEditorAfterUpload(isVideo: boolean): Promise<void> {
    console.log('[XHS] Waiting for editor to load...')
    const timeoutMs = isVideo ? 120000 : 45000

    try {
      await this.page.waitForFunction(() => {
        // 检测编辑器出现的多种信号
        if (document.querySelectorAll('[contenteditable="true"]').length > 0) return true
        const text = document.body.innerText || ''
        if (text.includes('/20') || text.includes('/1000')) return true
        if (document.querySelector('[class*="title-input"], [class*="post-title"], [class*="editor"]')) return true
        // 非 file input 的 input/textarea 出现
        if (document.querySelectorAll('input:not([type="file"]), textarea').length > 0) return true
        return false
      }, { timeout: timeoutMs, polling: 2000 })

      console.log('[XHS] Editor loaded!')
    } catch {
      console.warn('[XHS] Editor load timeout')
      await this.debugPageStructure('editor-timeout')
      await this.takeScreenshot('editor_timeout')
      throw new Error(`编辑器未加载（${timeoutMs / 1000}s超时）`)
    }

    await this.behavior.randomDelay(2000, 3000)

    const info = await this.page.evaluate(() => ({
      editables: document.querySelectorAll('[contenteditable="true"]').length,
      inputs: document.querySelectorAll('input:not([type="file"]), textarea').length,
      url: location.href
    }))
    console.log(`[XHS] Editor state: ${JSON.stringify(info)}`)
  }

  /**
   * 填写标题（最多20字）
   */
  protected async inputTitle(title: string): Promise<void> {
    const t = title.slice(0, 20)
    console.log(`[XHS] Inputting title: "${t}"`)

    await this.ensureEditorLoaded()

    const el = await this.findTitleElement()
    if (!el) {
      await this.debugPageStructure('title')
      throw new Error('未找到标题输入元素')
    }

    await el.click()
    await this.behavior.randomDelay(300, 500)
    await this.page.keyboard.down('Control')
    await this.page.keyboard.press('a')
    await this.page.keyboard.up('Control')
    await this.page.keyboard.press('Backspace')
    await this.behavior.randomDelay(200, 400)
    await this.behavior.humanTypeInPlace(this.page, t)
    await this.behavior.randomDelay(500, 1000)
    console.log('[XHS] Title done')
  }

  private async ensureEditorLoaded(): Promise<void> {
    const ok = await this.page.evaluate(() =>
      document.querySelectorAll('[contenteditable="true"]').length > 0 ||
      document.querySelectorAll('input:not([type="file"]), textarea').length > 0
    )
    if (!ok) {
      console.log('[XHS] Editor not ready, extra wait...')
      try {
        await this.page.waitForFunction(() =>
          document.querySelectorAll('[contenteditable="true"]').length > 0 ||
          document.querySelectorAll('input:not([type="file"]), textarea').length > 0,
          { timeout: 10000, polling: 1000 })
      } catch { console.warn('[XHS] Editor still not ready') }
    }
  }

  private async findTitleElement(): Promise<ElementHandle | null> {
    // 方案1: input/textarea with 标题 placeholder
    for (const sel of ['input[placeholder*="\u6807\u9898"]', 'textarea[placeholder*="\u6807\u9898"]']) {
      const el = await this.page.$(sel)
      if (el) { console.log(`[XHS] Title via: ${sel}`); return el }
    }

    // 方案2: contenteditable with 标题 placeholder
    const ceTitle = await this.page.evaluateHandle(() => {
      for (const el of document.querySelectorAll('[contenteditable="true"]')) {
        const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
        if (ph.includes('\u6807\u9898')) return el
        const child = el.querySelector('[class*="placeholder"]')
        if (child?.textContent?.includes('\u6807\u9898')) return el
      }
      return null
    })
    if (ceTitle?.asElement()) { console.log('[XHS] Title via contenteditable placeholder'); return ceTitle.asElement() }

    // 方案3: near /20 counter
    const near20 = await this.page.evaluateHandle(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let n: Node | null
      while ((n = walker.nextNode())) {
        if (n.textContent && /\/20\b/.test(n.textContent)) {
          let p = n.parentElement
          for (let i = 0; i < 15 && p; i++) {
            const e = p.querySelector('[contenteditable="true"]') || p.querySelector('input:not([type="file"]), textarea')
            if (e) return e
            p = p.parentElement
          }
        }
      }
      return null
    })
    if (near20?.asElement()) { console.log('[XHS] Title via /20 counter'); return near20.asElement() }

    // 方案4: smallest contenteditable (title is shorter than body)
    const editables = await this.page.$$('[contenteditable="true"]')
    if (editables.length > 0) {
      let minH = Infinity, best: ElementHandle | null = null
      for (const e of editables) {
        const box = await e.boundingBox()
        if (box && box.height < minH && box.height > 10) { minH = box.height; best = e }
      }
      if (best) { console.log(`[XHS] Title via smallest editable (h=${minH})`); return best }
    }

    // 方案5: class title
    for (const s of ['[class*="title"] input', '[class*="title"] [contenteditable="true"]', '[class*="title"][contenteditable="true"]']) {
      const el = await this.page.$(s)
      if (el) { console.log(`[XHS] Title via: ${s}`); return el }
    }
    return null
  }

  protected async inputContent(content: string): Promise<void> {
    console.log(`[XHS] Inputting content (${content.length} chars)`)
    const el = await this.findContentElement()
    if (!el) { await this.debugPageStructure('content'); throw new Error('未找到正文输入元素') }
    await el.click()
    await this.behavior.randomDelay(300, 600)
    await this.behavior.humanTypeInPlace(this.page, content)
    await this.behavior.randomDelay(500, 1000)
    console.log('[XHS] Content done')
  }

  private async findContentElement(): Promise<ElementHandle | null> {
    // 方案1: placeholder 含 正文/描述
    const byPh = await this.page.evaluateHandle(() => {
      for (const el of document.querySelectorAll('[contenteditable="true"]')) {
        const ph = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''
        if (ph.includes('\u6b63\u6587') || ph.includes('\u63cf\u8ff0')) return el
        const child = el.querySelector('[class*="placeholder"]')
        if (child?.textContent?.includes('\u6b63\u6587') || child?.textContent?.includes('\u63cf\u8ff0')) return el
      }
      return null
    })
    if (byPh?.asElement()) { console.log('[XHS] Content via placeholder'); return byPh.asElement() }

    // 方案2: near /1000
    const near1000 = await this.page.evaluateHandle(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let n: Node | null
      while ((n = walker.nextNode())) {
        if (n.textContent && /\/1000/.test(n.textContent)) {
          let p = n.parentElement
          for (let i = 0; i < 15 && p; i++) {
            const e = p.querySelector('[contenteditable="true"]')
            if (e) return e
            p = p.parentElement
          }
        }
      }
      return null
    })
    if (near1000?.asElement()) { console.log('[XHS] Content via /1000'); return near1000.asElement() }

    // 方案3: largest contenteditable
    const editables = await this.page.$$('[contenteditable="true"]')
    if (editables.length >= 2) {
      let maxH = 0, best: ElementHandle | null = null
      for (const e of editables) {
        const box = await e.boundingBox()
        if (box && box.height > maxH) { maxH = box.height; best = e }
      }
      if (best) { console.log(`[XHS] Content via largest editable (h=${maxH})`); return best }
      return editables[1]
    }
    if (editables.length === 1) return editables[0]
    return null
  }

  protected async addTags(tags: string[]): Promise<void> {
    const t = tags.slice(0, 5)
    if (t.length === 0) return
    console.log(`[XHS] Adding ${t.length} tags`)

    for (const tag of t) {
      try {
        const btn = await this.findTopicButton()
        if (btn) {
          await btn.click()
          await this.behavior.randomDelay(500, 800)
          // 在当前聚焦的输入中打字
          await this.behavior.humanTypeInPlace(this.page, tag)
          await this.behavior.randomDelay(800, 1500)
          const clicked = await this.clickFirstSuggestion()
          if (!clicked) await this.page.keyboard.press('Enter')
          console.log(`[XHS] Tag "${tag}" added`)
        } else {
          // 在正文末尾追加
          await this.page.keyboard.press('End')
          await this.page.keyboard.insertText(` #${tag}`)
          console.log(`[XHS] Tag "${tag}" appended to content`)
        }
        await this.behavior.randomDelay(500, 800)
      } catch (e) { console.warn(`[XHS] Tag "${tag}" failed: ${(e as Error).message}`) }
    }
  }

  private async findTopicButton(): Promise<ElementHandle | null> {
    const btn = await this.page.evaluateHandle(() => {
      for (const el of document.querySelectorAll('button, [role="button"], span, div')) {
        const text = (el.textContent || '').trim()
        if ((text === '#' || text === '# \u8bdd\u9898' || text === '#\u8bdd\u9898' || text.includes('\u8bdd\u9898'))
            && el.getBoundingClientRect().width < 200 && el.getBoundingClientRect().width > 10) return el
      }
      return null
    })
    return btn?.asElement() || null
  }

  private async clickFirstSuggestion(): Promise<boolean> {
    for (let i = 0; i < 6; i++) {
      await this.behavior.randomDelay(400, 600)
      const s = await this.page.evaluateHandle(() => {
        for (const sel of ['[class*="suggestion"] li', '[class*="topic-item"]', '[class*="search-result"] [class*="item"]', '[class*="dropdown"] [class*="option"]', '[class*="topic-list"] > div']) {
          const items = document.querySelectorAll(sel)
          if (items.length > 0) return items[0]
        }
        return null
      })
      if (s?.asElement()) { await s.asElement()!.click(); return true }
    }
    return false
  }

  protected async clickPublish(): Promise<string | null> {
    console.log('[XHS] Looking for publish button...')
    const buttons = await this.page.$$('button')
    for (const btn of buttons) {
      const info = await btn.evaluate(el => ({
        text: el.textContent?.trim() || '',
        disabled: (el as HTMLButtonElement).disabled,
        visible: el.offsetParent !== null
      }))
      if ((info.text === '\u53d1\u5e03' || (info.text.includes('\u53d1\u5e03') && !info.text.includes('\u6682\u5b58') && !info.text.includes('\u5b9a\u65f6')))
          && !info.disabled && info.visible) {
        const box = await btn.boundingBox()
        if (box) {
          await this.takeScreenshot('before_publish')
          await this.behavior.humanClickAt(this.page, box.x + box.width / 2, box.y + box.height / 2)
          console.log('[XHS] Publish clicked')
          return await this.waitForPublishResult()
        }
      }
    }
    throw new Error('未找到发布按钮')
  }

  private async waitForPublishResult(): Promise<string | null> {
    const startUrl = this.page.url()
    for (let i = 0; i < 30; i++) {
      await this.behavior.randomDelay(400, 600)
      const url = this.page.url()
      if (url !== startUrl && url.includes('xiaohongshu.com')) return url
      const r = await this.page.evaluate(() => {
        const t = document.body.innerText || ''
        if (t.includes('\u53d1\u5e03\u6210\u529f') || t.includes('\u5df2\u53d1\u5e03')) return 'ok'
        for (const el of document.querySelectorAll('[class*="toast"], [class*="message"]')) {
          const s = el.textContent || ''
          if (s.includes('\u5931\u8d25') || s.includes('\u9519\u8bef')) return `err:${s.trim()}`
        }
        return null
      })
      if (r === 'ok') return this.page.url()
      if (r?.startsWith('err:')) throw new Error(r.slice(4))
    }
    return this.page.url() !== startUrl ? this.page.url() : null
  }

  protected async cooldown(): Promise<void> {
    await this.behavior.cooldown(this.page)
  }

  private async debugPageStructure(ctx: string): Promise<void> {
    console.log(`[XHS DEBUG] === ${ctx} ===`)
    const info = await this.page.evaluate(() => {
      const lines: string[] = []
      const inputs = document.querySelectorAll('input, textarea')
      lines.push(`--- Inputs (${inputs.length}) ---`)
      inputs.forEach((el, i) => lines.push(`  [${i}] <${el.tagName.toLowerCase()}> type="${el.getAttribute('type')}" ph="${el.getAttribute('placeholder')}" class="${(el.className || '').toString().slice(0, 80)}"`))
      const eds = document.querySelectorAll('[contenteditable="true"]')
      lines.push(`--- Contenteditable (${eds.length}) ---`)
      eds.forEach((el, i) => { const r = el.getBoundingClientRect(); lines.push(`  [${i}] ph="${el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || ''}" ${Math.round(r.width)}x${Math.round(r.height)} class="${(el.className || '').toString().slice(0, 80)}"`) })
      lines.push(`--- Page: ${location.href} ---`)
      return lines.join('\n')
    })
    console.log(info)
    console.log(`[XHS DEBUG] === end ${ctx} ===`)
  }
}
