import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  database: null as FakeSchedulerDatabase | null
}))

vi.mock('../database/db', () => ({
  getDatabase: () => {
    if (!state.database) {
      throw new Error('test database is not initialized')
    }
    return state.database
  }
}))

import { TaskScheduler } from './TaskScheduler'

type TaskRow = Record<string, unknown>

class FakeSchedulerStatement {
  constructor(
    private readonly database: FakeSchedulerDatabase,
    private readonly sql: string
  ) {}

  all(limit: number): TaskRow[] {
    if (this.sql.includes("WHERE status IN ('pending', 'queued')")) {
      return this.database.tasks
        .filter((task) => task.status === 'pending' || task.status === 'queued')
        .filter((task) => task.scheduled_at === null)
        .filter((task) => task.require_manual_confirm === 0 || task.confirmed_at !== null)
        .sort((left, right) => {
          const priorityDiff = Number(right.priority) - Number(left.priority)
          return priorityDiff || Number(left.id) - Number(right.id)
        })
        .slice(0, limit)
    }

    return []
  }

  run(...params: unknown[]): { changes: number } {
    if (this.sql.includes('UPDATE tasks SET status = ?')) {
      const task = this.database.tasks.find((row) => row.id === params.at(-1))
      if (task) {
        task.status = params[0]
        task.error_log = params[1]
      }
      return { changes: task ? 1 : 0 }
    }

    return { changes: 0 }
  }
}

class FakeSchedulerDatabase {
  readonly tasks: TaskRow[] = []
  lastPreparedSql = ''

  prepare(sql: string): FakeSchedulerStatement {
    this.lastPreparedSql = sql
    return new FakeSchedulerStatement(this, sql)
  }
}

describe('TaskScheduler', () => {
  beforeEach(() => {
    state.database = new FakeSchedulerDatabase()
  })

  it('only returns tasks that are confirmed or exempt from manual confirmation', () => {
    state.database?.tasks.push(
      {
        id: 1,
        status: 'queued',
        priority: 100,
        scheduled_at: null,
        require_manual_confirm: 1,
        confirmed_at: null,
        action_type: 'comment'
      },
      {
        id: 2,
        status: 'queued',
        priority: 50,
        scheduled_at: null,
        require_manual_confirm: 1,
        confirmed_at: '2026-06-27 10:00:00',
        action_type: 'publish'
      },
      {
        id: 3,
        status: 'pending',
        priority: 10,
        scheduled_at: null,
        require_manual_confirm: 0,
        confirmed_at: null,
        action_type: 'browse'
      }
    )

    expect(new TaskScheduler().getNextTasks(10).map((task) => task.id)).toEqual([2, 3])
    expect(state.database?.lastPreparedSql).toContain(
      'AND (require_manual_confirm = 0 OR confirmed_at IS NOT NULL)'
    )
  })

  it('fails unsupported task actions before execution wiring', () => {
    state.database?.tasks.push({
      id: 1,
      status: 'queued',
      priority: 1,
      scheduled_at: null,
      require_manual_confirm: 0,
      confirmed_at: null,
      action_type: 'unsupported'
    })
    const scheduler = new TaskScheduler()

    scheduler.validateRunnableTasks(scheduler.getNextTasks(10))

    expect(state.database?.tasks[0]).toMatchObject({
      status: 'failed',
      error_log: 'Unsupported action_type: unsupported'
    })
  })

  it('注入executor后，tick按容量分发任务并消费令牌', () => {
    for (let i = 1; i <= 5; i++) {
      state.database?.tasks.push({
        id: i, status: 'queued', priority: 10, scheduled_at: null,
        require_manual_confirm: 0, confirmed_at: null, action_type: 'publish'
      })
    }
    const execute = vi.fn(async () => {})
    // maxTokens=3, maxConcurrent=2 → 一次tick最多启动2个
    const scheduler = new TaskScheduler(3, 0.05, { executor: { execute }, maxConcurrent: 2 })
    vi.spyOn(scheduler, 'isWithinPublishWindow').mockReturnValue(true) // 避免依赖真实时间
    scheduler.start()
    scheduler.tick()
    scheduler.stop()

    expect(execute).toHaveBeenCalledTimes(2)
    expect(scheduler.getStatus().tokens).toBe(1) // 3 - 2
  })

  it('未注入executor时tick不执行任务（向后兼容仅校验）', () => {
    state.database?.tasks.push({
      id: 1, status: 'queued', priority: 10, scheduled_at: null,
      require_manual_confirm: 0, confirmed_at: null, action_type: 'publish'
    })
    const scheduler = new TaskScheduler(3, 0.05)
    scheduler.start()
    expect(() => scheduler.tick()).not.toThrow()
    scheduler.stop()
    // publish 是受支持动作，校验分支不会把它标记失败
    expect(state.database?.tasks[0].status).toBe('queued')
  })
})
