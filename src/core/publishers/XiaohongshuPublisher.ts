import type { ContentItem } from '../../shared/types'
import { BasePublisher } from './BasePublisher'

/**
 * 小红书发布器
 * 支持图文和视频发布
 */
export class XiaohongshuPublisher extends BasePublisher {
  protected async navigateToPublish(): Promise<void> {
    // TODO: implement
    // 1. 导航到小红书创作者中心
    // 2. 等待页面加载完成
    // 3. 点击"发布笔记"按钮
    await this.page.goto('https://creator.xiaohongshu.com/publish/publish', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
  }

  protected async uploadMedia(content: ContentItem): Promise<void> {
    // TODO: implement
    // 1. 判断media_type（图文/视频）
    // 2. 图文模式：依次上传image_paths中的图片
    // 3. 视频模式：上传video_path中的视频
    // 4. 等待上传完成和缩略图生成
    void content
  }

  protected async inputTitle(title: string): Promise<void> {
    // TODO: implement
    // 1. 定位标题输入框
    // 2. 使用拟人打字输入标题
    await this.humanEngine.humanType('#title-input', title)
  }

  protected async inputContent(content: string): Promise<void> {
    // TODO: implement
    // 1. 定位正文编辑区域
    // 2. 使用拟人打字输入正文
    await this.humanEngine.humanType('.ql-editor', content)
  }

  protected async addTags(tags: string[]): Promise<void> {
    // TODO: implement
    // 1. 点击添加标签区域
    // 2. 逐个输入标签
    // 3. 每个标签输入后回车确认
    for (const tag of tags) {
      // 输入#号触发标签搜索
      await this.humanEngine.humanType('.tag-input', `#${tag}`)
      await this.humanEngine.randomDelay(500, 1000)
      // 选择第一个匹配结果
      await this.humanEngine.humanClick('.tag-suggestion-item:first-child')
      await this.humanEngine.randomDelay(300, 600)
    }
  }

  protected async clickPublish(): Promise<string> {
    // TODO: implement
    // 1. 点击发布按钮
    // 2. 等待发布成功提示
    // 3. 获取发布后的笔记URL
    await this.humanEngine.humanClick('.publish-btn')
    await this.page.waitForNavigation({ timeout: 30000 })
    return this.page.url()
  }
}
