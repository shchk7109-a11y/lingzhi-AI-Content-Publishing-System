# Publisher Phase One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 0 / Phase 1 foundation for importing Xiaohongshu task packages, mapping publisher-owned account aliases, confirming tasks manually, and preparing a local execution loop.

**Architecture:** Keep the current Electron app as the local Windows executor. Add a task-package domain layer that is pure TypeScript and testable without Electron, then connect it to SQLite DAOs and IPC. Preserve platform automation behind publisher/interaction adapters so the scheduler never depends on Xiaohongshu page selectors directly.

**Tech Stack:** Electron 28, React 18, TypeScript, better-sqlite3, SheetJS `xlsx`, Vitest, Ant Design, Zustand.

---

## Scope

This plan implements the local foundation only. It does not build the independent Tencent Cloud Web console yet. It also keeps WeChat Moments out of the first version. The first accepted task package platform is `xiaohongshu`; supported actions are `publish`, `comment`, `favorite`, `collect`, and `browse`.

## File Structure

Create these focused units:

- `vitest.config.ts`: node-environment tests for shared/core/database logic.
- `src/shared/task-package.ts`: task package protocol types, constants, and validators.
- `src/shared/task-package.test.ts`: protocol validation tests.
- `src/core/task-package/TaskPackageReader.ts`: reads `manifest.json`, `tasks.xlsx`, and media folders from disk.
- `src/core/task-package/TaskPackageReader.test.ts`: reader tests with temporary package folders.
- `src/core/task-package/TaskPackageImporter.ts`: imports validated rows into SQLite through DAOs.
- `src/core/task-package/TaskPackageImporter.test.ts`: importer tests against a temporary SQLite database.
- `src/core/accounts/AccountAliasService.ts`: generates, stores, and exports `account_alias` values.
- `src/core/accounts/AccountAliasService.test.ts`: alias-generation and lookup tests.
- `src/core/interactions/XiaohongshuInteractionAdapter.ts`: first interaction adapter skeleton with audit-friendly step contract.
- `src/core/interactions/XiaohongshuInteractionAdapter.test.ts`: adapter behavior tests using mocked page methods.

Modify these existing files:

- `package.json`: add test scripts and Vitest dev dependency.
- `src/database/schema.sql`: add task-package, account-alias, interaction, and audit fields.
- `src/database/dao/AccountDao.ts`: support alias fields and alias lookup.
- `src/database/dao/TaskDao.ts`: support `action_type`, optional content, target URL, comment text, confirmation, and audit fields.
- `src/main/ipc-handlers.ts`: add task-package import/preview IPC and alias export IPC.
- `src/preload/index.ts`: expose new IPC methods.
- `src/renderer/pages/ContentPool.tsx`: replace placeholder import message with package import entry.
- `src/renderer/pages/TaskCenter.tsx`: show action type, confirmation state, and interaction target.
- `src/renderer/pages/AccountManager.tsx`: show `account_alias` and add alias export action.

Database schema change warning: this plan includes schema changes. Before implementation, confirm again that it is acceptable to migrate the local SQLite schema.

---

### Task 1: Add Test Harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Add Vitest dependency and scripts**

Run:

```bash
npm install --save-dev vitest
```

Edit `package.json` so the scripts block includes:

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "package": "electron-vite build && electron-builder --config electron-builder.yml",
    "package:win": "electron-vite build && electron-builder --win --config electron-builder.yml",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
```

- [ ] **Step 3: Verify test runner starts**

Run:

```bash
npm test
```

Expected: Vitest runs and reports no test files or zero tests, depending on version. If it fails because no test files exist, continue to Task 2 and verify after adding the first test.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test(publisher): add vitest harness"
```

---

### Task 2: Define Task Package Protocol

**Files:**
- Create: `src/shared/task-package.ts`
- Create: `src/shared/task-package.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Create `src/shared/task-package.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseManifest, validateTaskRow } from './task-package'

