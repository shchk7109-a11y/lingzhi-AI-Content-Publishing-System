import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { DB_FILENAME } from '../shared/constants'

let db: Database.Database | null = null

const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

const TASK_COLUMNS = [
  'id',
  'match_record_id',
  'account_id',
  'content_id',
  'platform',
  'batch_id',
  'draft_id',
  'action_type',
  'target_note_url',
  'comment_text',
  'require_manual_confirm',
  'confirmed_at',
  'risk_level',
  'audit_payload',
  'status',
  'priority',
  'scheduled_at',
  'started_at',
  'finished_at',
  'result_url',
  'error_log',
  'retry_count',
  'screenshot_path',
  'last_step'
] as const

const CREATE_TASKS_TABLE_SQL = `
  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_record_id INTEGER,
    account_id INTEGER NOT NULL,
    content_id INTEGER,
    platform TEXT NOT NULL,
    batch_id TEXT DEFAULT '',
    draft_id TEXT DEFAULT '',
    action_type TEXT DEFAULT 'publish',
    target_note_url TEXT DEFAULT '',
    comment_text TEXT DEFAULT '',
    require_manual_confirm INTEGER DEFAULT 1,
    confirmed_at DATETIME,
    risk_level TEXT DEFAULT 'low',
    audit_payload TEXT DEFAULT '{}',
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
    FOREIGN KEY (match_record_id) REFERENCES match_records(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (content_id) REFERENCES content_pool(id)
  )
`

const PUBLISH_LOG_COLUMNS = [
  'id',
  'task_id',
  'step',
  'action',
  'timestamp',
  'duration_ms',
  'screenshot_path',
  'error'
] as const

const CREATE_PUBLISH_LOGS_TABLE_SQL = `
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
  )
`

const TASK_AUDIT_LOG_COLUMNS = [
  'id',
  'task_id',
  'account_id',
  'action_type',
  'event_name',
  'event_payload',
  'screenshot_path',
  'created_at'
] as const

const CREATE_TASK_AUDIT_LOGS_TABLE_SQL = `
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
  )
`

