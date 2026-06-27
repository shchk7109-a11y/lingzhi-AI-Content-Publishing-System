import { AccountDao } from '../../database/dao/AccountDao'
import { ContentDao } from '../../database/dao/ContentDao'
import { TaskDao } from '../../database/dao/TaskDao'
import type { TaskInsertData } from '../../database/dao/task-action-types'
import type { ValidTaskPackageRow } from '../../shared/task-package'
import type { ReadTaskPackageResult } from './TaskPackageReader'

export interface TaskPackageImportSummary {
  importedContent: number
  importedTasks: number
  errors: string[]
}

interface TaskPackageImporterDeps {
  accountDao?: AccountDao
  contentDao?: ContentDao
  taskDao?: TaskDao
}

export class TaskPackageImporter {
  private readonly accountDao: AccountDao
  private readonly contentDao: ContentDao
  private readonly taskDao: TaskDao

  constructor(deps: TaskPackageImporterDeps = {}) {
    this.accountDao = deps.accountDao ?? new AccountDao()
    this.contentDao = deps.contentDao ?? new ContentDao()
    this.taskDao = deps.taskDao ?? new TaskDao()
  }

  import(taskPackage: ReadTaskPackageResult): TaskPackageImportSummary {
    const summary: TaskPackageImportSummary = {
      importedContent: 0,
      importedTasks: 0,
      errors: []
    }

    for (const row of taskPackage.rows) {
      const account = this.accountDao.getByAlias(row.platform, row.account_alias)
      if (!account?.id) {
        summary.errors.push(`${row.draft_id}: account_alias ${row.account_alias} is not registered for ${row.platform}`)
        continue
      }

      if (row.action_type === 'publish') {
        const contentId = this.importPublishContent(row, taskPackage)
        this.taskDao.insert(this.buildTask(row, Number(account.id), contentId, taskPackage))
        summary.importedContent += 1
        summary.importedTasks += 1
        continue
      }

      this.taskDao.insert(this.buildTask(row, Number(account.id), null, taskPackage))
      summary.importedTasks += 1
    }

    return summary
  }

  private importPublishContent(row: ValidTaskPackageRow, taskPackage: ReadTaskPackageResult): number {
    const mediaPaths = taskPackage.mediaByDraftId[row.draft_id] ?? []

    return this.contentDao.insert({
      draft_id: row.draft_id,
      title: row.title,
      content: row.content,
      tags: row.tags,
      image_paths: row.media_type === 'image' ? mediaPaths : [],
      video_path: row.media_type === 'video' ? mediaPaths[0] : '',
      platform: row.platform,
      media_type: row.media_type
    })
  }

  private buildTask(
    row: ValidTaskPackageRow,
    accountId: number,
    contentId: number | null,
    taskPackage: ReadTaskPackageResult
  ): TaskInsertData {
    return {
      account_id: accountId,
      content_id: contentId,
      platform: row.platform,
      priority: row.priority,
      scheduled_at: row.publish_window_start || undefined,
      batch_id: row.batch_id,
      draft_id: row.draft_id,
      action_type: row.action_type,
      target_note_url: row.target_note_url,
      comment_text: row.action_type === 'comment' ? row.comment_text : '',
      require_manual_confirm: row.require_manual_confirm,
      risk_level: row.risk_level,
      audit_payload: this.buildAuditPayload(row, taskPackage)
    }
  }

  private buildAuditPayload(row: ValidTaskPackageRow, taskPackage: ReadTaskPackageResult): Record<string, unknown> {
    return {
      blogger_id: row.blogger_id,
      remark: row.remark,
      package_dir: taskPackage.packageDir,
      media_folder: row.media_folder || undefined
    }
  }
}
