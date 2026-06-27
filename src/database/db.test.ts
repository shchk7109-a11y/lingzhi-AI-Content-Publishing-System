import fs from 'fs'
import path from 'path'
import type Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import { runMigrations } from './db'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp'
  }
}))

interface FakeColumn {
  name: string
}

class FakeMigrationDatabase {
  readonly columns = new Map<string, Set<string>>([
    ['accounts', new Set(['id', 'nickname', 'platform'])],
    ['tasks', new Set(['id', 'account_id', 'content_id', 'platform'])]
  ])

  prepare(sql: string): { all: () => FakeColumn[] } {
    const tableName = sql.match(/^PRAGMA table_info\((\w+)\)$/)?.[1]
    if (!tableName) {
      throw new Error(`Unexpected prepare SQL: ${sql}`)
    }

    return {
      all: () => Array.from(this.columns.get(tableName) ?? []).map((name) => ({ name }))
    }
  }

  exec(sql: string): void {
    const alterStatements = sql
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.startsWith('ALTER TABLE'))

    for (const statement of alterStatements) {
      const match = statement.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+) /)
      if (!match) {
        continue
      }

      const [, tableName, columnName] = match
      const columns = this.columns.get(tableName)
      if (!columns) {
        throw new Error(`Unknown table: ${tableName}`)
      }
      if (columns.has(columnName)) {
        throw new Error(`duplicate column name: ${columnName}`)
      }
      columns.add(columnName)
    }
  }
}

describe('database schema and migrations', () => {
  it('creates the target schema for aliases, task actions, audit logs, and nullable task content', () => {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')

    expect(schema).toContain('account_alias TEXT')
    expect(schema).toContain('daily_interaction_limit INTEGER DEFAULT 20')
    expect(schema).toContain('last_health_check_at DATETIME')
    expect(schema).toContain("batch_id TEXT DEFAULT ''")
    expect(schema).toContain("draft_id TEXT DEFAULT ''")
    expect(schema).toContain("action_type TEXT DEFAULT 'publish'")
    expect(schema).toContain("target_note_url TEXT DEFAULT ''")
    expect(schema).toContain("comment_text TEXT DEFAULT ''")
    expect(schema).toContain('require_manual_confirm INTEGER DEFAULT 1')
    expect(schema).toContain('confirmed_at DATETIME')
    expect(schema).toContain("risk_level TEXT DEFAULT 'low'")
    expect(schema).toContain("audit_payload TEXT DEFAULT '{}'")
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS task_audit_logs')
    expect(schema).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_alias_platform')
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_tasks_batch_action')
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_tasks_confirmation')
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_task_audit_logs_task')
    expect(schema).toMatch(/content_id INTEGER,\s+platform TEXT NOT NULL/s)
  })

  it('runs guarded migrations idempotently on an existing v3 database', () => {
    const database = new FakeMigrationDatabase()

    expect(() => {
      runMigrations(database as unknown as Database.Database)
      runMigrations(database as unknown as Database.Database)
    }).not.toThrow()

    expect(Array.from(database.columns.get('accounts') ?? [])).toEqual(
      expect.arrayContaining(['account_alias', 'daily_interaction_limit', 'last_health_check_at'])
    )
    expect(Array.from(database.columns.get('tasks') ?? [])).toEqual(
      expect.arrayContaining(['batch_id', 'draft_id', 'action_type', 'audit_payload'])
    )
  })
})
