import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import { addColumnIfMissing, columnExists, runMigrations } from './db'

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
  function createLegacyDatabase(): Database.Database {
    const database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    database.exec(`
      CREATE TABLE content_pool (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL
      );

      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,
        platform TEXT NOT NULL,
        bit_profile_id TEXT UNIQUE,
        customer_id TEXT,
        persona TEXT DEFAULT '{}',
        account_level TEXT DEFAULT 'new',
        proxy_type TEXT DEFAULT 'pool',
        proxy_config TEXT DEFAULT '{}',
        region TEXT DEFAULT '',
        daily_limit INTEGER DEFAULT 2,
        weekly_target INTEGER DEFAULT 10,
        publish_count_week INTEGER DEFAULT 0,
        last_publish_at DATETIME,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE match_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        FOREIGN KEY (content_id) REFERENCES content_pool(id),
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_record_id INTEGER,
        account_id INTEGER NOT NULL,
        content_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        scheduled_at DATETIME,
        started_at DATETIME,
        finished_at DATETIME,
        result_url TEXT,
        error_log TEXT,
        retry_count INTEGER DEFAULT 0,
        screenshot_path TEXT,
        last_step TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (content_id) REFERENCES content_pool(id)
      );

      INSERT INTO accounts (id, nickname, platform) VALUES (1, 'legacy account', 'xiaohongshu');
      INSERT INTO content_pool (id, title) VALUES (1, 'legacy content');
      INSERT INTO tasks (id, account_id, content_id, platform, status, priority)
      VALUES (1, 1, 1, 'xiaohongshu', 'pending', 5);
    `)

    return database
  }

  function taskContentIdNotNull(database: Database.Database): number | undefined {
    const columns = database.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string; notnull: number }>
    return columns.find((column) => column.name === 'content_id')?.notnull
  }

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

  it('target schema supports inserting tasks with null content_id', () => {
    const database = new Database(':memory:')
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')

    database.pragma('foreign_keys = ON')
    database.exec(schema)
    database.prepare("INSERT INTO accounts (id, nickname, platform) VALUES (1, 'new account', 'xiaohongshu')").run()

    expect(taskContentIdNotNull(database)).toBe(0)
    expect(() => {
      database.prepare("INSERT INTO tasks (account_id, content_id, platform, action_type) VALUES (1, NULL, 'xiaohongshu', 'comment')").run()
    }).not.toThrow()

    database.close()
  })

  it('rebuilds a legacy tasks table so content_id becomes nullable and rows are preserved', () => {
    const database = createLegacyDatabase()

    runMigrations(database)

    expect(taskContentIdNotNull(database)).toBe(0)
    expect(database.prepare('SELECT account_id, content_id, platform, priority, action_type FROM tasks WHERE id = 1').get()).toMatchObject({
      account_id: 1,
      content_id: 1,
      platform: 'xiaohongshu',
      priority: 5,
      action_type: 'publish'
    })
    expect(() => {
      database.prepare(`
        INSERT INTO tasks (account_id, content_id, platform, batch_id, draft_id, action_type)
        VALUES (1, NULL, 'xiaohongshu', 'batch_1', 'comment_1', 'comment')
      `).run()
    }).not.toThrow()

    database.close()
  })

  it('runs real legacy migrations idempotently after rebuilding tasks', () => {
    const database = createLegacyDatabase()

    expect(() => {
      runMigrations(database)
      runMigrations(database)
    }).not.toThrow()

    expect(taskContentIdNotNull(database)).toBe(0)
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_tasks_batch_action'").get()).toBeTruthy()
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'task_audit_logs'").get()).toBeTruthy()

    database.close()
  })

  it('rejects unsafe SQL identifiers in migration helpers', () => {
    const database = new Database(':memory:')
    database.exec('CREATE TABLE tasks (id INTEGER PRIMARY KEY)')

    expect(() => columnExists(database, 'tasks; DROP TABLE tasks', 'id')).toThrow('Invalid SQL identifier')
    expect(() => addColumnIfMissing(database, 'tasks', 'unsafe-name', 'TEXT')).toThrow('Invalid SQL identifier')
    expect(columnExists(database, 'tasks', 'id')).toBe(true)

    database.close()
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
