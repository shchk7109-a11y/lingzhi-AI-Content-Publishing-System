import Database from 'better-sqlite3'
import { getDatabase } from '../db'

interface AccountInsertData {
  nickname: string
  platform: string
  bit_profile_id?: string
  account_alias?: string
  customer_id?: string
  persona?: Record<string, string>
  account_level?: string
  proxy_type?: string
  proxy_config?: Record<string, unknown>
  region?: string
  daily_limit?: number
  daily_interaction_limit?: number
  weekly_target?: number
  last_health_check_at?: string
}

export class AccountDao {
  private get db(): Database.Database {
    return getDatabase()
  }

  insert(data: AccountInsertData): number {
    const result = this.db.prepare(`
      INSERT INTO accounts (
        nickname, platform, bit_profile_id, customer_id, persona, account_level,
        proxy_type, proxy_config, region, daily_limit, weekly_target,
        account_alias, daily_interaction_limit, last_health_check_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.nickname,
      data.platform,
      data.bit_profile_id || null,
      data.customer_id || '',
      JSON.stringify(data.persona || {}),
      data.account_level || 'new',
      data.proxy_type || 'pool',
      JSON.stringify(data.proxy_config || {}),
      data.region || '',
      data.daily_limit ?? 2,
      data.weekly_target ?? 10,
      data.account_alias || null,
      data.daily_interaction_limit ?? 20,
      data.last_health_check_at || null
    )
    return result.lastInsertRowid as number
  }

  getById(id: number): Record<string, unknown> | undefined {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  }

  getAll(filters?: { platform?: string; status?: string; customer_id?: string; search?: string }): Record<string, unknown>[] {
    let sql = 'SELECT * FROM accounts WHERE 1=1'
    const params: unknown[] = []

    if (filters?.platform) {
      sql += ' AND platform = ?'
      params.push(filters.platform)
    }
    if (filters?.status) {
      sql += ' AND status = ?'
      params.push(filters.status)
    }
    if (filters?.customer_id) {
      sql += ' AND customer_id = ?'
      params.push(filters.customer_id)
    }
    if (filters?.search) {
      sql += ' AND (nickname LIKE ? OR customer_id LIKE ? OR account_alias LIKE ?)'
      const term = `%${filters.search}%`
      params.push(term, term, term)
    }

    sql += ' ORDER BY created_at DESC'
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[]
  }

  getByAlias(platform: string, accountAlias: string): Record<string, unknown> | undefined {
    return this.db.prepare('SELECT * FROM accounts WHERE platform = ? AND account_alias = ?')
      .get(platform, accountAlias) as Record<string, unknown> | undefined
  }

  updatePersona(id: number, persona: Record<string, string>): void {
    this.db.prepare("UPDATE accounts SET persona = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(persona), id)
  }

  updatePublishCount(id: number): void {
    this.db.prepare(`
      UPDATE accounts SET
        publish_count_week = publish_count_week + 1,
        last_publish_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(id)
  }

  resetWeeklyCount(): void {
    this.db.prepare("UPDATE accounts SET publish_count_week = 0, updated_at = datetime('now')").run()
  }

  updateStatus(id: number, status: string): void {
    this.db.prepare("UPDATE accounts SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id)
  }

  batchInsert(items: AccountInsertData[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (
        nickname, platform, bit_profile_id, customer_id, persona, account_level,
        proxy_type, proxy_config, region, daily_limit, weekly_target,
        account_alias, daily_interaction_limit, last_health_check_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    const transaction = this.db.transaction(() => {
      for (const item of items) {
        const result = stmt.run(
          item.nickname, item.platform,
          item.bit_profile_id || null,
          item.customer_id || '',
          JSON.stringify(item.persona || {}),
          item.account_level || 'new',
          item.proxy_type || 'pool',
          JSON.stringify(item.proxy_config || {}),
          item.region || '',
          item.daily_limit ?? 2,
          item.weekly_target ?? 10,
          item.account_alias || null,
          item.daily_interaction_limit ?? 20,
          item.last_health_check_at || null
        )
        if (result.changes > 0) count++
      }
    })
    transaction()
    return count
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
  }
}
