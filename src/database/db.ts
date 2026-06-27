import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { DB_FILENAME } from '../shared/constants'

let db: Database.Database | null = null

export function columnExists(database: Database.Database, tableName: string, columnName: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  return columns.some((column) => column.name === columnName)
}

function columnIsNotNull(database: Database.Database, tableName: string, columnName: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string; notnull: number }>
  return columns.some((column) => column.name === columnName && column.notnull === 1)
}

export function addColumnIfMissing(
  database: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
): void {
  if (!columnExists(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
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
    console.warn('[Database] Existing tasks.content_id is NOT NULL; SQLite requires a table rebuild to relax it.')
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_alias_platform ON accounts(account_alias, platform);
    CREATE INDEX IF NOT EXISTS idx_tasks_batch_action ON tasks(batch_id, action_type);
    CREATE INDEX IF NOT EXISTS idx_tasks_confirmation ON tasks(require_manual_confirm, confirmed_at);
    CREATE INDEX IF NOT EXISTS idx_task_audit_logs_task ON task_audit_logs(task_id);
  `)
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
