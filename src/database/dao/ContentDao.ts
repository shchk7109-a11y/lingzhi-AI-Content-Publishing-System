import Database from 'better-sqlite3'
import { getDatabase } from '../db'

export class ContentDao {
  private get db(): Database.Database {
    return getDatabase()
  }

  insert(data: {
    draft_id: string
    title: string
    content: string
    tags?: string[]
    image_paths?: string[]
    video_path?: string
    platform?: string
    media_type?: string
    gender?: string
    age_group?: string
    health_focus?: string
    product_line?: string
  }): number {
    const result = this.db.prepare(`
      INSERT INTO content_pool (draft_id, title, content, tags, image_paths, video_path, platform, media_type, gender, age_group, health_focus, product_line)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.draft_id,
      data.title,
      data.content,
      JSON.stringify(data.tags || []),
      JSON.stringify(data.image_paths || []),
      data.video_path || '',
      data.platform || 'all',
      data.media_type || 'image',
      data.gender || 'all',
      data.age_group || 'all',
      data.health_focus || 'general',
      data.product_line || 'all'
    )
    return result.lastInsertRowid as number
  }

  getById(id: number): Record<string, unknown> | undefined {
    return this.db.prepare('SELECT * FROM content_pool WHERE id = ?').get(id) as Record<string, unknown> | undefined
  }

  getByDraftId(draftId: string): Record<string, unknown> | undefined {
    return this.db.prepare('SELECT * FROM content_pool WHERE draft_id = ?').get(draftId) as Record<string, unknown> | undefined
  }

  getAll(filters?: { status?: string; platform?: string; gender?: string; age_group?: string; health_focus?: string; search?: string }): Record<string, unknown>[] {
    let sql = 'SELECT * FROM content_pool WHERE 1=1'
    const params: unknown[] = []

    if (filters?.status) {
      sql += ' AND status = ?'
      params.push(filters.status)
    }
    if (filters?.platform && filters.platform !== 'all') {
      sql += ' AND (platform = ? OR platform = ?)'
      params.push(filters.platform, 'all')
    }
    if (filters?.gender && filters.gender !== 'all') {
      sql += ' AND (gender = ? OR gender = ?)'
      params.push(filters.gender, 'all')
    }
    if (filters?.age_group && filters.age_group !== 'all') {
      sql += ' AND (age_group = ? OR age_group = ?)'
      params.push(filters.age_group, 'all')
    }
    if (filters?.health_focus && filters.health_focus !== 'general') {
      sql += ' AND (health_focus = ? OR health_focus = ?)'
      params.push(filters.health_focus, 'general')
    }
    if (filters?.search) {
      sql += ' AND (title LIKE ? OR content LIKE ?)'
      const term = `%${filters.search}%`
      params.push(term, term)
    }

    sql += ' ORDER BY created_at DESC'
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[]
  }

  updateStatus(id: number, status: string): void {
    this.db.prepare("UPDATE content_pool SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id)
  }

  updateTags(id: number, tags: string[]): void {
    this.db.prepare("UPDATE content_pool SET tags = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(tags), id)
  }

  batchInsert(items: Array<{
    draft_id: string; title: string; content: string
    tags?: string[]; image_paths?: string[]; video_path?: string
    platform?: string; media_type?: string; gender?: string
    age_group?: string; health_focus?: string; product_line?: string
  }>): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO content_pool (draft_id, title, content, tags, image_paths, video_path, platform, media_type, gender, age_group, health_focus, product_line)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    const transaction = this.db.transaction(() => {
      for (const item of items) {
        const result = stmt.run(
          item.draft_id, item.title, item.content,
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
    })
    transaction()
    return count
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM content_pool WHERE id = ?').run(id)
  }

  incrementAssignCount(id: number): void {
    this.db.prepare("UPDATE content_pool SET assign_count = assign_count + 1, updated_at = datetime('now') WHERE id = ?").run(id)
  }
}
