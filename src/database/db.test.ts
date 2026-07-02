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

  prepare(sql: string): { all?: () => FakeColumn[]; get?: (tableName?: string) => unknown } {
    if (sql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?") {
      return {
        get: (tableName?: string) => this.columns.has(String(tableName))
          ? { name: tableName }
          : undefined
      }
    }

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

      CREATE TABLE publish_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        step TEXT NOT NULL,
        action TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration_ms INTEGER DEFAULT 0,
        screenshot_path TEXT,
        error TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE INDEX idx_publish_logs_task ON publish_logs(task_id);

      INSERT INTO accounts (id, nickname, platform) VALUES (1, 'legacy account', 'xiaohongshu');
      INSERT INTO content_pool (id, title) VALUES (1, 'legacy content');
      INSERT INTO tasks (id, account_id, content_id, platform, status, priority)
      VALUES (1, 1, 1, 'xiaohongshu', 'pending', 5);
      INSERT INTO publish_logs (id, task_id, step, action, duration_ms)
      VALUES (1, 1, 'legacy_step', 'legacy_action', 120);
    `)

    return database
  }

  function createLegacyDatabaseWithAuditLogs(): Database.Database {
    const database = createLegacyDatabase()

    database.exec(`
      CREATE TABLE task_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        account_id INTEGER,
        action_type TEXT NOT NULL,
        event_name TEXT NOT NULL,
        event_payload TEXT DEFAULT '{}',
        screenshot_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      CREATE INDEX idx_task_audit_logs_task ON task_audit_logs(task_id);

      INSERT INTO task_audit_logs (
        id, task_id, account_id, action_type, event_name, event_payload, screenshot_path
      )
      VALUES (
        1, 1, 1, 'publish', 'legacy_audit_event', '{"legacy":true}', '/tmp/legacy-audit.png'
      );
    `)

    return database
  }

  function taskContentIdNotNull(database: Database.Database): number | undefined {
    const columns = database.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string; notnull: number }>
    return columns.find((column) => column.name === 'content_id')?.notnull
  }

  function foreignKeyTargetTables(database: Database.Database, tableName: string): string[] {
    const rows = database.prepare(`PRAGMA foreign_key_list(${tableName})`).all() as Array<{ table: string }>
    return rows.map((row) => row.table)
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
    expect(schema).toMatch(/content_id INTEGER,\s+platform TEXT NOT NULL/s)
  })

  it('can execute target schema against a legacy database before guarded migrations run', () => {
    const database = createLegacyDatabase()
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')

    expect(() => database.exec(schema)).not.toThrow()
    expect(() => runMigrations(database)).not.toThrow()
    expect(columnExists(database, 'accounts', 'account_alias')).toBe(true)
    expect(columnExists(database, 'tasks', 'action_type')).toBe(true)
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_accounts_alias_platform'").get()).toBeTruthy()
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_tasks_batch_action'").get()).toBeTruthy()
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_tasks_confirmation'").get()).toBeTruthy()
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_task_audit_logs_task'").get()).toBeTruthy()

    database.close()
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

  it('preserves publish log foreign keys when rebuilding a legacy tasks table', () => {
    const database = createLegacyDatabase()

    runMigrations(database)

    expect(foreignKeyTargetTables(database, 'publish_logs')).toContain('tasks')
    expect(foreignKeyTargetTables(database, 'publish_logs')).not.toContain('tasks_old_content_not_null')
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(database.prepare('SELECT task_id, step, action, duration_ms FROM publish_logs WHERE id = 1').get()).toMatchObject({
      task_id: 1,
      step: 'legacy_step',
      action: 'legacy_action',
      duration_ms: 120
    })

    expect(() => {
      database.prepare("INSERT INTO publish_logs (task_id, step, action) VALUES (1, 'new_step', 'new_action')").run()
    }).not.toThrow()
    expect(database.prepare('SELECT COUNT(*) as count FROM publish_logs').get()).toMatchObject({ count: 2 })

    database.close()
  })

  it('preserves audit log foreign keys when rebuilding a legacy tasks table', () => {
    const database = createLegacyDatabaseWithAuditLogs()

    runMigrations(database)

    expect(foreignKeyTargetTables(database, 'task_audit_logs')).toContain('tasks')
    expect(foreignKeyTargetTables(database, 'task_audit_logs')).not.toContain('tasks_old_content_not_null')
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(database.prepare(`
      SELECT task_id, account_id, action_type, event_name, event_payload, screenshot_path
      FROM task_audit_logs
      WHERE id = 1
    `).get()).toMatchObject({
      task_id: 1,
      account_id: 1,
      action_type: 'publish',
      event_name: 'legacy_audit_event',
      event_payload: '{"legacy":true}',
      screenshot_path: '/tmp/legacy-audit.png'
    })

    expect(() => {
      database.prepare(`
        INSERT INTO task_audit_logs (task_id, account_id, action_type, event_name, event_payload)
        VALUES (1, 1, 'comment', 'new_audit_event', '{"new":true}')
      `).run()
    }).not.toThrow()
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_task_audit_logs_task'").get()).toBeTruthy()

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