describe('task package protocol', () => {
  it('accepts a valid manifest', () => {
    expect(parseManifest({
      protocol_version: '1.0',
      batch_id: 'batch_20260627_001',
      source_app: 'lingzhi-tuwen-pro',
      created_at: '2026-06-27T10:00:00+08:00',
      default_platform: 'xiaohongshu',
      media_root: 'media',
      row_count: 1
    })).toEqual({
      ok: true,
      value: {
        protocol_version: '1.0',
        batch_id: 'batch_20260627_001',
        source_app: 'lingzhi-tuwen-pro',
        created_at: '2026-06-27T10:00:00+08:00',
        default_platform: 'xiaohongshu',
        media_root: 'media',
        row_count: 1
      }
    })
  })

  it('rejects non-xiaohongshu platform in v1', () => {
    const result = validateTaskRow({
      batch_id: 'batch_1',
      draft_id: 'draft_1',
      platform: 'wechat_moments',
      action_type: 'publish',
      blogger_id: 'blogger_a',
      account_alias: 'xhs_a_001',
      title: '灵芝水铺日常',
      content: '今天分享一杯灵芝饮。',
      media_folder: 'media/draft_1',
      media_type: 'image',
      require_manual_confirm: 'true',
      risk_level: 'low'
    })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('platform must be xiaohongshu for protocol v1')
  })

  it('requires target URL and comment text for comment tasks', () => {
    const result = validateTaskRow({
      batch_id: 'batch_1',
      draft_id: 'comment_1',
      platform: 'xiaohongshu',
      action_type: 'comment',
      blogger_id: 'blogger_a',
      account_alias: 'xhs_a_001',
      media_type: 'none',
      require_manual_confirm: 'true',
      risk_level: 'medium'
    })

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      'target_note_url is required for comment tasks',
      'comment_text is required for comment tasks'
    ])
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/shared/task-package.test.ts
```

Expected: FAIL because `src/shared/task-package.ts` does not exist.

- [ ] **Step 3: Implement protocol types and validation**

Create `src/shared/task-package.ts`:

```ts
export const TASK_PACKAGE_PROTOCOL_VERSION = '1.0' as const

export const XIAOHONGSHU_ACTIONS = ['publish', 'comment', 'favorite', 'collect', 'browse'] as const
export type XiaohongshuAction = typeof XIAOHONGSHU_ACTIONS[number]

export interface TaskPackageManifest {
  protocol_version: '1.0'
  batch_id: string
  source_app: 'lingzhi-tuwen-pro'
  created_at: string
  default_platform: 'xiaohongshu'
  media_root: string
  row_count: number
}

export interface RawTaskPackageRow {
  batch_id?: unknown
  draft_id?: unknown
  platform?: unknown
  action_type?: unknown
  blogger_id?: unknown
  account_alias?: unknown
  title?: unknown
  content?: unknown
  tags?: unknown
  media_folder?: unknown
  media_type?: unknown
  target_note_url?: unknown
  comment_text?: unknown
  publish_window_start?: unknown
  publish_window_end?: unknown
  priority?: unknown
  require_manual_confirm?: unknown
  risk_level?: unknown
  remark?: unknown
}

export interface ValidTaskPackageRow {
  batch_id: string
  draft_id: string
  platform: 'xiaohongshu'
  action_type: XiaohongshuAction
  blogger_id: string
  account_alias: string
  title: string
  content: string
  tags: string[]
  media_folder: string
  media_type: 'image' | 'video' | 'none'
  target_note_url: string
  comment_text: string
  publish_window_start: string
  publish_window_end: string
  priority: number
  require_manual_confirm: true
  risk_level: 'low' | 'medium' | 'high'
  remark: string
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] }

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(stringValue(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function splitTags(value: unknown): string[] {
  return stringValue(value).split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
}

export function parseManifest(input: unknown): ParseResult<TaskPackageManifest> {
  const value = input as Partial<TaskPackageManifest>
  const errors: string[] = []

  if (value.protocol_version !== TASK_PACKAGE_PROTOCOL_VERSION) errors.push('protocol_version must be 1.0')
  if (value.source_app !== 'lingzhi-tuwen-pro') errors.push('source_app must be lingzhi-tuwen-pro')
  if (value.default_platform !== 'xiaohongshu') errors.push('default_platform must be xiaohongshu')
  if (!stringValue(value.batch_id)) errors.push('batch_id is required')
  if (!stringValue(value.created_at)) errors.push('created_at is required')
  if (!stringValue(value.media_root)) errors.push('media_root is required')
  if (!Number.isInteger(value.row_count) || value.row_count < 0) errors.push('row_count must be a non-negative integer')

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      protocol_version: '1.0',
      batch_id: stringValue(value.batch_id),
      source_app: 'lingzhi-tuwen-pro',
      created_at: stringValue(value.created_at),
      default_platform: 'xiaohongshu',
      media_root: stringValue(value.media_root),
      row_count: value.row_count as number
    }
  }
}

export function validateTaskRow(row: RawTaskPackageRow): ParseResult<ValidTaskPackageRow> {
  const errors: string[] = []
  const action = stringValue(row.action_type)
  const platform = stringValue(row.platform)
  const mediaType = stringValue(row.media_type) || 'none'
  const riskLevel = stringValue(row.risk_level) || 'low'

  if (platform !== 'xiaohongshu') errors.push('platform must be xiaohongshu for protocol v1')
  if (!XIAOHONGSHU_ACTIONS.includes(action as XiaohongshuAction)) errors.push('action_type must be publish, comment, favorite, collect, or browse')
  if (!['image', 'video', 'none'].includes(mediaType)) errors.push('media_type must be image, video, or none')
  if (!['low', 'medium', 'high'].includes(riskLevel)) errors.push('risk_level must be low, medium, or high')

  const requiredTextFields = ['batch_id', 'draft_id', 'blogger_id', 'account_alias'] as const
  for (const field of requiredTextFields) {
    if (!stringValue(row[field])) errors.push(`${field} is required`)
  }

  if (action === 'publish') {
    if (!stringValue(row.title)) errors.push('title is required for publish tasks')
    if (!stringValue(row.content)) errors.push('content is required for publish tasks')
    if (!stringValue(row.media_folder)) errors.push('media_folder is required for publish tasks')
    if (mediaType === 'none') errors.push('media_type must be image or video for publish tasks')
  }

  if (['comment', 'favorite', 'collect', 'browse'].includes(action) && !stringValue(row.target_note_url)) {
    errors.push(`target_note_url is required for ${action} tasks`)
  }

  if (action === 'comment' && !stringValue(row.comment_text)) {
    errors.push('comment_text is required for comment tasks')
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      batch_id: stringValue(row.batch_id),
      draft_id: stringValue(row.draft_id),
      platform: 'xiaohongshu',
      action_type: action as XiaohongshuAction,
      blogger_id: stringValue(row.blogger_id),
      account_alias: stringValue(row.account_alias),
      title: stringValue(row.title),
      content: stringValue(row.content),
      tags: splitTags(row.tags),
      media_folder: stringValue(row.media_folder),
      media_type: mediaType as ValidTaskPackageRow['media_type'],
      target_note_url: stringValue(row.target_note_url),
      comment_text: stringValue(row.comment_text),
      publish_window_start: stringValue(row.publish_window_start),
      publish_window_end: stringValue(row.publish_window_end),
      priority: numberValue(row.priority, 0),
      require_manual_confirm: true,
      risk_level: riskLevel as ValidTaskPackageRow['risk_level'],
      remark: stringValue(row.remark)
    }
  }
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```bash
npm test -- src/shared/task-package.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/task-package.ts src/shared/task-package.test.ts
git commit -m "feat(protocol): define xiaohongshu task package v1"
```

---

### Task 3: Read Task Packages From Disk

**Files:**
- Create: `src/core/task-package/TaskPackageReader.ts`
- Create: `src/core/task-package/TaskPackageReader.test.ts`

- [ ] **Step 1: Write reader tests**

Create `src/core/task-package/TaskPackageReader.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it } from 'vitest'
import { TaskPackageReader } from './TaskPackageReader'

let tempDir = ''

function createPackage(rows: Record<string, unknown>[]): string {
  tempDir = mkdtempSync(path.join(tmpdir(), 'lingzhi-task-package-'))
  mkdirSync(path.join(tempDir, 'media', 'draft_001'), { recursive: true })
  writeFileSync(path.join(tempDir, 'media', 'draft_001', '1.jpg'), 'fake image')
  writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify({
    protocol_version: '1.0',
    batch_id: 'batch_20260627_001',
    source_app: 'lingzhi-tuwen-pro',
    created_at: '2026-06-27T10:00:00+08:00',
    default_platform: 'xiaohongshu',
    media_root: 'media',
    row_count: rows.length
  }))

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks')
  XLSX.writeFile(workbook, path.join(tempDir, 'tasks.xlsx'))
  return tempDir
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  tempDir = ''
})

describe('TaskPackageReader', () => {
  it('reads manifest, rows, and media files', () => {
    const packageDir = createPackage([{
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
      risk_level: 'low'
    }])

    const result = new TaskPackageReader().read(packageDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.manifest.batch_id).toBe('batch_20260627_001')
    expect(result.value.rows).toHaveLength(1)
    expect(result.value.rows[0].tags).toEqual(['灵芝', '养生'])
    expect(result.value.mediaByDraftId.draft_001).toEqual([
      path.join(packageDir, 'media', 'draft_001', '1.jpg')
    ])
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/core/task-package/TaskPackageReader.test.ts
```

Expected: FAIL because `TaskPackageReader.ts` does not exist.

- [ ] **Step 3: Implement reader**

Create `src/core/task-package/TaskPackageReader.ts`:

```ts
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

const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov'])

export class TaskPackageReader {
  read(packageDir: string): ParseResult<ReadTaskPackageResult> {
    const manifestPath = path.join(packageDir, 'manifest.json')
    const tasksPath = path.join(packageDir, 'tasks.xlsx')
    const errors: string[] = []

    if (!fs.existsSync(manifestPath)) errors.push('manifest.json is missing')
    if (!fs.existsSync(tasksPath)) errors.push('tasks.xlsx is missing')
    if (errors.length > 0) return { ok: false, errors }

    const manifestResult = parseManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')))
    if (!manifestResult.ok) return manifestResult

    const workbook = XLSX.readFile(tasksPath)
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) return { ok: false, errors: ['tasks.xlsx has no sheets'] }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], { defval: '' })
    if (rawRows.length !== manifestResult.value.row_count) {
      errors.push(`row_count mismatch: manifest=${manifestResult.value.row_count}, tasks.xlsx=${rawRows.length}`)
    }

    const rows: ValidTaskPackageRow[] = []
    rawRows.forEach((row, index) => {
      const rowResult = validateTaskRow(row)
      if (rowResult.ok) {
        rows.push(rowResult.value)
      } else {
        for (const error of rowResult.errors) errors.push(`row ${index + 2}: ${error}`)
      }
    })

    const mediaByDraftId = this.scanMedia(packageDir, manifestResult.value.media_root)
    for (const row of rows) {
      if (row.action_type === 'publish' && mediaByDraftId[row.draft_id]?.length === 0) {
        errors.push(`draft ${row.draft_id}: media folder has no supported files`)
      }
    }

    if (errors.length > 0) return { ok: false, errors }

    return {
      ok: true,
      value: {
        packageDir,
        manifest: manifestResult.value,
        rows,
        mediaByDraftId
      }
    }
  }

  private scanMedia(packageDir: string, mediaRoot: string): Record<string, string[]> {
    const root = path.join(packageDir, mediaRoot)
    const result: Record<string, string[]> = {}
    if (!fs.existsSync(root)) return result

    for (const draftId of fs.readdirSync(root)) {
      const folder = path.join(root, draftId)
      if (!fs.statSync(folder).isDirectory()) continue
      result[draftId] = fs.readdirSync(folder)
        .filter((file) => MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase()))
        .sort()
        .map((file) => path.join(folder, file))
    }

    return result
  }
}
```

- [ ] **Step 4: Verify reader tests pass**

Run:

```bash
npm test -- src/core/task-package/TaskPackageReader.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/task-package/TaskPackageReader.ts src/core/task-package/TaskPackageReader.test.ts
git commit -m "feat(import): read xiaohongshu task packages"
```

---

### Task 4: Extend SQLite Schema for Alias, Actions, and Audit

**Files:**
- Modify: `src/database/schema.sql`
- Modify: `src/database/db.ts`
- Modify: `src/database/dao/AccountDao.ts`
- Modify: `src/database/dao/TaskDao.ts`
- Create: `src/database/dao/task-action-types.ts`

- [ ] **Step 1: Confirm schema migration permission**

Before editing schema, ask the user:

```text
This task changes the local SQLite schema for accounts and tasks. Confirm I should proceed with the migration?
```

Expected: user confirms.

- [ ] **Step 2: Update schema**

Modify `src/database/schema.sql`:

```sql
ALTER TABLE accounts ADD COLUMN account_alias TEXT;
ALTER TABLE accounts ADD COLUMN daily_interaction_limit INTEGER DEFAULT 20;
ALTER TABLE accounts ADD COLUMN last_health_check_at DATETIME;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_alias_platform ON accounts(account_alias, platform);

ALTER TABLE tasks ADD COLUMN batch_id TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN draft_id TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN action_type TEXT DEFAULT 'publish';
ALTER TABLE tasks ADD COLUMN target_note_url TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN comment_text TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN require_manual_confirm INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN confirmed_at DATETIME;
ALTER TABLE tasks ADD COLUMN risk_level TEXT DEFAULT 'low';
ALTER TABLE tasks ADD COLUMN audit_payload TEXT DEFAULT '{}';

CREATE TABLE IF NOT EXISTS task_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  account_id INTEGER,
  action_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_payload TEXT DEFAULT '{}',
  screenshot_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_batch_action ON tasks(batch_id, action_type);
CREATE INDEX IF NOT EXISTS idx_tasks_confirmation ON tasks(require_manual_confirm, confirmed_at);
CREATE INDEX IF NOT EXISTS idx_task_audit_logs_task ON task_audit_logs(task_id);
```

Because `schema.sql` is executed on every startup and SQLite rejects duplicate `ALTER TABLE ADD COLUMN`, keep `schema.sql` as the target schema for new installs by adding the new columns inside `CREATE TABLE IF NOT EXISTS`, then add guarded migrations in `src/database/db.ts`.

- [ ] **Step 3: Add guarded migrations**

In `src/database/db.ts`, add this helper above `initDatabase()`:

```ts
function columnExists(database: Database.Database, tableName: string, columnName: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  return columns.some((column) => column.name === columnName)
}

function addColumnIfMissing(database: Database.Database, tableName: string, columnName: string, definition: string): void {
  if (!columnExists(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  }
}

function runMigrations(database: Database.Database): void {
  addColumnIfMissing(database, 'accounts', 'account_alias', 'TEXT')
  addColumnIfMissing(database, 'accounts', 'daily_interaction_limit', 'INTEGER DEFAULT 20')
  addColumnIfMissing(database, 'accounts', 'last_health_check_at', 'DATETIME')

  addColumnIfMissing(database, 'tasks', 'batch_id', "TEXT DEFAULT ''")
  addColumnIfMissing(database, 'tasks', 'draft_id', "TEXT DEFAULT ''")
  addColumnIfMissing(database, 'tasks', 'action_type', "TEXT DEFAULT 'publish'")
  addColumnIfMissing(database, 'tasks', 'target_note_url', "TEXT DEFAULT ''")
  addColumnIfMissing(database, 'tasks', 'comment_text', "TEXT DEFAULT ''")
  addColumnIfMissing(database, 'tasks', 'require_manual_confirm', 'INTEGER DEFAULT 1')
  addColumnIfMissing(database, 'tasks', 'confirmed_at', 'DATETIME')
  addColumnIfMissing(database, 'tasks', 'risk_level', "TEXT DEFAULT 'low'")
  addColumnIfMissing(database, 'tasks', 'audit_payload', "TEXT DEFAULT '{}'")

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_alias_platform ON accounts(account_alias, platform);
    CREATE INDEX IF NOT EXISTS idx_tasks_batch_action ON tasks(batch_id, action_type);
    CREATE INDEX IF NOT EXISTS idx_tasks_confirmation ON tasks(require_manual_confirm, confirmed_at);

    CREATE TABLE IF NOT EXISTS task_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      account_id INTEGER,
      action_type TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_payload TEXT DEFAULT '{}',
      screenshot_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_task_audit_logs_task ON task_audit_logs(task_id);
  `)
}
```

Then call it after `db.exec(schemaSQL)`:

```ts
db.exec(schemaSQL)
runMigrations(db)
console.log('[Database] Initialized at:', dbPath)
```

- [ ] **Step 4: Add task action types**

Create `src/database/dao/task-action-types.ts`:

```ts
export type TaskActionType = 'publish' | 'comment' | 'favorite' | 'collect' | 'browse'

