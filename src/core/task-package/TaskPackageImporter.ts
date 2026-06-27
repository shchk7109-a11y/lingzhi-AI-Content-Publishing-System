import { AccountDao } from '../../database/dao/AccountDao'
import { ContentDao } from '../../database/dao/ContentDao'
import { TaskDao } from '../../database/dao/TaskDao'
import type { TaskInsertData } from '../../database/dao/task-action-types'
import { getDatabase } from '../../database/db'
import type { ValidTaskPackageRow } from '../../shared/task-package'
import type { ReadTaskPackageResult } from './TaskPackageReader'

export interface TaskPackageImportSummary {
  importedContent: number
  importedTasks: number
  skippedRows: number
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
      skippedRows: 0,
      errors: []
    }

    for (const row of taskPackage.rows) {
      const account = this.accountDao.getByAlias(row.platform, row.account_alias)
      if (!account?.id) {
        summary.errors.push(`${row.draft_id}: account_alias ${row.account_alias} is not registered for ${row.platform}`)
        continue
      }

      const accountId = Number(account.id)
      if (this.taskDao.getByImportKey({
        batch_id: row.batch_id,
        draft_id: row.draft_id,
        action_type: row.action_type,
        account_id: accountId
      })) {
        summary.skippedRows += 1
        continue
      }

      try {
        const rowResult = getDatabase().transaction(() => this.importRow(row, accountId, taskPackage))()
        summary.importedContent += rowResult.importedContent
        summary.importedTasks += 1
      } catch (error) {
        summary.errors.push(`${row.draft_id}: ${this.errorMessage(error)}`)
      }
    }

    return summary
  }

  private importRow(
    row: ValidTaskPackageRow,
    accountId: number,
    taskPackage: ReadTaskPackageResult
  ): { importedContent: number } {
    if (row.action_type !== 'publish') {
      this.taskDao.insert(this.buildTask(row, accountId, null, taskPackage))
      return { importedContent: 0 }
    }

    const existingContent = this.contentDao.getByDraftId(row.draft_id)
    const contentId = existingContent?.id
      ? Number(existingContent.id)
      : this.importPublishContent(row, taskPackage)

    this.taskDao.insert(this.buildTask(row, accountId, contentId, taskPackage))
    return { importedContent: existingContent?.id ? 0 : 1 }
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
