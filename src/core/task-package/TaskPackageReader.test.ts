import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it } from 'vitest'
import { TaskPackageReader } from './TaskPackageReader'

let tempDirs: string[] = []

function createTempPackageDir(): string {
  const packageDir = path.join(tmpdir(), `lingzhi-task-package-${randomUUID()}`)
  mkdirSync(packageDir, { recursive: true })
  tempDirs.push(packageDir)
  return packageDir
}

function writeManifest(packageDir: string, rowCount: number): void {
  writeFileSync(
    path.join(packageDir, 'manifest.json'),
    JSON.stringify({
      protocol_version: '1.0',
      batch_id: 'batch_20260627_001',
      source_app: 'lingzhi-tuwen-pro',
      created_at: '2026-06-27T10:00:00+08:00',
      default_platform: 'xiaohongshu',
      media_root: 'media',
      row_count: rowCount
    })
  )
}

function writeTasks(packageDir: string, rows: Record<string, unknown>[]): void {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks')
  XLSX.writeFile(workbook, path.join(packageDir, 'tasks.xlsx'))
}

function validPublishRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    batch_id: 'batch_20260627_001',
    draft_id: 'draft_001',
    platform: 'xiaohongshu',
    action_type: 'publish',
    blogger_id: 'blogger_a',
    account_alias: 'xhs_blogger_a_001',
    title: '灵芝水铺日常',
    content: '今天分享一杯灵芝饮。',
    tags: '灵芝,养生',
    media_folder: 'media/draft_001',
    media_type: 'image',
    require_manual_confirm: 'true',
    risk_level: 'low',
    ...overrides
  }
}

function createPackage(rows: Record<string, unknown>[], rowCount = rows.length): string {
  const packageDir = createTempPackageDir()
  writeManifest(packageDir, rowCount)
  writeTasks(packageDir, rows)
  mkdirSync(path.join(packageDir, 'media', 'draft_001'), { recursive: true })
  writeFileSync(path.join(packageDir, 'media', 'draft_001', '1.jpg'), 'fake image')
  return packageDir
}

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { recursive: true, force: true })
  }
  tempDirs = []
})