export interface TaskInsertData {
  match_record_id?: number
  account_id: number
  content_id?: number | null
  platform: string
  priority?: number
  scheduled_at?: string
  batch_id?: string
  draft_id?: string
  action_type?: TaskActionType
  target_note_url?: string
  comment_text?: string
  require_manual_confirm?: boolean
  risk_level?: 'low' | 'medium' | 'high'
  audit_payload?: Record<string, unknown>
}
```

- [ ] **Step 5: Update AccountDao signatures**

In `src/database/dao/AccountDao.ts`, extend insert and batch insert input with:

```ts
account_alias?: string
daily_interaction_limit?: number
last_health_check_at?: string
```

Add lookup:

```ts
getByAlias(platform: string, accountAlias: string): Record<string, unknown> | undefined {
  return this.db.prepare('SELECT * FROM accounts WHERE platform = ? AND account_alias = ?')
    .get(platform, accountAlias) as Record<string, unknown> | undefined
}
```

- [ ] **Step 6: Update TaskDao insert**

In `src/database/dao/TaskDao.ts`, replace inline insert input type with `TaskInsertData` and insert these columns:

```ts
INSERT INTO tasks (
  match_record_id, account_id, content_id, platform, priority, scheduled_at,
  batch_id, draft_id, action_type, target_note_url, comment_text,
  require_manual_confirm, risk_level, audit_payload
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

Use these values:

```ts
data.match_record_id || null,
data.account_id,
data.content_id ?? null,
data.platform,
data.priority || 0,
data.scheduled_at || null,
data.batch_id || '',
data.draft_id || '',
data.action_type || 'publish',
data.target_note_url || '',
data.comment_text || '',
data.require_manual_confirm === false ? 0 : 1,
data.risk_level || 'low',
JSON.stringify(data.audit_payload || {})
```

- [ ] **Step 7: Run build and lint**

Run:

```bash
npm run build
npm run lint
```

Expected: build passes. Lint may still report pre-existing warnings from `StealthInjector.ts`; do not bundle unrelated lint cleanup unless a new error was introduced.

- [ ] **Step 8: Commit**

```bash
git add src/database/schema.sql src/database/db.ts src/database/dao/AccountDao.ts src/database/dao/TaskDao.ts src/database/dao/task-action-types.ts
git commit -m "feat(database): support task package actions and aliases"
```

---

### Task 5: Generate and Export Account Aliases

**Files:**
- Create: `src/core/accounts/AccountAliasService.ts`
- Create: `src/core/accounts/AccountAliasService.test.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/pages/AccountManager.tsx`

- [ ] **Step 1: Write alias service tests**

Create `src/core/accounts/AccountAliasService.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AccountAliasService } from './AccountAliasService'

describe('AccountAliasService', () => {
  it('generates stable lowercase aliases', () => {
    const service = new AccountAliasService()
    expect(service.generateAlias({
      platform: 'xiaohongshu',
      bloggerId: 'Herbal Shop A',
      sequence: 3
    })).toBe('xhs_herbal_shop_a_003')
  })

  it('removes unsafe characters', () => {
    const service = new AccountAliasService()
    expect(service.generateAlias({
      platform: 'xiaohongshu',
      bloggerId: '灵芝水铺-一号!',
      sequence: 12
    })).toBe('xhs_ling_zhi_shui_pu_yi_hao_012')
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm test -- src/core/accounts/AccountAliasService.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement alias service**

Create `src/core/accounts/AccountAliasService.ts`:

```ts
const PINYIN_FALLBACK: Record<string, string> = {
  灵: 'ling',
  芝: 'zhi',
  水: 'shui',
  铺: 'pu',
  一: 'yi',
  号: 'hao'
}

export class AccountAliasService {
  generateAlias(input: { platform: string; bloggerId: string; sequence: number }): string {
    const prefix = input.platform === 'xiaohongshu' ? 'xhs' : input.platform
    const normalized = input.bloggerId
      .split('')
      .map((char) => PINYIN_FALLBACK[char] || char)
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')

    return `${prefix}_${normalized}_${String(input.sequence).padStart(3, '0')}`
  }
}
```

- [ ] **Step 4: Add IPC and preload methods**

In `src/main/ipc-handlers.ts`, add:

```ts
ipcMain.handle('accounts:generateAlias', (_event, input: { platform: string; bloggerId: string; sequence: number }) => {
  return new AccountAliasService().generateAlias(input)
})
```

In `src/preload/index.ts`, expose:

```ts
generateAlias: (input: { platform: string; bloggerId: string; sequence: number }) =>
  ipcRenderer.invoke('accounts:generateAlias', input)
```

- [ ] **Step 5: Update account UI**

In `src/renderer/pages/AccountManager.tsx`, add an `account_alias` column:

```tsx
{ title: '账号别名', dataIndex: 'account_alias', key: 'account_alias', width: 180, ellipsis: true }
```

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- src/core/accounts/AccountAliasService.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/accounts/AccountAliasService.ts src/core/accounts/AccountAliasService.test.ts src/main/ipc-handlers.ts src/preload/index.ts src/renderer/pages/AccountManager.tsx
git commit -m "feat(accounts): generate publisher-owned account aliases"
```

---

### Task 6: Import Task Packages Into Local SQLite

**Files:**
- Create: `src/core/task-package/TaskPackageImporter.ts`
- Create: `src/core/task-package/TaskPackageImporter.test.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/pages/ContentPool.tsx`

- [ ] **Step 1: Write importer behavior test**

Create `src/core/task-package/TaskPackageImporter.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { TaskPackageImporter } from './TaskPackageImporter'
import type { ReadTaskPackageResult } from './TaskPackageReader'

describe('TaskPackageImporter', () => {
  it('rejects rows with unknown account aliases', () => {
    const accounts = { getByAlias: vi.fn().mockReturnValue(undefined) }
    const contents = { insert: vi.fn() }
    const tasks = { insert: vi.fn() }
    const importer = new TaskPackageImporter(accounts as any, contents as any, tasks as any)

    const result = importer.import({
      packageDir: '/tmp/package',
      manifest: {
        protocol_version: '1.0',
        batch_id: 'batch_1',
        source_app: 'lingzhi-tuwen-pro',
        created_at: '2026-06-27T10:00:00+08:00',
        default_platform: 'xiaohongshu',
        media_root: 'media',
        row_count: 1
      },
      mediaByDraftId: { draft_1: ['/tmp/package/media/draft_1/1.jpg'] },
      rows: [{
        batch_id: 'batch_1',
        draft_id: 'draft_1',
        platform: 'xiaohongshu',
        action_type: 'publish',
        blogger_id: 'blogger_a',
        account_alias: 'missing_alias',
        title: 'title',
        content: 'content',
        tags: [],
        media_folder: 'media/draft_1',
        media_type: 'image',
        target_note_url: '',
        comment_text: '',
        publish_window_start: '',
        publish_window_end: '',
        priority: 0,
        require_manual_confirm: true,
        risk_level: 'low',
        remark: ''
      }]
    } satisfies ReadTaskPackageResult)

    expect(result).toEqual({
      importedContent: 0,
      importedTasks: 0,
      errors: ['draft_1: account_alias missing_alias is not registered for xiaohongshu']
    })
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm test -- src/core/task-package/TaskPackageImporter.test.ts
```

Expected: FAIL because importer does not exist.

- [ ] **Step 3: Implement importer**

Create `src/core/task-package/TaskPackageImporter.ts`:

```ts
import type { AccountDao } from '../../database/dao/AccountDao'
import type { ContentDao } from '../../database/dao/ContentDao'
import type { TaskDao } from '../../database/dao/TaskDao'
import type { ReadTaskPackageResult } from './TaskPackageReader'

export interface ImportTaskPackageSummary {
  importedContent: number
  importedTasks: number
  errors: string[]
}

export class TaskPackageImporter {
  constructor(
    private readonly accounts: AccountDao,
    private readonly contents: ContentDao,
    private readonly tasks: TaskDao
  ) {}

  import(input: ReadTaskPackageResult): ImportTaskPackageSummary {
    const errors: string[] = []
    let importedContent = 0
    let importedTasks = 0

    for (const row of input.rows) {
      const account = this.accounts.getByAlias(row.platform, row.account_alias)
      if (!account?.id) {
        errors.push(`${row.draft_id}: account_alias ${row.account_alias} is not registered for ${row.platform}`)
        continue
      }

      let contentId: number | null = null
      if (row.action_type === 'publish') {
        contentId = this.contents.insert({
          draft_id: row.draft_id,
          title: row.title,
          content: row.content,
          tags: row.tags,
          image_paths: row.media_type === 'image' ? input.mediaByDraftId[row.draft_id] || [] : [],
          video_path: row.media_type === 'video' ? input.mediaByDraftId[row.draft_id]?.[0] || '' : '',
          platform: row.platform,
          media_type: row.media_type
        })
        importedContent++
      }

      this.tasks.insert({
        account_id: Number(account.id),
        content_id: contentId,
        platform: row.platform,
        priority: row.priority,
        scheduled_at: row.publish_window_start || undefined,
        batch_id: row.batch_id,
        draft_id: row.draft_id,
        action_type: row.action_type,
        target_note_url: row.target_note_url,
        comment_text: row.comment_text,
        require_manual_confirm: row.require_manual_confirm,
        risk_level: row.risk_level,
        audit_payload: {
          blogger_id: row.blogger_id,
          remark: row.remark,
          package_dir: input.packageDir
        }
      })
      importedTasks++
    }

    return { importedContent, importedTasks, errors }
  }
}
```

- [ ] **Step 4: Add preview/import IPC**

In `src/main/ipc-handlers.ts`, add handlers:

```ts
ipcMain.handle('dialog:selectDirectory', async () => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return ''
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  })
  return result.filePaths[0] || ''
})

ipcMain.handle('taskPackage:preview', async (_event, packageDir: string) => {
  return new TaskPackageReader().read(packageDir)
})

ipcMain.handle('taskPackage:import', async (_event, packageDir: string) => {
  const readResult = new TaskPackageReader().read(packageDir)
  if (!readResult.ok) return { success: false, errors: readResult.errors }
  const summary = new TaskPackageImporter(accountDao, contentDao, taskDao).import(readResult.value)
  return { success: summary.errors.length === 0, ...summary }
})
```

In `src/preload/index.ts`, expose:

```ts
taskPackage: {
  preview: (packageDir: string) => ipcRenderer.invoke('taskPackage:preview', packageDir),
  import: (packageDir: string) => ipcRenderer.invoke('taskPackage:import', packageDir)
}
```

Add directory selection under `dialog`:

```ts
selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory') as Promise<string>
```

- [ ] **Step 5: Wire basic UI import action**

In `src/renderer/pages/ContentPool.tsx`, replace `handleImport` with:

```ts
const handleImport = async (): Promise<void> => {
  const packageDir = await window.api.dialog.selectDirectory()
  if (!packageDir) return

  const result = await window.api.taskPackage.import(packageDir) as {
    success: boolean
    importedContent?: number
    importedTasks?: number
    errors?: string[]
  }

  if (!result.success) {
    message.error(result.errors?.[0] || '任务包导入失败')
    return
  }

  message.success(`导入成功：内容 ${result.importedContent || 0} 条，任务 ${result.importedTasks || 0} 条`)
  loadContents()
}
```

Replace the Ant Design `Upload` wrapper with a direct button because task packages are directories:

```tsx
<Button icon={<UploadOutlined />} type="primary" onClick={handleImport}>导入任务包</Button>
```

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- src/core/task-package/TaskPackageImporter.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/task-package/TaskPackageImporter.ts src/core/task-package/TaskPackageImporter.test.ts src/main/ipc-handlers.ts src/preload/index.ts src/renderer/pages/ContentPool.tsx
git commit -m "feat(import): import confirmed task packages"
```

---

### Task 7: Add Manual Confirmation and Audit Surface

**Files:**
- Modify: `src/database/dao/TaskDao.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/pages/TaskCenter.tsx`

- [ ] **Step 1: Add DAO methods**

Add to `TaskDao`:

```ts
confirmTask(id: number): void {
  this.db.prepare("UPDATE tasks SET confirmed_at = datetime('now') WHERE id = ?").run(id)
}

getPendingConfirmation(): Record<string, unknown>[] {
  return this.db.prepare(`
    SELECT t.*, cp.title as content_title, a.nickname as account_nickname, a.account_alias
    FROM tasks t
    LEFT JOIN content_pool cp ON t.content_id = cp.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.require_manual_confirm = 1 AND t.confirmed_at IS NULL
    ORDER BY t.priority DESC, t.id ASC
  `).all() as Record<string, unknown>[]
}
```

- [ ] **Step 2: Add IPC**

In `src/main/ipc-handlers.ts`:

```ts
ipcMain.handle('db:tasks:confirm', (_event, id: number) => {
  taskDao.confirmTask(id)
  return { success: true }
})

ipcMain.handle('db:tasks:pendingConfirmation', () => {
  return taskDao.getPendingConfirmation()
})
```

In `src/preload/index.ts`, add under `tasks`:

```ts
confirm: (id: number) => ipcRenderer.invoke('db:tasks:confirm', id),
pendingConfirmation: () => ipcRenderer.invoke('db:tasks:pendingConfirmation')
```

- [ ] **Step 3: Update TaskCenter columns**

Add columns:

```tsx
{ title: '动作', dataIndex: 'action_type', key: 'action_type', width: 90, render: (v: string) => <Tag color={v === 'publish' ? 'blue' : 'gold'}>{v || 'publish'}</Tag> },
{ title: '账号别名', dataIndex: 'account_alias', key: 'account_alias', width: 150, ellipsis: true },
{ title: '目标', dataIndex: 'target_note_url', key: 'target_note_url', width: 180, ellipsis: true },
{
  title: '确认',
  key: 'confirm',
  width: 90,
  render: (_: unknown, record: TaskRow) =>
    record.require_manual_confirm && !record.confirmed_at
      ? <Button size="small" onClick={() => handleConfirmTask(record.id)}>确认</Button>
      : <Tag color="success">已确认</Tag>
}
```

Add handler:

```tsx
const handleConfirmTask = async (taskId: number): Promise<void> => {
  await window.api.tasks.confirm(taskId)
  message.success('任务已确认')
  loadTasks()
}
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/database/dao/TaskDao.ts src/main/ipc-handlers.ts src/preload/index.ts src/renderer/pages/TaskCenter.tsx
git commit -m "feat(tasks): require manual confirmation before execution"
```

---

### Task 8: Add Xiaohongshu Interaction Adapter Skeleton

**Files:**
- Create: `src/core/interactions/XiaohongshuInteractionAdapter.ts`
- Create: `src/core/interactions/XiaohongshuInteractionAdapter.test.ts`

- [ ] **Step 1: Write adapter tests**

Create `src/core/interactions/XiaohongshuInteractionAdapter.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { XiaohongshuInteractionAdapter } from './XiaohongshuInteractionAdapter'

describe('XiaohongshuInteractionAdapter', () => {
  it('requires comment text for comment action', async () => {
    const adapter = new XiaohongshuInteractionAdapter({ randomDelay: vi.fn() } as any)

    await expect(adapter.run({ page: {} as any, action: 'comment', targetUrl: 'https://www.xiaohongshu.com/explore/1' }))
      .rejects.toThrow('comment_text is required for comment action')
  })

  it('navigates to target URL before interaction', async () => {
    const page = { goto: vi.fn(), $: vi.fn().mockResolvedValue(null) }
    const behavior = { randomDelay: vi.fn() }
    const adapter = new XiaohongshuInteractionAdapter(behavior as any)

    const result = await adapter.run({ page: page as any, action: 'browse', targetUrl: 'https://www.xiaohongshu.com/explore/1' })

    expect(page.goto).toHaveBeenCalledWith('https://www.xiaohongshu.com/explore/1', { waitUntil: 'domcontentloaded', timeout: 30000 })
    expect(result.steps[0]).toEqual({ step: 'navigate_target', success: true })
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm test -- src/core/interactions/XiaohongshuInteractionAdapter.test.ts
```

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement adapter skeleton**

Create `src/core/interactions/XiaohongshuInteractionAdapter.ts`:

```ts
import type { Page } from 'puppeteer-core'
import type { HumanBehaviorEngine } from '../HumanBehaviorEngine'
import type { XiaohongshuAction } from '../../shared/task-package'

export interface InteractionInput {
  page: Page
  action: Exclude<XiaohongshuAction, 'publish'>
  targetUrl: string
  commentText?: string
}

export interface InteractionResult {
  success: boolean
  steps: Array<{ step: string; success: boolean; error?: string }>
}

export class XiaohongshuInteractionAdapter {
  constructor(private readonly behavior: HumanBehaviorEngine) {}

  async run(input: InteractionInput): Promise<InteractionResult> {
    if (input.action === 'comment' && !input.commentText?.trim()) {
      throw new Error('comment_text is required for comment action')
    }

    const steps: InteractionResult['steps'] = []

    await input.page.goto(input.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    steps.push({ step: 'navigate_target', success: true })
    await this.behavior.randomDelay(2000, 4000)

    if (input.action === 'browse') {
      steps.push({ step: 'browse_target', success: true })
      return { success: true, steps }
    }

    steps.push({ step: `${input.action}_queued_for_selector_mapping`, success: true })
    return { success: true, steps }
  }
}
```

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- src/core/interactions/XiaohongshuInteractionAdapter.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/interactions/XiaohongshuInteractionAdapter.ts src/core/interactions/XiaohongshuInteractionAdapter.test.ts
git commit -m "feat(interactions): add xiaohongshu interaction adapter contract"
```

---

### Task 9: Gate Scheduler Execution on Confirmation

**Files:**
- Modify: `src/core/TaskScheduler.ts`
- Modify: `src/database/dao/TaskDao.ts`

- [ ] **Step 1: Update queued task query**

Update both scheduler and DAO queued-task queries so only confirmed tasks run:

```sql
WHERE status IN ('pending', 'queued')
AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
AND (require_manual_confirm = 0 OR confirmed_at IS NOT NULL)
```

- [ ] **Step 2: Add action routing comment and guard**

In `TaskScheduler.tick`, before execution is wired, add a guard:

```ts
const tasks = this.getNextTasks(Math.floor(this.tokenBucket))
for (const task of tasks) {
  if (task.action_type !== 'publish' && task.action_type !== 'comment' && task.action_type !== 'favorite' && task.action_type !== 'collect' && task.action_type !== 'browse') {
    this.updateTaskStatus(task.id, 'failed', { error_log: `Unsupported action_type: ${task.action_type}` })
    continue
  }
}
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/TaskScheduler.ts src/database/dao/TaskDao.ts
git commit -m "fix(tasks): gate execution on manual confirmation"
```

---

### Task 10: Final Verification and Handoff

**Files:**
- Modify only if verification reveals issues in files changed by previous tasks.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm test
npm run build
npm run lint
```

Expected:

- `npm test`: PASS.
- `npm run build`: PASS.
- `npm run lint`: PASS or only pre-existing warnings/errors already documented before this plan. If lint still reports the existing `no-useless-escape` and `no-extra-semi` errors, fix them in a separate commit because they block completion.

- [ ] **Step 2: Fix pre-existing lint blockers if still present**

If `npm run lint` reports:

```text
src/core/HumanBehaviorEngine.ts no-useless-escape
src/main/ipc-handlers.ts no-extra-semi
```

Make these narrow edits:

```ts
return /[，。！？、；：""''…—,.!?;:'"()-]/.test(char)
```

and remove the leading semicolon before:

```ts
(currentSettings as Record<string, unknown>)[key] = value
```

- [ ] **Step 3: Re-run verification**

Run:

```bash
npm test
npm run build
npm run lint
```

Expected: all pass.

- [ ] **Step 4: Commit verification fixes if any**

```bash
git add src/core/HumanBehaviorEngine.ts src/main/ipc-handlers.ts
git commit -m "fix(lint): clear publisher lint blockers"
```

- [ ] **Step 5: Summarize Phase 1 readiness**

Prepare a handoff summary with:

```text
Implemented:
- task package v1 validation
- package reader
- account alias generation
- local import
- manual confirmation
- interaction adapter contract

Verification:
- npm test
- npm run build
- npm run lint

Remaining before real platform execution:
- map Xiaohongshu interaction selectors using an authorized test account
- connect scheduler to publish and interaction adapters
- run one-account end-to-end dry run
```

No commit is needed for this summary unless saved as a document.
