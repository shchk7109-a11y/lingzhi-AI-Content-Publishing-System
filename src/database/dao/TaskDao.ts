import Database from 'better-sqlite3'
import { getDatabase } from '../db'
import type { TaskInsertData } from './task-action-types'

export class TaskDao {
  private get db(): Database.Database {
    return getDatabase()
  }

  insert(data: TaskInsertData): number {
    const result = this.db.prepare(`
      INSERT INTO tasks (
        match_record_id, account_id, content_id, platform, priority, scheduled_at,
        batch_id, draft_id, action_type, target_note_url, comment_text,
        require_manual_confirm, risk_level, audit_payload
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.match_record_id || null,
      data.account_id,
      data.content_id ?? null,
      data.platform,
      data.priority || 0,
      data.scheduled_at || null,
      data.batch_id || '',
      data.draft_id || '',
      data.action_type || 'publish',
      data.target_note_url || '',
      data.comment_text || '',
      data.require_manual_confirm === false ? 0 : 1,
      data.risk_level || 'low',
      JSON.stringify(data.audit_payload || {})
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

  getByImportKey(input: {
    batch_id: string
    draft_id: string
    action_type: string
    account_id: number
  }): Record<string, unknown> | undefined {
    return this.db.prepare(`
      SELECT *
      FROM tasks
      WHERE batch_id = ?
        AND draft_id = ?
        AND action_type = ?
        AND account_id = ?
      LIMIT 1
    `).get(
      input.batch_id,
      input.draft_id,
      input.action_type,
      input.account_id
    ) as Record<string, unknown> | undefined
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
