import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReadTaskPackageResult } from './TaskPackageReader'

const state = vi.hoisted(() => ({
  database: null as Database.Database | null
}))

vi.mock('../../database/db', () => ({
  getDatabase: () => {
    if (!state.database) {
      throw new Error('test database is not initialized')
    }
    return state.database
  }
}))

import { AccountDao } from '../../database/dao/AccountDao'
import { TaskPackageImporter } from './TaskPackageImporter'

function createPackage(rows: ReadTaskPackageResult['rows']): ReadTaskPackageResult {
  return {
    packageDir: '/tmp/lingzhi-task-package',
    manifest: {
      protocol_version: '1.0',
      batch_id: 'batch_20260627_001',
      source_app: 'lingzhi-tuwen-pro',
      created_at: '2026-06-27T10:00:00+08:00',
      default_platform: 'xiaohongshu',
      media_root: 'media',
      row_count: rows.length
    },
    rows,
    mediaByDraftId: {
      draft_publish_1: [
        '/tmp/lingzhi-task-package/media/draft_publish_1/01.png',
        '/tmp/lingzhi-task-package/media/draft_publish_1/02.png'
      ]
    }
  }
}

function publishRow(accountAlias = 'xhs_pub_001'): ReadTaskPackageResult['rows'][number] {
  return {
    batch_id: 'batch_20260627_001',
    draft_id: 'draft_publish_1',
    platform: 'xiaohongshu',
    action_type: 'publish',
    blogger_id: 'blogger_publish',
    account_alias: accountAlias,
    title: '灵芝水铺小红书标题',
    content: '今天分享一杯灵芝饮。',
    tags: ['灵芝水铺', '养生日常'],
    media_folder: 'media/draft_publish_1',
    media_type: 'image',
    target_note_url: '',
    comment_text: '',
    publish_window_start: '',
    publish_window_end: '',
    priority: 8,
    require_manual_confirm: true,
    risk_level: 'low',
    remark: '发布备注'
  }
}

function commentRow(accountAlias = 'xhs_interact_001'): ReadTaskPackageResult['rows'][number] {
  return {
    batch_id: 'batch_20260627_001',
    draft_id: 'draft_comment_1',
    platform: 'xiaohongshu',
    action_type: 'comment',
    blogger_id: 'blogger_comment',
    account_alias: accountAlias,
    title: '',
    content: '',
    tags: [],
    media_folder: '',
    media_type: 'none',
    target_note_url: 'https://www.xiaohongshu.com/explore/comment-target',
    comment_text: '这杯看起来很适合下午喝',
    publish_window_start: '',
    publish_window_end: '',
    priority: 3,
    require_manual_confirm: true,
    risk_level: 'medium',
    remark: '互动备注'
  }
}

function favoriteRow(accountAlias = 'xhs_interact_001'): ReadTaskPackageResult['rows'][number] {
  return {
    ...commentRow(accountAlias),
    draft_id: 'draft_favorite_1',
    action_type: 'favorite',
    comment_text: '',
    target_note_url: 'https://www.xiaohongshu.com/explore/favorite-target',
    risk_level: 'low'
  }
}

describe('TaskPackageImporter', () => {
  beforeEach(() => {
    state.database = new Database(':memory:')
    state.database.pragma('foreign_keys = ON')
    state.database.exec(fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf-8'))

    const accountDao = new AccountDao()
    accountDao.insert({
      nickname: '发布账号',
      platform: 'xiaohongshu',
      account_alias: 'xhs_pub_001'
    })
    accountDao.insert({
      nickname: '互动账号',
      platform: 'xiaohongshu',
      account_alias: 'xhs_interact_001'
    })
  })

  afterEach(() => {
    state.database?.close()
    state.database = null
  })

  it('imports mixed publish and interaction rows into content and tasks', () => {
    const result = new TaskPackageImporter().import(createPackage([publishRow(), commentRow(), favoriteRow()]))

    expect(result).toEqual({ importedContent: 1, importedTasks: 3, errors: [] })
    expect(state.database?.prepare('SELECT COUNT(*) as count FROM content_pool').get()).toMatchObject({ count: 1 })
    expect(state.database?.prepare('SELECT COUNT(*) as count FROM tasks').get()).toMatchObject({ count: 3 })

    const content = state.database?.prepare('SELECT * FROM content_pool WHERE draft_id = ?').get('draft_publish_1') as Record<string, unknown>
    expect(content).toMatchObject({
      title: '灵芝水铺小红书标题',
      content: '今天分享一杯灵芝饮。',
      platform: 'xiaohongshu',
      media_type: 'image'
    })
    expect(JSON.parse(content.tags as string)).toEqual(['灵芝水铺', '养生日常'])
    expect(JSON.parse(content.image_paths as string)).toEqual([
      '/tmp/lingzhi-task-package/media/draft_publish_1/01.png',
      '/tmp/lingzhi-task-package/media/draft_publish_1/02.png'
    ])

    const publishTask = state.database?.prepare('SELECT * FROM tasks WHERE draft_id = ?').get('draft_publish_1') as Record<string, unknown>
    expect(publishTask).toMatchObject({
      content_id: content.id,
      action_type: 'publish',
      priority: 8,
      require_manual_confirm: 1,
      risk_level: 'low'
    })

    const commentTask = state.database?.prepare('SELECT * FROM tasks WHERE draft_id = ?').get('draft_comment_1') as Record<string, unknown>
    expect(commentTask).toMatchObject({
      content_id: null,
      action_type: 'comment',
      target_note_url: 'https://www.xiaohongshu.com/explore/comment-target',
      comment_text: '这杯看起来很适合下午喝',
      require_manual_confirm: 1,
      risk_level: 'medium',
      batch_id: 'batch_20260627_001'
    })
    expect(JSON.parse(commentTask.audit_payload as string)).toMatchObject({
      blogger_id: 'blogger_comment',
      remark: '互动备注',
      package_dir: '/tmp/lingzhi-task-package'
    })
  })

  it('reports missing aliases and continues importing valid rows', () => {
    const result = new TaskPackageImporter().import(createPackage([
      publishRow(),
      commentRow('missing_alias')
    ]))

    expect(result).toEqual({
      importedContent: 1,
      importedTasks: 1,
      errors: ['draft_comment_1: account_alias missing_alias is not registered for xiaohongshu']
    })
    expect(state.database?.prepare('SELECT COUNT(*) as count FROM content_pool').get()).toMatchObject({ count: 1 })
    expect(state.database?.prepare('SELECT COUNT(*) as count FROM tasks').get()).toMatchObject({ count: 1 })
    expect(state.database?.prepare('SELECT * FROM tasks WHERE draft_id = ?').get('draft_comment_1')).toBeUndefined()
  })

  it('does not create content rows for comment tasks', () => {
    const result = new TaskPackageImporter().import(createPackage([commentRow()]))

    expect(result).toEqual({ importedContent: 0, importedTasks: 1, errors: [] })
    expect(state.database?.prepare('SELECT COUNT(*) as count FROM content_pool').get()).toMatchObject({ count: 0 })

    const task = state.database?.prepare('SELECT content_id, action_type FROM tasks WHERE draft_id = ?').get('draft_comment_1')
    expect(task).toMatchObject({ content_id: null, action_type: 'comment' })
  })
})
