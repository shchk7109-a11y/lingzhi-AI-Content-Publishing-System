import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { DB_FILENAME } from '../shared/constants'

let db: Database.Database | null = null

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
