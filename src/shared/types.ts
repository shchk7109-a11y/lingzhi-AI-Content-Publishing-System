// 内容池项
export interface ContentItem {
  id: number
  draft_id: string
  title: string
  content: string
  tags: string[]
  image_paths: string[]
  video_path: string
  platform: 'xiaohongshu' | 'douyin' | 'weixin' | 'all'
  media_type: 'image' | 'video'
  gender: 'male' | 'female' | 'all'
  age_group: 'young' | 'middle' | 'senior' | 'all'
  health_focus: 'sugar_control' | 'sleep' | 'liver' | 'fitness' | 'general'
  product_line: 'lingzhi_water' | 'lingzhi_tea' | 'lingzhi_powder' | 'all'
  status: 'pending' | 'matched' | 'published' | 'failed' | 'error'
  assign_count: number
  created_at: string
}

// 账号画像
export interface AccountPersona {
  gender: 'male' | 'female'
  age_group: 'young' | 'middle' | 'senior'
  health_focus: 'sugar_control' | 'sleep' | 'liver' | 'fitness' | 'general'
  product_line: 'lingzhi_water' | 'lingzhi_tea' | 'lingzhi_powder' | 'mixed'
}

// 账号
export interface Account {
  id: number
  nickname: string
  platform: string
  bit_profile_id: string
  customer_id: string
  persona: AccountPersona
  account_level: 'new' | 'growing' | 'mature'
  proxy_type: 'sticky' | 'pool'
  proxy_config: ProxyConfig
  region: string
  daily_limit: number
  weekly_target: number
  publish_count_week: number
  last_publish_at: string | null
  status: 'active' | 'paused' | 'banned'
}

// 代理配置
export interface ProxyConfig {
  ip: string
  port: number
  protocol: 'http' | 'https' | 'socks5'
  city: string
  username?: string
  password?: string
}

// 匹配记录
export interface MatchRecord {
  id: number
  content_id: number
  account_id: number
  match_score: number
  freshness_bonus: number
  final_priority: number
  matched_at: string
  status: 'pending' | 'confirmed' | 'published' | 'cancelled'
}

// 发布任务
export interface Task {
  id: number
  match_record_id: number
  account_id: number
  content_id: number
  platform: string
  status: 'pending' | 'queued' | 'running' | 'success' | 'failed' | 'timeout'
  priority: number
  scheduled_at: string
  started_at: string | null
  finished_at: string | null
  result_url: string | null
  error_log: string | null
  retry_count: number
  screenshot_path: string | null
  last_step: string | null
}

// 匹配规则
export interface MatchRule {
  id: number
  rule_name: string
  content_field: string
  operator: 'equals' | 'not_equals' | 'contains'
  content_value: string
  account_field: string
  account_value: string
  action: 'exclude'
  enabled: boolean
}

// 发布步骤枚举
export enum PublishStep {
  WARMUP = 'warmup',
  NAVIGATE = 'navigate',
  UPLOAD_MEDIA = 'upload_media',
  INPUT_TITLE = 'input_title',
  INPUT_CONTENT = 'input_content',
  ADD_TAGS = 'add_tags',
  PUBLISH = 'publish',
  COOLDOWN = 'cooldown'
}

// 任务状态枚举
export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

// Bit浏览器窗口信息
export interface BitBrowserWindow {
  id: string
  profileId: string
  wsEndpoint: string
  pid: number
}

// 系统设置
export interface SystemSettings {
  bitApiUrl: string
  bitApiPort: number
  bitApiToken: string
  maxConcurrency: number
  defaultProxy: ProxyConfig | null
  warmupEnabled: boolean
  warmupDurationMs: number
  publishIntervalMs: number
  retryLimit: number
  screenshotOnError: boolean
  fileServerPort: number
}

// 发布日志
export interface PublishLog {
  id: number
  task_id: number
  step: string
  action: string
  timestamp: string
  duration_ms: number
  screenshot_path: string | null
  error: string | null
}

// 代理IP
export interface ProxyItem {
  id: number
  ip: string
  port: number
  protocol: 'http' | 'https' | 'socks5'
  city: string
  provider: string
  type: 'sticky' | 'pool'
  status: 'active' | 'failed' | 'cooldown'
  last_check_at: string | null
  usage_count: number
  fail_count: number
}
