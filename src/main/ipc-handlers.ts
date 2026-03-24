import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'

export function registerIpcHandlers(): void {
  // ===== 内容池相关 =====
  ipcMain.handle('content:list', async (_event, filters?: Record<string, string>) => {
    const db = getDatabase()
    let sql = 'SELECT * FROM content_pool WHERE 1=1'
    const params: string[] = []

    if (filters?.status) {
      sql += ' AND status = ?'
      params.push(filters.status)
    }
    if (filters?.platform) {
      sql += ' AND platform = ?'
      params.push(filters.platform)
    }

    sql += ' ORDER BY created_at DESC'
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('content:import', async (_event, contents: Record<string, unknown>[]) => {
    // TODO: implement - 批量导入内容到内容池
    const db = getDatabase()
    const insert = db.prepare(`
      INSERT OR IGNORE INTO content_pool (draft_id, title, content, tags, image_paths, video_path, platform, media_type, gender, age_group, health_focus, product_line)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const transaction = db.transaction((items: Record<string, unknown>[]) => {
      for (const item of items) {
        insert.run(
          item.draft_id, item.title, item.content,
          JSON.stringify(item.tags || []),
          JSON.stringify(item.image_paths || []),
          item.video_path || '',
          item.platform || 'all',
          item.media_type || 'image',
          item.gender || 'all',
          item.age_group || 'all',
          item.health_focus || 'general',
          item.product_line || 'all'
        )
      }
    })
    transaction(contents)
    return { success: true, count: contents.length }
  })

  ipcMain.handle('content:update', async (_event, id: number, data: Record<string, unknown>) => {
    // TODO: implement - 更新内容项
    void id
    void data
  })

  ipcMain.handle('content:delete', async (_event, id: number) => {
    const db = getDatabase()
    db.prepare('DELETE FROM content_pool WHERE id = ?').run(id)
    return { success: true }
  })

  // ===== 账号相关 =====
  ipcMain.handle('account:list', async () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all()
  })

  ipcMain.handle('account:create', async (_event, account: Record<string, unknown>) => {
    // TODO: implement - 创建账号
    void account
  })

  ipcMain.handle('account:update', async (_event, id: number, data: Record<string, unknown>) => {
    // TODO: implement - 更新账号
    void id
    void data
  })

  ipcMain.handle('account:delete', async (_event, id: number) => {
    const db = getDatabase()
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    return { success: true }
  })

  // ===== 匹配相关 =====
  ipcMain.handle('match:run', async () => {
    // TODO: implement - 执行智能匹配
  })

  ipcMain.handle('match:list', async () => {
    const db = getDatabase()
    return db.prepare(`
      SELECT mr.*, cp.title as content_title, a.nickname as account_nickname
      FROM match_records mr
      LEFT JOIN content_pool cp ON mr.content_id = cp.id
      LEFT JOIN accounts a ON mr.account_id = a.id
      ORDER BY mr.matched_at DESC
    `).all()
  })

  ipcMain.handle('match:confirm', async (_event, matchIds: number[]) => {
    // TODO: implement - 确认匹配并创建发布任务
    void matchIds
  })

  // ===== 任务相关 =====
  ipcMain.handle('task:list', async () => {
    const db = getDatabase()
    return db.prepare(`
      SELECT t.*, cp.title as content_title, a.nickname as account_nickname
      FROM tasks t
      LEFT JOIN content_pool cp ON t.content_id = cp.id
      LEFT JOIN accounts a ON t.account_id = a.id
      ORDER BY t.id DESC
    `).all()
  })

  ipcMain.handle('task:start', async (_event, taskIds: number[]) => {
    // TODO: implement - 启动发布任务
    void taskIds
  })

  ipcMain.handle('task:retry', async (_event, taskId: number) => {
    // TODO: implement - 重试失败任务
    void taskId
  })

  // ===== 设置相关 =====
  ipcMain.handle('settings:get', async () => {
    // TODO: implement - 从数据库或配置文件读取设置
    const { DEFAULT_SETTINGS } = await import('../shared/constants')
    return DEFAULT_SETTINGS
  })

  ipcMain.handle('settings:save', async (_event, settings: Record<string, unknown>) => {
    // TODO: implement - 保存设置
    void settings
  })

  // ===== 匹配规则相关 =====
  ipcMain.handle('rules:list', async () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM match_rules ORDER BY id DESC').all()
  })

  ipcMain.handle('rules:save', async (_event, rule: Record<string, unknown>) => {
    // TODO: implement - 保存匹配规则
    void rule
  })

  // ===== 统计相关 =====
  ipcMain.handle('stats:dashboard', async () => {
    const db = getDatabase()
    const totalContent = db.prepare('SELECT COUNT(*) as count FROM content_pool').get() as { count: number }
    const totalAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number }
    const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
    const successTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'success'").get() as { count: number }

    return {
      totalContent: totalContent.count,
      totalAccounts: totalAccounts.count,
      totalTasks: totalTasks.count,
      successTasks: successTasks.count
    }
  })
}
