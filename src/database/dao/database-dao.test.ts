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

    if (this.sql.includes('UPDATE tasks') && this.sql.includes("SET confirmed_at = datetime('now')")) {
      const task = this.database.tasks.find(
        (row) => row.id === params[0] &&
          row.require_manual_confirm === 1 &&
          row.confirmed_at === null
      )
      if (task) task.confirmed_at = '2026-06-27 10:00:00'
      return { changes: task ? 1 : 0, lastInsertRowid: 0 }
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

    if (this.sql.includes('WHERE t.require_manual_confirm = 1 AND t.confirmed_at IS NULL')) {
      return this.database.tasks
        .filter((task) => task.require_manual_confirm === 1 && task.confirmed_at === null)
        .map((task) => {
          const account = this.database.accounts.find((row) => row.id === task.account_id)
          const content = this.database.contentPool.find((row) => row.id === task.content_id)
          return {
            ...task,
            content_title: content?.title,
            account_nickname: account?.nickname,
            account_alias: account?.account_alias
          }
        })
        .sort((left, right) => {
          const priorityDiff = Number(right.priority) - Number(left.priority)
          return priorityDiff || Number(left.id) - Number(right.id)
        })
    }

    if (this.sql.includes("WHERE t.status IN ('pending', 'queued')")) {
      const limit = Number(params[0] ?? 10)
      return this.database.tasks
        .filter((task) => task.status === 'pending' || task.status === 'queued')
        .filter((task) => task.scheduled_at === null || String(task.scheduled_at) <= '2026-06-27 10:00:00')
        .filter((task) => task.require_manual_confirm === 0 || task.confirmed_at !== null)
        .sort((left, right) => {
          const priorityDiff = Number(right.priority) - Number(left.priority)
          return priorityDiff || Number(left.id) - Number(right.id)
        })
        .slice(0, limit)
    }

    return []
  }
}

class FakeDatabase {
  readonly accounts: Row[] = []
  readonly contentPool: Row[] = []
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
      confirmed_at: null,
      risk_level: params[12],
      audit_payload: params[13],
      status: 'pending',
      retry_count: 0
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

  it('returns manual-confirmation tasks joined with content and account metadata in execution order', () => {
    const accountDao = new AccountDao()
    const firstAccountId = accountDao.insert({
      nickname: '运营账号A',
      platform: 'xiaohongshu',
      account_alias: 'xhs_ops_001'
    })
    const secondAccountId = accountDao.insert({
      nickname: '运营账号B',
      platform: 'xiaohongshu',
      account_alias: 'xhs_ops_002'
    })
    state.database?.contentPool.push(
      { id: 101, title: '灵芝饮夏日笔记' },
      { id: 102, title: '下午茶评论任务' }
    )

    const taskDao = new TaskDao()
    const lowPriorityTaskId = taskDao.insert({
      account_id: firstAccountId,
      content_id: 101,
      platform: 'xiaohongshu',
      action_type: 'publish',
      priority: 3,
      require_manual_confirm: true,
      risk_level: 'low'
    })
    const highPriorityTaskId = taskDao.insert({
      account_id: secondAccountId,
      content_id: 102,
      platform: 'xiaohongshu',
      action_type: 'comment',
      target_note_url: 'https://www.xiaohongshu.com/explore/target',
      comment_text: '看起来很适合下午喝',
      priority: 9,
      require_manual_confirm: true,
      risk_level: 'medium'
    })
    taskDao.insert({
      account_id: firstAccountId,
      platform: 'xiaohongshu',
      action_type: 'browse',
      priority: 20,
      require_manual_confirm: false
    })

    expect(taskDao.getPendingConfirmation()).toEqual([
      expect.objectContaining({
        id: highPriorityTaskId,
        action_type: 'comment',
        target_note_url: 'https://www.xiaohongshu.com/explore/target',
        content_title: '下午茶评论任务',
        account_nickname: '运营账号B',
        account_alias: 'xhs_ops_002',
        require_manual_confirm: 1,
        confirmed_at: null,
        risk_level: 'medium'
      }),
      expect.objectContaining({
        id: lowPriorityTaskId,
        action_type: 'publish',
        content_title: '灵芝饮夏日笔记',
        account_nickname: '运营账号A',
        account_alias: 'xhs_ops_001'
      })
    ])
  })

  it('sets confirmed_at and removes the task from pending confirmation', () => {
    const accountDao = new AccountDao()
    const accountId = accountDao.insert({
      nickname: '确认账号A',
      platform: 'xiaohongshu',
      account_alias: 'xhs_confirm_001'
    })
    const taskDao = new TaskDao()
    const taskId = taskDao.insert({
      account_id: accountId,
      platform: 'xiaohongshu',
      action_type: 'favorite',
      require_manual_confirm: true,
      priority: 5
    })

    expect(taskDao.confirmTask(taskId)).toBe(true)

    expect(taskDao.getById(taskId)).toMatchObject({
      id: taskId,
      confirmed_at: '2026-06-27 10:00:00'
    })
    expect(taskDao.getPendingConfirmation()).toEqual([])
    expect(taskDao.confirmTask(taskId)).toBe(false)
    expect(taskDao.confirmTask(999)).toBe(false)
  })

  it('does not confirm non-manual tasks', () => {
    const accountDao = new AccountDao()
    const accountId = accountDao.insert({
      nickname: '免确认账号',
      platform: 'xiaohongshu',
      account_alias: 'xhs_no_confirm_001'
    })
    const taskDao = new TaskDao()
    const taskId = taskDao.insert({
      account_id: accountId,
      platform: 'xiaohongshu',
      action_type: 'browse',
      require_manual_confirm: false,
      priority: 5
    })

    expect(taskDao.confirmTask(taskId)).toBe(false)
    expect(taskDao.getById(taskId)).toMatchObject({
      id: taskId,
      confirmed_at: null
    })
  })

  it('only queues tasks that are confirmed or exempt from manual confirmation', () => {
    const accountDao = new AccountDao()
    const accountId = accountDao.insert({
      nickname: '调度账号',
      platform: 'xiaohongshu',
      account_alias: 'xhs_queue_001'
    })
    const taskDao = new TaskDao()
    const unconfirmedTaskId = taskDao.insert({
      account_id: accountId,
      platform: 'xiaohongshu',
      action_type: 'comment',
      require_manual_confirm: true,
      priority: 100
    })
    const confirmedTaskId = taskDao.insert({
      account_id: accountId,
      platform: 'xiaohongshu',
      action_type: 'publish',
      require_manual_confirm: true,
      priority: 50
    })
    const exemptTaskId = taskDao.insert({
      account_id: accountId,
      platform: 'xiaohongshu',
      action_type: 'browse',
      require_manual_confirm: false,
      priority: 10
    })
    taskDao.confirmTask(confirmedTaskId)

    expect(taskDao.getQueuedTasks().map((task) => task.id)).toEqual([confirmedTaskId, exemptTaskId])
    expect(taskDao.getQueuedTasks().map((task) => task.id)).not.toContain(unconfirmedTaskId)
  })
})
