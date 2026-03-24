import Database from 'better-sqlite3'
import { getDatabase } from '../db'

export class TaskDao {
  private get db(): Database.Database {
    return getDatabase()
  }

  insert(data: {
    match_record_id?: number
    account_id: number
    content_id: number
    platform: string
    priority?: number
    scheduled_at?: string
  }): number {
    const result = this.db.prepare(`
      INSERT INTO tasks (match_record_id, account_id, content_id, platform, priority, scheduled_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.match_record_id || null,
      data.account_id,
      data.content_id,
      data.platform,
      data.priority || 0,
      data.scheduled_at || null
    )
    return result.lastInsertRowid as number
  }

  getById(id: number): Record<string, unknown> | undefined {
    return this.db.prepare(`
      SELECT t.*, cp.title as content_title, a.nickname as account_nickname
      FROM tasks t
      LEFT JOIN content_pool cp ON t.content_id = cp.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ?
    `).get(id) as Record<string, unknown> | undefined
  }

  getAll(filters?: { status?: string; platform?: string; account_id?: number }): Record<string, unknown>[] {
    let sql = `
      SELECT t.*, cp.title as content_title, a.nickname as account_nickname
      FROM tasks t
      LEFT JOIN content_pool cp ON t.content_id = cp.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `
    const params: unknown[] = []

    if (filters?.status) {
      sql += ' AND t.status = ?'
      params.push(filters.status)
    }
    if (filters?.platform) {
      sql += ' AND t.platform = ?'
      params.push(filters.platform)
    }
    if (filters?.account_id) {
      sql += ' AND t.account_id = ?'
      params.push(filters.account_id)
    }

    sql += ' ORDER BY t.priority DESC, t.id DESC'
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[]
  }

  updateStatus(id: number, status: string, extra?: {
    started_at?: string
    finished_at?: string
    error_log?: string
    result_url?: string
    screenshot_path?: string
  }): void {
    let sql = "UPDATE tasks SET status = ?"
    const params: unknown[] = [status]

    if (extra?.started_at) { sql += ', started_at = ?'; params.push(extra.started_at) }
    if (extra?.finished_at) { sql += ', finished_at = ?'; params.push(extra.finished_at) }
    if (extra?.error_log !== undefined) { sql += ', error_log = ?'; params.push(extra.error_log) }
    if (extra?.result_url) { sql += ', result_url = ?'; params.push(extra.result_url) }
    if (extra?.screenshot_path) { sql += ', screenshot_path = ?'; params.push(extra.screenshot_path) }

    sql += ' WHERE id = ?'
    params.push(id)
    this.db.prepare(sql).run(...params)
  }

  getRunningTasks(): Record<string, unknown>[] {
    return this.db.prepare(`
      SELECT t.*, cp.title as content_title, a.nickname as account_nickname
      FROM tasks t
      LEFT JOIN content_pool cp ON t.content_id = cp.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.status = 'running'
      ORDER BY t.started_at ASC
    `).all() as Record<string, unknown>[]
  }

  getQueuedTasks(limit: number = 10): Record<string, unknown>[] {
    return this.db.prepare(`
      SELECT t.*, cp.title as content_title, a.nickname as account_nickname
      FROM tasks t
      LEFT JOIN content_pool cp ON t.content_id = cp.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.status IN ('pending', 'queued')
      AND (t.scheduled_at IS NULL OR t.scheduled_at <= datetime('now'))
      ORDER BY t.priority DESC, t.id ASC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[]
  }

  updateLastStep(id: number, step: string): void {
    this.db.prepare('UPDATE tasks SET last_step = ? WHERE id = ?').run(step, id)
  }

  incrementRetry(id: number): void {
    this.db.prepare("UPDATE tasks SET retry_count = retry_count + 1, status = 'queued' WHERE id = ?").run(id)
  }

  resetRunningToFailed(errorLog: string): number {
    const result = this.db.prepare(`
      UPDATE tasks SET status = 'failed', error_log = ?, finished_at = datetime('now')
      WHERE status = 'running'
    `).run(errorLog)
    return result.changes
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }
}
