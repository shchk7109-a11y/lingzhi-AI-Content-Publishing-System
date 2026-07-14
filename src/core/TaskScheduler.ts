import { getDatabase } from '../database/db'
import type { Task } from '../shared/types'

const SUPPORTED_ACTION_TYPES = new Set(['publish', 'comment', 'favorite', 'collect', 'browse'])

// 调度器只依赖这个最小接口，不直接依赖 puppeteer/发布器，保持模块边界
export interface SchedulableExecutor {
  execute(task: Task): Promise<void>
}

export interface TaskSchedulerOptions {
  executor?: SchedulableExecutor
  // 最大在途任务数（应与窗口池并发数对齐）
  maxConcurrent?: number
}

/**
 * 任务调度器
 * 令牌桶（控制发布频率）+ 时间窗（避免深夜）+ 在途并发上限三重调度机制。
 * 注入 executor 后，tick 会真正驱动任务执行；未注入时退化为仅校验（向后兼容）。
 */
export class TaskScheduler {
  private tokenBucket: number
  private maxTokens: number
  private refillRate: number // tokens per second
  private lastRefill: number
  private running: boolean = false
  private timer: NodeJS.Timeout | null = null
  private readonly executor?: SchedulableExecutor
  private maxConcurrent: number
  // 在途任务ID，防止重复调度、控制并发
  private readonly inFlight: Set<number> = new Set()

  constructor(maxTokens: number = 3, refillRate: number = 0.05, options?: TaskSchedulerOptions) {
    this.maxTokens = maxTokens
    this.tokenBucket = maxTokens
    this.refillRate = refillRate
    this.lastRefill = Date.now()
    this.executor = options?.executor
    this.maxConcurrent = Math.max(1, options?.maxConcurrent ?? maxTokens)
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = Math.max(1, Math.floor(n))
  }

  /**
   * 启动调度循环
   */
  start(): void {
    // TODO: implement
    // 1. 设置running = true
    // 2. 启动定时器，每隔一段时间检查待执行任务
    // 3. 令牌桶refill
    // 4. 有令牌且有待执行任务时，消费令牌并执行
    this.running = true
    this.timer = setInterval(() => {
      this.tick()
    }, 5000)
  }

  /**
   * 停止调度
   */
  stop(): void {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * 调度tick：检查并执行任务（public 便于测试手动触发一次）
   */
  tick(): void {
    if (!this.running) return
    this.refillTokens()

    // 未注入执行器：退化为仅校验（向后兼容，不真正执行）
    if (!this.executor) {
      this.validateRunnableTasks(this.getNextTasks(Math.floor(this.tokenBucket)))
      return
    }

    // 时间窗保护：非允许时段不发起新任务
    if (!this.isWithinPublishWindow()) return

    // 可启动数 = min(可用令牌, 剩余并发额度)
    const capacity = Math.min(Math.floor(this.tokenBucket), this.maxConcurrent - this.inFlight.size)
    if (capacity <= 0) return

    // 多取一些以便过滤掉仍在途（DB尚未标记running）的任务
    const candidates = this.validateRunnableTasks(this.getNextTasks(capacity + this.inFlight.size))
      .filter((task) => !this.inFlight.has(task.id))
      .slice(0, capacity)

    for (const task of candidates) {
      if (!this.tryConsumeToken()) break
      this.inFlight.add(task.id)
      // fire-and-forget：executor.execute 内部自行处理所有回写与异常
      void this.executor
        .execute(task)
        .catch((error) => {
          console.error(`[TaskScheduler] Task ${task.id} execution error:`, error)
        })
        .finally(() => {
          this.inFlight.delete(task.id)
        })
    }
  }

  /**
   * 调度器状态
   */
  getStatus(): {
    running: boolean
    tokens: number
    maxConcurrent: number
    inFlight: number
    hasExecutor: boolean
  } {
    return {
      running: this.running,
      tokens: Math.floor(this.tokenBucket),
      maxConcurrent: this.maxConcurrent,
      inFlight: this.inFlight.size,
      hasExecutor: Boolean(this.executor)
    }
  }

  /**
   * 补充令牌
   */
  private refillTokens(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    this.tokenBucket = Math.min(this.maxTokens, this.tokenBucket + elapsed * this.refillRate)
    this.lastRefill = now
  }

  /**
   * 尝试消费一个令牌
   */
  tryConsumeToken(): boolean {
    if (this.tokenBucket >= 1) {
      this.tokenBucket -= 1
      return true
    }
    return false
  }

  /**
   * 获取下一批待执行任务
   */
  getNextTasks(limit: number): Task[] {
    const db = getDatabase()
    return db
      .prepare(
        `SELECT * FROM tasks
         WHERE status IN ('pending', 'queued')
         AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
         AND (require_manual_confirm = 0 OR confirmed_at IS NOT NULL)
         ORDER BY priority DESC, id ASC
         LIMIT ?`
      )
      .all(limit) as Task[]
  }

  /**
   * 执行器接入前的任务动作白名单保护。
   */
  validateRunnableTasks(tasks: Task[]): Task[] {
    return tasks.filter((task) => {
      if (SUPPORTED_ACTION_TYPES.has(task.action_type)) {
        return true
      }

      this.updateTaskStatus(task.id, 'failed', {
        error_log: `Unsupported action_type: ${task.action_type}`
      })
      return false
    })
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId: number, status: string, extra?: Record<string, unknown>): void {
    const db = getDatabase()
    let sql = `UPDATE tasks SET status = ?`
    const params: unknown[] = [status]

    if (extra?.started_at) {
      sql += ', started_at = ?'
      params.push(extra.started_at)
    }
    if (extra?.finished_at) {
      sql += ', finished_at = ?'
      params.push(extra.finished_at)
    }
    if (extra?.error_log !== undefined) {
      sql += ', error_log = ?'
      params.push(extra.error_log)
    }
    if (extra?.last_step) {
      sql += ', last_step = ?'
      params.push(extra.last_step)
    }

    sql += ' WHERE id = ?'
    params.push(taskId)

    db.prepare(sql).run(...params)
  }

  /**
   * 时间窗检查：判断当前是否在允许发布的时间窗口内
   */
  isWithinPublishWindow(): boolean {
    // TODO: implement
    // 检查当前时间是否在配置的发布时间窗口内
    // 避免深夜发布等异常行为
    const hour = new Date().getHours()
    return hour >= 7 && hour <= 23
  }
}
