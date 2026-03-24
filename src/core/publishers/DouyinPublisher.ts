import type { ContentItem } from '../../shared/types'
import { BasePublisher } from './BasePublisher'

/**
 * 抖音发布器
 * 支持视频和图文发布
 */
export class DouyinPublisher extends BasePublisher {
  protected async navigateToPublish(): Promise<void> {
    // TODO: implement
    // 1. 导航到抖音创作者中心
    // 2. 等待页面加载完成
    await this.page.goto('https://creator.douyin.com/creator-micro/content/upload', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
  }

  protected async uploadMedia(content: ContentItem): Promise<void> {
    // TODO: implement
    // 1. 判断media_type
    // 2. 视频：上传视频文件，等待处理完成
    // 3. 图文：切换到图文模式，上传图片
    void content
  }

  protected async inputTitle(title: string): Promise<void> {
    // TODO: implement
    // 定位标题输入框并输入
    await this.humanEngine.humanType('.title-input', title)
  }

  protected async inputContent(content: string): Promise<void> {
    // TODO: implement
    // 定位描述输入框并输入
    await this.humanEngine.humanType('.description-input', content)
  }

  protected async addTags(tags: string[]): Promise<void> {
    // TODO: implement
    // 1. 点击话题区域
    // 2. 逐个输入话题标签
    for (const tag of tags) {
      await this.humanEngine.humanType('.topic-input', `#${tag}`)
      await this.humanEngine.randomDelay(500, 1000)
      await this.humanEngine.humanClick('.topic-suggestion:first-child')
      await this.humanEngine.randomDelay(300, 600)
    }
  }

  protected async clickPublish(): Promise<string> {
    // TODO: implement
    // 1. 点击发布按钮
    // 2. 等待发布完成
    // 3. 返回作品URL
    await this.humanEngine.humanClick('.publish-button')
    await this.page.waitForNavigation({ timeout: 30000 })
    return this.page.url()
  }
}
