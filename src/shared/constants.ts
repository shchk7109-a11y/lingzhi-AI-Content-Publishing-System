// 默认系统设置
export const DEFAULT_SETTINGS = {
  bitApiUrl: 'http://127.0.0.1',
  bitApiPort: 54400,
  bitApiToken: '',
  maxConcurrency: 3,
  defaultProxy: null,
  warmupEnabled: true,
  warmupDurationMs: 30000,
  publishIntervalMs: 60000,
  retryLimit: 3,
  screenshotOnError: true,
  fileServerPort: 19527
}

// 平台列表
export const PLATFORMS = ['xiaohongshu', 'douyin', 'weixin'] as const

// 内容状态
export const CONTENT_STATUS = {
  PENDING: 'pending',
  MATCHED: 'matched',
  PUBLISHED: 'published',
  FAILED: 'failed',
  ERROR: 'error'
} as const

// 账号等级
export const ACCOUNT_LEVELS = {
  NEW: 'new',
  GROWING: 'growing',
  MATURE: 'mature'
} as const

// 匹配评分权重
export const MATCH_WEIGHTS = {
  GENDER: 20,
  AGE_GROUP: 25,
  HEALTH_FOCUS: 30,
  PRODUCT_LINE: 25
} as const

// 每日发布限制
export const DAILY_LIMITS = {
  NEW: 1,
  GROWING: 2,
  MATURE: 5
} as const

// 发布间隔（毫秒）
export const PUBLISH_INTERVALS = {
  MIN: 30000,
  MAX: 120000
} as const

// 数据库文件名
export const DB_FILENAME = 'lingzhi-publisher.db'

// 截图目录
export const SCREENSHOT_DIR = 'screenshots'
