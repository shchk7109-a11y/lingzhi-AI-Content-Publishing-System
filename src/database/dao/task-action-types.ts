export type TaskActionType = 'publish' | 'comment' | 'favorite' | 'collect' | 'browse'

export type TaskRiskLevel = 'low' | 'medium' | 'high'

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
  risk_level?: TaskRiskLevel
  audit_payload?: Record<string, unknown>
}
