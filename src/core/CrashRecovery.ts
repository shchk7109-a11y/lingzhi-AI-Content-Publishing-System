import { getDatabase } from '../database/db'
import type { Task } from '../shared/types'

/**
 * 崩溃恢复
 * 启动自检 + 僵尸进程清理 + 断点续传
 */
export class CrashRecovery {
  /**
   * 启动自检 - 应用启动时调用
   * 1. 检测上次异常退出遗留的running任务
   * 2. 清理僵尸浏览器进程
   * 3. 恢复可断点续传的任务
   */
  async startupCheck(): Promise<{ recovered: number; cleaned: number }> {
    let recovered = 0
    let cleaned = 0

    try {
      // 检测遗留的running任务
      const staleTasks = this.findStaleTasks()
      for (const task of staleTasks) {
        if (task.last_step && this.canResume(task)) {
          // 标记为可恢复
          this.markForResume(task.id, task.last_step)
          recovered++
        } else {
          // 标记为失败
          this.markAsFailed(task.id, '应用异常退出，任务中断')
          cleaned++
        }
      }

      // 清理僵尸进程
      const zombies = await this.cleanZombieProcesses()
      cleaned += zombies

      console.log(`[CrashRecovery] Startup check: recovered=${recovered}, cleaned=${cleaned}`)
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
   */
  canResume(task: Task): boolean {
    // TODO: implement
    // 根据last_step判断是否可以安全恢复
    // 某些步骤（如upload_media、publish）不宜从中间恢复
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
   * 清理僵尸浏览器进程
   */
  async cleanZombieProcesses(): Promise<number> {
    // TODO: implement
    // 1. 检查系统中是否有残留的Bit浏览器子进程
    // 2. 对比当前任务列表，终止无对应任务的进程
    // 3. 返回清理的进程数
    return 0
  }

  /**
   * 记录任务执行步骤（用于崩溃恢复）
   */
  recordStep(taskId: number, step: string): void {
    const db = getDatabase()
    db.prepare('UPDATE tasks SET last_step = ? WHERE id = ?').run(step, taskId)
  }
}