describe('TaskPackageReader', () => {
  it('reads manifest, first worksheet rows, and supported media files with absolute paths', () => {
    const packageDir = createPackage([validPublishRow()])

    const result = new TaskPackageReader().read(packageDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.packageDir).toBe(packageDir)
    expect(result.value.manifest.batch_id).toBe('batch_20260627_001')
    expect(result.value.rows).toHaveLength(1)
    expect(result.value.rows[0].tags).toEqual(['灵芝', '养生'])
    expect(result.value.mediaByDraftId.draft_001).toEqual([
      path.join(packageDir, 'media', 'draft_001', '1.jpg')
    ])
    expect(path.isAbsolute(result.value.mediaByDraftId.draft_001[0])).toBe(true)
  })

  it('uses row media_folder when it differs from media draft folder', () => {
    const packageDir = createPackage([validPublishRow({ media_folder: 'media/custom_folder' })])
    mkdirSync(path.join(packageDir, 'media', 'custom_folder'), { recursive: true })
    writeFileSync(path.join(packageDir, 'media', 'custom_folder', '1.jpg'), 'custom image')

    const result = new TaskPackageReader().read(packageDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.mediaByDraftId.draft_001).toEqual([
      path.join(packageDir, 'media', 'custom_folder', '1.jpg')
    ])
  })

  it('returns validation errors when manifest row_count does not match tasks rows', () => {
    const packageDir = createPackage([validPublishRow()], 2)

    const result = new TaskPackageReader().read(packageDir)

    expect(result).toEqual({
      ok: false,
      errors: ['row_count mismatch: manifest=2, tasks.xlsx=1']
    })
  })

  it('returns validation errors when manifest or tasks workbook is missing', () => {
    const missingBothDir = createTempPackageDir()
    const missingTasksDir = createTempPackageDir()
    writeManifest(missingTasksDir, 1)

    const missingBoth = new TaskPackageReader().read(missingBothDir)
    const missingTasks = new TaskPackageReader().read(missingTasksDir)

    expect(missingBoth).toEqual({
      ok: false,
      errors: ['manifest.json is missing', 'tasks.xlsx is missing']
    })
    expect(missingTasks).toEqual({
      ok: false,
      errors: ['tasks.xlsx is missing']
    })
  })

  it('returns validation errors for publish rows when media folder is missing or has no supported files', () => {
    const missingMediaDir = createPackage([validPublishRow({ draft_id: 'draft_missing', media_folder: 'media/draft_missing' })])
    const unsupportedMediaDir = createPackage([validPublishRow()])
    rmSync(path.join(unsupportedMediaDir, 'media', 'draft_001', '1.jpg'))
    writeFileSync(path.join(unsupportedMediaDir, 'media', 'draft_001', 'notes.txt'), 'not media')

    const missingMedia = new TaskPackageReader().read(missingMediaDir)
    const unsupportedMedia = new TaskPackageReader().read(unsupportedMediaDir)

    expect(missingMedia).toEqual({
      ok: false,
      errors: ['draft draft_missing: media folder is missing or has no supported files']
    })
    expect(unsupportedMedia).toEqual({
      ok: false,
      errors: ['draft draft_001: media folder is missing or has no supported files']
    })
    expect(existsSync(path.join(unsupportedMediaDir, 'media', 'draft_001', 'notes.txt'))).toBe(true)
  })

  it('returns validation errors when publish media folder is empty', () => {
    const packageDir = createPackage([validPublishRow()])
    rmSync(path.join(packageDir, 'media', 'draft_001', '1.jpg'))

    const result = new TaskPackageReader().read(packageDir)

    expect(result).toEqual({
      ok: false,
      errors: ['draft draft_001: media folder is missing or has no supported files']
    })
  })

  it('returns validation errors when publish media_folder points to a file', () => {
    const packageDir = createPackage([validPublishRow({ media_folder: 'media/not-a-folder.jpg' })])
    writeFileSync(path.join(packageDir, 'media', 'not-a-folder.jpg'), 'not a folder')

    const result = new TaskPackageReader().read(packageDir)

    expect(result).toEqual({
      ok: false,
      errors: ['draft draft_001: media folder is missing or has no supported files']
    })
  })

  it('rejects absolute publish media folders outside the package', () => {
    const outsideDir = createTempPackageDir()
    writeFileSync(path.join(outsideDir, '1.jpg'), 'outside image')
    const packageDir = createPackage([validPublishRow({ media_folder: outsideDir })])

    const result = new TaskPackageReader().read(packageDir)

    expect(result).toEqual({
      ok: false,
      errors: ['draft draft_001: media folder is missing or has no supported files']
    })
  })

  it('rejects relative publish media folders that escape the package', () => {
    const outsideDir = createTempPackageDir()
    writeFileSync(path.join(outsideDir, '1.jpg'), 'outside image')
    const packageDir = createPackage([validPublishRow({ media_folder: `../${path.basename(outsideDir)}` })])

    const result = new TaskPackageReader().read(packageDir)

    expect(result).toEqual({
      ok: false,
      errors: ['draft draft_001: media folder is missing or has no supported files']
    })
  })

  it('rejects publish media folders that symlink outside the package', () => {
    const outsideDir = createTempPackageDir()
    writeFileSync(path.join(outsideDir, '1.jpg'), 'outside image')
    const packageDir = createPackage([validPublishRow({ media_folder: 'media/linked' })])

    try {
      symlinkSync(outsideDir, path.join(packageDir, 'media', 'linked'), 'dir')
    } catch {
      return
    }

    const result = new TaskPackageReader().read(packageDir)

    expect(result).toEqual({
      ok: false,
      errors: ['draft draft_001: media folder is missing or has no supported files']
    })
  })

  it('returns validation errors when row batch_id does not match manifest batch_id', () => {
    const packageDir = createPackage([validPublishRow({ batch_id: 'other_batch' })])

    const result = new TaskPackageReader().read(packageDir)

    expect(result).toEqual({
      ok: false,
      errors: ['row 2: batch_id must match manifest batch_id']
    })
  })

  it('returns validation errors when draft_id is duplicated', () => {
    const packageDir = createPackage([
      validPublishRow(),
      validPublishRow({ title: '第二篇', content: '第二篇内容。' })
    ])

    const result = new TaskPackageReader().read(packageDir)

    expect(result).toEqual({
      ok: false,
      errors: ['row 3: draft_id must be unique in package']
    })
  })
})
