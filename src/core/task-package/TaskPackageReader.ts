import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import {
  parseManifest,
  validateTaskRow,
  type ParseResult,
  type TaskPackageManifest,
  type ValidTaskPackageRow
} from '../../shared/task-package'

export interface ReadTaskPackageResult {
  packageDir: string
  manifest: TaskPackageManifest
  rows: ValidTaskPackageRow[]
  mediaByDraftId: Record<string, string[]>
}

const SUPPORTED_MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov'])

export class TaskPackageReader {
  read(packageDir: string): ParseResult<ReadTaskPackageResult> {
    const absolutePackageDir = path.resolve(packageDir)
    const manifestPath = path.join(absolutePackageDir, 'manifest.json')
    const tasksPath = path.join(absolutePackageDir, 'tasks.xlsx')
    const errors: string[] = []

    if (!fs.existsSync(manifestPath)) errors.push('manifest.json is missing')
    if (!fs.existsSync(tasksPath)) errors.push('tasks.xlsx is missing')
    if (errors.length > 0) return { ok: false, errors }

    const manifestResult = this.readManifest(manifestPath)
    if (!manifestResult.ok) return manifestResult

    const rawRowsResult = this.readRows(tasksPath)
    if (!rawRowsResult.ok) return rawRowsResult

    const manifest = manifestResult.value
    const rawRows = rawRowsResult.value

    if (rawRows.length !== manifest.row_count) {
      errors.push(`row_count mismatch: manifest=${manifest.row_count}, tasks.xlsx=${rawRows.length}`)
    }

    const rows: ValidTaskPackageRow[] = []
    rawRows.forEach((row, index) => {
      const rowResult = validateTaskRow(row)
      if (rowResult.ok) {
        rows.push(rowResult.value)
        return
      }

      for (const error of rowResult.errors) {
        errors.push(`row ${index + 2}: ${error}`)
      }
    })

    const mediaByDraftId: Record<string, string[]> = {}
    for (const row of rows) {
      if (row.action_type !== 'publish') continue

      const mediaFiles = this.collectMediaFiles(absolutePackageDir, row.media_folder)
      if (mediaFiles.length > 0) {
        mediaByDraftId[row.draft_id] = mediaFiles
        continue
      }

      errors.push(`draft ${row.draft_id}: media folder is missing or has no supported files`)
    }

    if (errors.length > 0) return { ok: false, errors }

    return {
      ok: true,
      value: {
        packageDir: absolutePackageDir,
        manifest,
        rows,
        mediaByDraftId
      }
    }
  }

  private readManifest(manifestPath: string): ParseResult<TaskPackageManifest> {
    try {
      return parseManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')))
    } catch (error) {
      return { ok: false, errors: [`manifest.json is invalid JSON: ${this.errorMessage(error)}`] }
    }
  }

  private readRows(tasksPath: string): ParseResult<Record<string, unknown>[]> {
    try {
      const workbook = XLSX.readFile(tasksPath)
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) return { ok: false, errors: ['tasks.xlsx has no sheets'] }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
        defval: ''
      })
      return { ok: true, value: rows }
    } catch (error) {
      return { ok: false, errors: [`tasks.xlsx cannot be read: ${this.errorMessage(error)}`] }
    }
  }

  private collectMediaFiles(packageDir: string, mediaFolder: string): string[] {
    const folder = path.isAbsolute(mediaFolder) ? mediaFolder : path.resolve(packageDir, mediaFolder)

    try {
      const stat = fs.statSync(folder)
      if (!stat.isDirectory()) return []

      return fs
        .readdirSync(folder)
        .filter((fileName) => SUPPORTED_MEDIA_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
        .sort((left, right) => left.localeCompare(right))
        .map((fileName) => path.join(folder, fileName))
    } catch {
      return []
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
