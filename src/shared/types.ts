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
  account_alias?: string | null
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

/**
 * 住宅代理网关配置（粘性会话模式）
 * 住宅代理不是一堆离散IP，而是"一个网关 host:port + 每账号一个稳定 session-id"。
 * 同一 session-id 在 TTL 内出口IP固定 —— 这正是"一号一IP"防限流的基础。
 */
export interface ProxyGatewayConfig {
  // 是否启用网关派生（关闭时回退到账号自带的 proxy_config）
  enabled: boolean
  host: string
  port: number
  protocol: 'http' | 'https' | 'socks5'
  // 网关基础账号密码
  username: string
  password: string
  /**
   * username 拼接模板，用占位符适配不同住宅代理供应商。
   * 支持占位符：
   *   {USER} → 基础 username
   *   {SID}  → 每账号稳定派生的 session-id
   *   {TTL}  → 会话有效期（分钟，来自 sessionTtlMinutes）
   *   {CITY} → 目标城市（来自账号 region，未配置则为空）
   * 例：青果 '{USER}-session-{SID}-time-{TTL}'
   *     BrightData 'brd-customer-xxx-zone-yyy-session-{SID}'
   */
  usernameTemplate: string
  // 粘性会话有效期（分钟），供 {TTL} 占位符与派生缓存判断使用
  sessionTtlMinutes: number
  // 出口IP校验接口（在浏览器页面内请求，校验真实出口）。留空则跳过校验。
  ipCheckUrl: string
}

/**
 * 为某账号派生出的粘性代理（可直接下发到 Bit 指纹浏览器）
 */
export interface StickyProxy {
  protocol: 'http' | 'https' | 'socks5'
  host: string
  port: number
  username: string
  password: string
  // 本次派生使用的稳定 session-id（同一账号恒定）
  sessionId: string
}

/**
 * 出口IP校验结果
 */
export interface ExitIpCheckResult {
  ok: boolean
  ip?: string
  city?: string
  // 期望城市与实际城市是否一致（未提供期望城市时为 undefined）
  cityMatched?: boolean
  error?: string
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
  match_record_id: number | null
  account_id: number
  content_id: number | null
  platform: string
  batch_id: string
  draft_id: string
  action_type: 'publish' | 'comment' | 'favorite' | 'collect' | 'browse'
  target_note_url: string
  comment_text: string
  require_manual_confirm: number | boolean
  confirmed_at: string | null
  risk_level: 'low' | 'medium' | 'high'
  audit_payload: string
  status: 'pending' | 'queued' | 'running' | 'success' | 'failed' | 'timeout'
  priority: number
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  result_url: string | null
  error_log: string | null
  retry_count: number
  screenshot_path: string | null
  last_step: string | null
  content_title?: string | null
  account_nickname?: string | null
  account_alias?: string | null
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
  maxConcurrency: number
  defaultProxy: ProxyConfig | null
  // 住宅代理网关（粘性会话）配置
  proxyGateway: ProxyGatewayConfig
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
