import Database from 'better-sqlite3'
import { getDatabase } from '../db'

export class PublishLogDao {
  private get db(): Database.Database {
    return getDatabase()
  }

  insert(data: {
    task_id: number
    step: string
    action?: string
    duration_ms?: number
    screenshot_path?: string
    error?: string
  }): number {
    const result = this.db.prepare(`
      INSERT INTO publish_logs (task_id, step, action, duration_ms, screenshot_path, error)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.task_id,
      data.step,
      data.action || null,
      data.duration_ms || 0,
      data.screenshot_path || null,
      data.error || null
    )
    return result.lastInsertRowid as number
  }

  getByTaskId(taskId: number): Record<string, unknown>[] {
    return this.db.prepare('SELECT * FROM publish_logs WHERE task_id = ? ORDER BY timestamp ASC')
      .all(taskId) as Record<string, unknown>[]
  }
}

export class ProxyPoolDao {
  private get db(): Database.Database {
    return getDatabase()
  }

  insert(data: {
    ip: string; port: number; protocol?: string
    city?: string; provider?: string; type?: string
  }): number {
    const result = this.db.prepare(`
      INSERT INTO proxy_pool (ip, port, protocol, city, provider, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.ip, data.port, data.protocol || 'http', data.city || '', data.provider || '', data.type || 'pool')
    return result.lastInsertRowid as number
  }

  getAvailableByCity(city?: string, type?: string): Record<string, unknown>[] {
    let sql = "SELECT * FROM proxy_pool WHERE status = 'active'"
    const params: unknown[] = []

    if (city) {
      sql += ' AND city = ?'
      params.push(city)
    }
    if (type) {
      sql += ' AND type = ?'
      params.push(type)
    }

    sql += ' ORDER BY usage_count ASC, fail_count ASC LIMIT 10'
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[]
  }

  updateStatus(id: number, status: string): void {
    this.db.prepare("UPDATE proxy_pool SET status = ?, last_check_at = datetime('now') WHERE id = ?").run(status, id)
  }

  incrementFailCount(id: number): void {
    this.db.prepare('UPDATE proxy_pool SET fail_count = fail_count + 1 WHERE id = ?').run(id)
  }

  incrementUsageCount(id: number): void {
    this.db.prepare('UPDATE proxy_pool SET usage_count = usage_count + 1 WHERE id = ?').run(id)
  }

  getAll(): Record<string, unknown>[] {
    return this.db.prepare('SELECT * FROM proxy_pool ORDER BY created_at DESC').all() as Record<string, unknown>[]
  }

  getStats(): { total: number; active: number; failed: number; cooldown: number } {
    const db = this.db
    const total = (db.prepare('SELECT COUNT(*) as c FROM proxy_pool').get() as { c: number }).c
    const active = (db.prepare("SELECT COUNT(*) as c FROM proxy_pool WHERE status = 'active'").get() as { c: number }).c
    const failed = (db.prepare("SELECT COUNT(*) as c FROM proxy_pool WHERE status = 'failed'").get() as { c: number }).c
    const cooldown = (db.prepare("SELECT COUNT(*) as c FROM proxy_pool WHERE status = 'cooldown'").get() as { c: number }).c
    return { total, active, failed, cooldown }
  }
}

export class MatchRuleDao {
  private get db(): Database.Database {
    return getDatabase()
  }

  insert(data: {
    rule_name: string; content_field: string; operator: string
    content_value: string; account_field: string; account_value: string
    action?: string
  }): number {
    const result = this.db.prepare(`
      INSERT INTO match_rules (rule_name, content_field, operator, content_value, account_field, account_value, action)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.rule_name, data.content_field, data.operator, data.content_value, data.account_field, data.account_value, data.action || 'exclude')
    return result.lastInsertRowid as number
  }

  getAll(): Record<string, unknown>[] {
    return this.db.prepare('SELECT * FROM match_rules ORDER BY id DESC').all() as Record<string, unknown>[]
  }

  updateEnabled(id: number, enabled: boolean): void {
    this.db.prepare('UPDATE match_rules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM match_rules WHERE id = ?').run(id)
  }
}
