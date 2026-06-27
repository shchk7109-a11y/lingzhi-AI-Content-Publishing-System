import { describe, expect, it } from 'vitest'
import { parseManifest, validateTaskRow } from './task-package'

describe('task package protocol', () => {
  it('accepts a valid manifest', () => {
    expect(
      parseManifest({
        protocol_version: '1.0',
        batch_id: 'batch_20260627_001',
        source_app: 'lingzhi-tuwen-pro',
        created_at: '2026-06-27T10:00:00+08:00',
        default_platform: 'xiaohongshu',
        media_root: 'media',
        row_count: 1
      })
    ).toEqual({
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
    if (result.ok) return
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
    if (result.ok) return
    expect(result.errors).toEqual([
      'target_note_url is required for comment tasks',
      'comment_text is required for comment tasks'
    ])
  })
})
