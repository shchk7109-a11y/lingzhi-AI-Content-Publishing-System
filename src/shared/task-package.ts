export const TASK_PACKAGE_PROTOCOL_VERSION = '1.0' as const

export const XIAOHONGSHU_ACTIONS = ['publish', 'comment', 'favorite', 'collect', 'browse'] as const

export type XiaohongshuAction = (typeof XIAOHONGSHU_ACTIONS)[number]

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

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const parsed = Number(stringValue(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function splitTags(value: unknown): string[] {
  return stringValue(value)
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseManifest(input: unknown): ParseResult<TaskPackageManifest> {
  const value = isRecord(input) ? input : {}
  const rowCount = value.row_count
  let normalizedRowCount = 0
  const errors: string[] = []

  if (value.protocol_version !== TASK_PACKAGE_PROTOCOL_VERSION) errors.push('protocol_version must be 1.0')
  if (value.source_app !== 'lingzhi-tuwen-pro') errors.push('source_app must be lingzhi-tuwen-pro')
  if (value.default_platform !== 'xiaohongshu') errors.push('default_platform must be xiaohongshu')
  if (!stringValue(value.batch_id)) errors.push('batch_id is required')
  if (!stringValue(value.created_at)) errors.push('created_at is required')
  if (!stringValue(value.media_root)) errors.push('media_root is required')
  if (typeof rowCount !== 'number' || !Number.isInteger(rowCount) || rowCount < 0) {
    errors.push('row_count must be a non-negative integer')
  } else {
    normalizedRowCount = rowCount
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      protocol_version: TASK_PACKAGE_PROTOCOL_VERSION,
      batch_id: stringValue(value.batch_id),
      source_app: 'lingzhi-tuwen-pro',
      created_at: stringValue(value.created_at),
      default_platform: 'xiaohongshu',
      media_root: stringValue(value.media_root),
      row_count: normalizedRowCount
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
  if (!XIAOHONGSHU_ACTIONS.includes(action as XiaohongshuAction)) {
    errors.push('action_type must be publish, comment, favorite, collect, or browse')
  }
  if (!['image', 'video', 'none'].includes(mediaType)) errors.push('media_type must be image, video, or none')
  if (!['low', 'medium', 'high'].includes(riskLevel)) errors.push('risk_level must be low, medium, or high')

  const requiredBaseFields = ['batch_id', 'draft_id', 'blogger_id', 'account_alias'] as const
  for (const field of requiredBaseFields) {
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
