import { getDatabase } from '../database/db'
import { BitBrowserManager } from './BitBrowserManager'
import type { Task } from '../shared/types'

/**
 * 崩溃恢复
 * 启动自检 + 僵尸进程清理 + 断点续传
 */
export class CrashRecovery {
  private bitManager: BitBrowserManager

  constructor(bitManager?: BitBrowserManager) {
    this.bitManager = bitManager || new BitBrowserManager()
  }

  /**
   * 启动自检 - 应用启动时调用
   * 1. 扫描tasks表中status='running'的任务，全部重置为'failed'
   * 2. 调用BitBrowserManager.forceCloseAll() 清理僵尸浏览器窗口
   * 3. 记录恢复日志
   */
  async startupCheck(): Promise<{ recovered: number; cleaned: number }> {
    let recovered = 0
    let cleaned = 0

    try {
      // 检测遗留的running任务
      const staleTasks = this.findStaleTasks()

      if (staleTasks.length > 0) {
        console.log(`[CrashRecovery] Found ${staleTasks.length} stale running tasks`)

        for (const task of staleTasks) {
          if (task.last_step && this.canResume(task)) {
            this.markForResume(task.id, task.last_step)
            recovered++
            console.log(`[CrashRecovery] Task #${task.id} marked for resume from step [${task.last_step}]`)
          } else {
            this.markAsFailed(task.id, '应用异常重启')
            cleaned++
            console.log(`[CrashRecovery] Task #${task.id} marked as failed (app crash)`)
          }
        }
      }

      // 清理僵尸浏览器窗口
      try {
        await this.bitManager.forceCloseAll()
        console.log('[CrashRecovery] Zombie browser cleanup completed')
      } catch (error) {
        console.warn('[CrashRecovery] Browser cleanup skipped (Bit not running):', (error as Error).message)
      }

      console.log(`[CrashRecovery] Startup check complete: recovered=${recovered}, cleaned=${cleaned}`)
    } catch (error) {
      console.error('[CrashRecovery] Startup check failed:', error)
    }

    return { recovered, cleaned }
  }

  /**
   * 查找遗留的running状态任务
   */
  findStaleTasks(): Task[] {
    try {
      const db = getDatabase()
      return db
        .prepare("SELECT * FROM tasks WHERE status = 'running'")
        .all() as Task[]
    } catch {
      return []
    }
  }

  /**
   * 判断任务是否可以从断点恢复
   * warmup/navigate/input步骤可以安全恢复
   * upload_media/publish步骤不宜从中间恢复（可能产生重复内容）
   */
  canResume(task: Task): boolean {
    const resumableSteps = ['warmup', 'navigate', 'input_title', 'input_content', 'add_tags']
    return task.last_step !== null && resumableSteps.includes(task.last_step)
  }

  /**
   * 标记任务为可恢复状态
   */
  markForResume(taskId: number, lastStep: string): void {
    const db = getDatabase()
    db.prepare("UPDATE tasks SET status = 'queued', error_log = ? WHERE id = ?")
      .run(`从步骤 [${lastStep}] 恢复`, taskId)
  }

  /**
   * 标记任务为失败
   */
  markAsFailed(taskId: number, reason: string): void {
    const db = getDatabase()
    db.prepare("UPDATE tasks SET status = 'failed', error_log = ?, finished_at = datetime('now') WHERE id = ?")
      .run(reason, taskId)
  }

  /**
   * 记录任务执行步骤（用于崩溃恢复）
   */
  recordStep(taskId: number, step: string): void {
    const db = getDatabase()
    db.prepare('UPDATE tasks SET last_step = ? WHERE id = ?').run(step, taskId)
  }
}
