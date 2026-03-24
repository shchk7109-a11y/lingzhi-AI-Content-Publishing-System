import { getDatabase } from '../database/db'
import type { ContentItem } from '../shared/types'

/**
 * 内容组织器
 * 负责Excel解析、图片/视频文件匹配、内容池入库
 */
export class ContentOrganizer {
  /**
   * 从Excel文件解析内容列表
   * @param filePath Excel文件路径
   * @returns 解析后的内容列表
   */
  parseExcel(filePath: string): Partial<ContentItem>[] {
    // TODO: implement - 使用xlsx库解析Excel文件
    // 1. 读取Excel文件
    // 2. 遍历行数据，映射到ContentItem字段
    // 3. 自动生成draft_id
    // 4. 解析标签列（逗号分隔 → 数组）
    void filePath
    return []
  }

  /**
   * 匹配媒体文件（图片/视频）到内容
   * @param contentItems 内容列表
   * @param mediaDir 媒体文件目录
   * @returns 带媒体路径的内容列表
   */
  matchMediaFiles(contentItems: Partial<ContentItem>[], mediaDir: string): Partial<ContentItem>[] {
    // TODO: implement - 根据draft_id匹配同名目录下的图片/视频文件
    // 1. 扫描mediaDir下的子目录
    // 2. 按draft_id匹配对应目录
    // 3. 提取图片文件列表（jpg/png/webp）
    // 4. 提取视频文件（mp4/mov）
    // 5. 填充image_paths和video_path
    void mediaDir
    return contentItems
  }

  /**
   * 批量导入内容到数据库
   * @param items 内容列表
   * @returns 导入成功数量
   */
  batchImport(items: Partial<ContentItem>[]): number {
    const db = getDatabase()
    const insert = db.prepare(`
      INSERT OR IGNORE INTO content_pool
        (draft_id, title, content, tags, image_paths, video_path, platform, media_type, gender, age_group, health_focus, product_line)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = db.transaction((rows: Partial<ContentItem>[]) => {
      let count = 0
      for (const item of rows) {
        const result = insert.run(
          item.draft_id,
          item.title,
          item.content,
          JSON.stringify(item.tags || []),
          JSON.stringify(item.image_paths || []),
          item.video_path || '',
          item.platform || 'all',
          item.media_type || 'image',
          item.gender || 'all',
          item.age_group || 'all',
          item.health_focus || 'general',
          item.product_line || 'all'
        )
        if (result.changes > 0) count++
      }
      return count
    })

    return transaction(items)
  }

  /**
   * 完整导入流程：解析Excel → 匹配媒体 → 入库
   */
  fullImport(excelPath: string, mediaDir: string): { total: number; imported: number } {
    const parsed = this.parseExcel(excelPath)
    const withMedia = this.matchMediaFiles(parsed, mediaDir)
    const imported = this.batchImport(withMedia)
    return { total: parsed.length, imported }
  }
}
