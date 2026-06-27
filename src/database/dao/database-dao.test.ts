import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  database: null as FakeDatabase | null
}))

vi.mock('../db', () => ({
  getDatabase: () => {
    if (!state.database) {
      throw new Error('test database is not initialized')
    }
    return state.database
  }
}))

import { AccountDao } from './AccountDao'
import { TaskDao } from './TaskDao'

interface RunResult {
  changes: number
  lastInsertRowid: number
}

type Row = Record<string, unknown>

class FakeStatement {
  constructor(
    private readonly database: FakeDatabase,
    readonly sql: string
  ) {}

  run(...params: unknown[]): RunResult {
    this.database.runs.push({ sql: this.sql, params })

    if (this.sql.includes('INSERT INTO accounts')) {
      const row = this.database.insertAccount(params)
      return { changes: 1, lastInsertRowid: row.id as number }
    }

    if (this.sql.includes('INSERT INTO tasks')) {
      const row = this.database.insertTask(params)
      return { changes: 1, lastInsertRowid: row.id as number }
    }

    return { changes: 1, lastInsertRowid: 0 }
  }

  get(...params: unknown[]): Row | undefined {
    if (this.sql.includes('WHERE platform = ? AND account_alias = ?')) {
      return this.database.accounts.find(
        (row) => row.platform === params[0] && row.account_alias === params[1]
      )
    }

    if (this.sql.includes('FROM tasks t') && this.sql.includes('WHERE t.id = ?')) {
      return this.database.tasks.find((row) => row.id === params[0])
    }

    return undefined
  }

  all(...params: unknown[]): Row[] {
    if (this.sql.includes('FROM accounts') && this.sql.includes('account_alias LIKE ?')) {
      const term = String(params.at(-1)).replaceAll('%', '')
      return this.database.accounts.filter(
        (row) => String(row.nickname).includes(term) ||
          String(row.customer_id).includes(term) ||
          String(row.account_alias).includes(term)
      )
    }

    return []
  }
}

class FakeDatabase {
  readonly accounts: Row[] = []
  readonly tasks: Row[] = []
  readonly runs: Array<{ sql: string; params: unknown[] }> = []

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql)
  }

  transaction(callback: () => void): () => void {
    return callback
  }

  insertAccount(params: unknown[]): Row {
    const row = {
      id: this.accounts.length + 1,
      nickname: params[0],
      platform: params[1],
      bit_profile_id: params[2],
      customer_id: params[3],
      persona: params[4],
      account_level: params[5],
      proxy_type: params[6],
      proxy_config: params[7],
      region: params[8],
      daily_limit: params[9],
      weekly_target: params[10],
      account_alias: params[11],
      daily_interaction_limit: params[12],
      last_health_check_at: params[13]
    }
    this.accounts.push(row)
    return row
  }

  insertTask(params: unknown[]): Row {
    const row = {
      id: this.tasks.length + 1,
      match_record_id: params[0],
      account_id: params[1],
      content_id: params[2],
      platform: params[3],
      priority: params[4],
      scheduled_at: params[5],
      batch_id: params[6],
      draft_id: params[7],
      action_type: params[8],
      target_note_url: params[9],
      comment_text: params[10],
      require_manual_confirm: params[11],
      risk_level: params[12],
      audit_payload: params[13]
    }
    this.tasks.push(row)
    return row
  }

  close(): void {}
}

function createTestDatabase(): FakeDatabase {
  const database = new FakeDatabase()
  return database
}

describe('database DAOs', () => {
  beforeEach(() => {
    state.database = createTestDatabase()
  })

  afterEach(() => {
    state.database?.close()
    state.database = null
  })

  it('stores account alias metadata and can find an account by platform alias', () => {
    const dao = new AccountDao()

    const accountId = dao.insert({
      nickname: '发布账号A',
      platform: 'xiaohongshu',
      account_alias: 'xhs_a_001',
      daily_interaction_limit: 35,
      last_health_check_at: '2026-06-27T09:30:00+08:00'
    })

    expect(dao.getByAlias('xiaohongshu', 'xhs_a_001')).toMatchObject({
      id: accountId,
      account_alias: 'xhs_a_001',
      daily_interaction_limit: 35,
      last_health_check_at: '2026-06-27T09:30:00+08:00'
    })
    expect(dao.getAll({ search: 'xhs_a' })).toHaveLength(1)
  })

  it('batch inserts account alias metadata', () => {
    const dao = new AccountDao()

    expect(
      dao.batchInsert([
        {
          nickname: '发布账号B',
          platform: 'xiaohongshu',
          account_alias: 'xhs_b_001',
          daily_interaction_limit: 18
        }
      ])
    ).toBe(1)

    expect(dao.getByAlias('xiaohongshu', 'xhs_b_001')).toMatchObject({
      account_alias: 'xhs_b_001',
      daily_interaction_limit: 18
    })
  })

  it('inserts interaction tasks without content and stores action audit payload fields', () => {
    const accountDao = new AccountDao()
    const accountId = accountDao.insert({
      nickname: '互动账号A',
      platform: 'xiaohongshu',
      account_alias: 'xhs_interact_001'
    })
    const taskDao = new TaskDao()

    const taskId = taskDao.insert({
      account_id: accountId,
      platform: 'xiaohongshu',
      batch_id: 'batch_20260627_001',
      draft_id: 'comment_001',
      action_type: 'comment',
      target_note_url: 'https://www.xiaohongshu.com/explore/abc',
      comment_text: '这杯看起来很适合下午喝',
      require_manual_confirm: false,
      risk_level: 'medium',
      audit_payload: { source: 'task-package', row: 3 }
    })

    expect(taskDao.getById(taskId)).toMatchObject({
      id: taskId,
      content_id: null,
      batch_id: 'batch_20260627_001',
      draft_id: 'comment_001',
      action_type: 'comment',
      target_note_url: 'https://www.xiaohongshu.com/explore/abc',
      comment_text: '这杯看起来很适合下午喝',
      require_manual_confirm: 0,
      risk_level: 'medium',
      audit_payload: JSON.stringify({ source: 'task-package', row: 3 })
    })
  })
})
