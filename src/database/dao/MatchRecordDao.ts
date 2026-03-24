import Database from 'better-sqlite3'
import { getDatabase } from '../db'

export class MatchRecordDao {
  private get db(): Database.Database {
    return getDatabase()
  }

  insert(data: {
    content_id: number
    account_id: number
    match_score: number
    freshness_bonus?: number
    final_priority?: number
  }): number {
    const finalPriority = data.final_priority ?? (data.match_score + (data.freshness_bonus || 0))
    const result = this.db.prepare(`
      INSERT INTO match_records (content_id, account_id, match_score, freshness_bonus, final_priority)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.content_id, data.account_id, data.match_score, data.freshness_bonus || 0, finalPriority)
    return result.lastInsertRowid as number
  }

  getByContentId(contentId: number): Record<string, unknown>[] {
    return this.db.prepare(`
      SELECT mr.*, cp.title as content_title, a.nickname as account_nickname
      FROM match_records mr
      LEFT JOIN content_pool cp ON mr.content_id = cp.id
      LEFT JOIN accounts a ON mr.account_id = a.id
      WHERE mr.content_id = ?
      ORDER BY mr.final_priority DESC
    `).all(contentId) as Record<string, unknown>[]
  }

  getByAccountId(accountId: number): Record<string, unknown>[] {
    return this.db.prepare(`
      SELECT mr.*, cp.title as content_title, a.nickname as account_nickname
      FROM match_records mr
      LEFT JOIN content_pool cp ON mr.content_id = cp.id
      LEFT JOIN accounts a ON mr.account_id = a.id
      WHERE mr.account_id = ?
      ORDER BY mr.matched_at DESC
    `).all(accountId) as Record<string, unknown>[]
  }

  getAll(filters?: { status?: string }): Record<string, unknown>[] {
    let sql = `
      SELECT mr.*, cp.title as content_title, a.nickname as account_nickname
      FROM match_records mr
      LEFT JOIN content_pool cp ON mr.content_id = cp.id
      LEFT JOIN accounts a ON mr.account_id = a.id
      WHERE 1=1
    `
    const params: unknown[] = []

    if (filters?.status) {
      sql += ' AND mr.status = ?'
      params.push(filters.status)
    }

    sql += ' ORDER BY mr.matched_at DESC'
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[]
  }

  batchInsert(records: Array<{
    content_id: number; account_id: number
    match_score: number; freshness_bonus?: number; final_priority?: number
  }>): number {
    const stmt = this.db.prepare(`
      INSERT INTO match_records (content_id, account_id, match_score, freshness_bonus, final_priority)
      VALUES (?, ?, ?, ?, ?)
    `)

    let count = 0
    const transaction = this.db.transaction(() => {
      for (const r of records) {
        const fp = r.final_priority ?? (r.match_score + (r.freshness_bonus || 0))
        stmt.run(r.content_id, r.account_id, r.match_score, r.freshness_bonus || 0, fp)
        count++
      }
    })
    transaction()
    return count
  }

  updateStatus(id: number, status: string): void {
    this.db.prepare('UPDATE match_records SET status = ? WHERE id = ?').run(status, id)
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM match_records WHERE id = ?').run(id)
  }
}
