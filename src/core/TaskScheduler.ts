import { getDatabase } from '../database/db'
import type { Task } from '../shared/types'

/**
 * 任务调度器
 * 令牌桶 + 时间窗双重调度机制
 */
export class TaskScheduler {
  private tokenBucket: number
  private maxTokens: number
  private refillRate: number // tokens per second
  private lastRefill: number
  private running: boolean = false
  private timer: NodeJS.Timeout | null = null

  constructor(maxTokens: number = 3, refillRate: number = 0.05) {
    this.maxTokens = maxTokens
    this.tokenBucket = maxTokens
    this.refillRate = refillRate
    this.lastRefill = Date.now()
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
   * 调度tick：检查并执行任务
   */
  private tick(): void {
    // TODO: implement
    // 1. refill令牌
    // 2. 查询pending/queued任务
    // 3. 按priority和scheduled_at排序
    // 4. 消费令牌，分发任务执行
    this.refillTokens()
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
         ORDER BY priority DESC, id ASC
         LIMIT ?`
      )
      .all(limit) as Task[]
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