function assertSafeIdentifier(identifier: string): void {
  if (!SAFE_SQL_IDENTIFIER.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`)
  }
}

export function columnExists(database: Database.Database, tableName: string, columnName: string): boolean {
  assertSafeIdentifier(tableName)
  assertSafeIdentifier(columnName)
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  return columns.some((column) => column.name === columnName)
}

function columnIsNotNull(database: Database.Database, tableName: string, columnName: string): boolean {
  assertSafeIdentifier(tableName)
  assertSafeIdentifier(columnName)
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string; notnull: number }>
  return columns.some((column) => column.name === columnName && column.notnull === 1)
}

function tableExists(database: Database.Database, tableName: string): boolean {
  assertSafeIdentifier(tableName)
  const row = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName)
  return Boolean(row)
}

function columnsExist(database: Database.Database, tableName: string, columnNames: readonly string[]): boolean {
  return columnNames.every((columnName) => columnExists(database, tableName, columnName))
}

function createIndexIfColumnsExist(
  database: Database.Database,
  indexName: string,
  tableName: string,
  columnNames: readonly string[],
  unique: boolean = false
): void {
  assertSafeIdentifier(indexName)
  assertSafeIdentifier(tableName)
  for (const columnName of columnNames) {
    assertSafeIdentifier(columnName)
  }

  if (!tableExists(database, tableName) || !columnsExist(database, tableName, columnNames)) {
    return
  }

  const uniqueKeyword = unique ? 'UNIQUE ' : ''
  database.exec(
    `CREATE ${uniqueKeyword}INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columnNames.join(', ')});`
  )
}

export function addColumnIfMissing(
  database: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
): void {
  assertSafeIdentifier(tableName)
  assertSafeIdentifier(columnName)
  if (!columnExists(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  }
}

function createTaskIndexes(database: Database.Database): void {
  createIndexIfColumnsExist(database, 'idx_tasks_status_scheduled', 'tasks', ['status', 'scheduled_at'])
  createIndexIfColumnsExist(database, 'idx_tasks_batch_action', 'tasks', ['batch_id', 'action_type'])
  createIndexIfColumnsExist(database, 'idx_tasks_confirmation', 'tasks', ['require_manual_confirm', 'confirmed_at'])
}

function createPublishLogIndexes(database: Database.Database): void {
  createIndexIfColumnsExist(database, 'idx_publish_logs_task', 'publish_logs', ['task_id'])
}

function createTaskAuditLogIndexes(database: Database.Database): void {
  createIndexIfColumnsExist(database, 'idx_task_audit_logs_task', 'task_audit_logs', ['task_id'])
}

function createOptionalIndexes(database: Database.Database): void {
  createIndexIfColumnsExist(database, 'idx_match_records_account_date', 'match_records', ['account_id', 'matched_at'])
  createIndexIfColumnsExist(database, 'idx_content_pool_status_tags', 'content_pool', ['status', 'gender', 'age_group', 'health_focus'])
  createIndexIfColumnsExist(database, 'idx_proxy_pool_city_status', 'proxy_pool', ['city', 'status'])
  createIndexIfColumnsExist(database, 'idx_accounts_customer', 'accounts', ['customer_id'])
  createIndexIfColumnsExist(database, 'idx_content_pool_draft', 'content_pool', ['draft_id'])
  createIndexIfColumnsExist(database, 'idx_accounts_alias_platform', 'accounts', ['account_alias', 'platform'], true)
}

function foreignKeysEnabled(database: Database.Database): boolean {
  const row = database.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
  return row.foreign_keys === 1
}

function rebuildTasksWithNullableContentId(database: Database.Database): void {
  const wasForeignKeysEnabled = foreignKeysEnabled(database)
  const hasPublishLogs = tableExists(database, 'publish_logs')
  const hasTaskAuditLogs = tableExists(database, 'task_audit_logs')

  if (wasForeignKeysEnabled) {
    database.pragma('foreign_keys = OFF')
  }

  try {
    const rebuild = database.transaction(() => {
      if (hasPublishLogs) {
        database.exec(`
          CREATE TEMP TABLE publish_logs_backup AS SELECT * FROM publish_logs;
          DROP TABLE publish_logs;
        `)
      }

      if (hasTaskAuditLogs) {
        database.exec(`
          CREATE TEMP TABLE task_audit_logs_backup AS SELECT * FROM task_audit_logs;
          DROP TABLE task_audit_logs;
        `)
      }

      database.exec(`
        DROP INDEX IF EXISTS idx_tasks_status_scheduled;
        DROP INDEX IF EXISTS idx_tasks_batch_action;
        DROP INDEX IF EXISTS idx_tasks_confirmation;
        ALTER TABLE tasks RENAME TO tasks_old_content_not_null;
        ${CREATE_TASKS_TABLE_SQL};
        INSERT INTO tasks (${TASK_COLUMNS.join(', ')})
        SELECT ${TASK_COLUMNS.join(', ')}
        FROM tasks_old_content_not_null;
        DROP TABLE tasks_old_content_not_null;
      `)

      if (hasPublishLogs) {
        database.exec(`
          ${CREATE_PUBLISH_LOGS_TABLE_SQL};
          INSERT INTO publish_logs (${PUBLISH_LOG_COLUMNS.join(', ')})
          SELECT ${PUBLISH_LOG_COLUMNS.join(', ')}
          FROM publish_logs_backup;
          DROP TABLE publish_logs_backup;
        `)
        createPublishLogIndexes(database)
      }

      if (hasTaskAuditLogs) {
        database.exec(`
          ${CREATE_TASK_AUDIT_LOGS_TABLE_SQL};
          INSERT INTO task_audit_logs (${TASK_AUDIT_LOG_COLUMNS.join(', ')})
          SELECT ${TASK_AUDIT_LOG_COLUMNS.join(', ')}
          FROM task_audit_logs_backup;
          DROP TABLE task_audit_logs_backup;
        `)
        createTaskAuditLogIndexes(database)
      }
    })

    rebuild()
  } finally {
    if (wasForeignKeysEnabled) {
      database.pragma('foreign_keys = ON')
    }
  }
}

export function runMigrations(database: Database.Database): void {
  addColumnIfMissing(database, 'accounts', 'account_alias', 'TEXT')
  addColumnIfMissing(database, 'accounts', 'daily_interaction_limit', 'INTEGER DEFAULT 20')
  addColumnIfMissing(database, 'accounts', 'last_health_check_at', 'DATETIME')

  addColumnIfMissing(database, 'tasks', 'batch_id', "TEXT DEFAULT ''")
  addColumnIfMissing(database, 'tasks', 'draft_id', "TEXT DEFAULT ''")
  addColumnIfMissing(database, 'tasks', 'action_type', "TEXT DEFAULT 'publish'")
  addColumnIfMissing(database, 'tasks', 'target_note_url', "TEXT DEFAULT ''")
  addColumnIfMissing(database, 'tasks', 'comment_text', "TEXT DEFAULT ''")
  addColumnIfMissing(database, 'tasks', 'require_manual_confirm', 'INTEGER DEFAULT 1')
  addColumnIfMissing(database, 'tasks', 'confirmed_at', 'DATETIME')
  addColumnIfMissing(database, 'tasks', 'risk_level', "TEXT DEFAULT 'low'")
  addColumnIfMissing(database, 'tasks', 'audit_payload', "TEXT DEFAULT '{}'")

  if (columnIsNotNull(database, 'tasks', 'content_id')) {
    rebuildTasksWithNullableContentId(database)
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS task_audit_logs (
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

  `)
  createOptionalIndexes(database)
  createTaskIndexes(database)
  createPublishLogIndexes(database)
  createTaskAuditLogIndexes(database)
}

export function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, DB_FILENAME)
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): Database.Database {
  const dbPath = getDbPath()
  db = new Database(dbPath)

  // 启用 WAL 模式提升并发性能
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // 读取并执行 schema.sql
  const schemaPath = path.join(__dirname, '../../src/database/schema.sql')
  // 打包后的路径兜底
  const fallbackPath = path.join(__dirname, '../database/schema.sql')

  let schemaSQL = ''
  if (fs.existsSync(schemaPath)) {
    schemaSQL = fs.readFileSync(schemaPath, 'utf-8')
  } else if (fs.existsSync(fallbackPath)) {
    schemaSQL = fs.readFileSync(fallbackPath, 'utf-8')
  } else {
    console.error('schema.sql not found, skipping database initialization')
    return db
  }

  db.exec(schemaSQL)
  runMigrations(db)
  console.log('[Database] Initialized at:', dbPath)

  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[Database] Connection closed')
  }
}
