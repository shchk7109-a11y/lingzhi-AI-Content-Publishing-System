-- 灵芝水铺发布系统数据库 Schema v3.0

-- 1. 内容池
CREATE TABLE IF NOT EXISTS content_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  image_paths TEXT DEFAULT '[]',
  video_path TEXT DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'all',
  media_type TEXT NOT NULL DEFAULT 'image',
  gender TEXT DEFAULT 'all',
  age_group TEXT DEFAULT 'all',
  health_focus TEXT DEFAULT 'general',
  product_line TEXT DEFAULT 'all',
  status TEXT DEFAULT 'pending',
  assign_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 账号表
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  platform TEXT NOT NULL,
  bit_profile_id TEXT UNIQUE,
  account_alias TEXT,
  customer_id TEXT,
  persona TEXT DEFAULT '{}',
  account_level TEXT DEFAULT 'new',
  proxy_type TEXT DEFAULT 'pool',
  proxy_config TEXT DEFAULT '{}',
  region TEXT DEFAULT '',
  daily_limit INTEGER DEFAULT 2,
  daily_interaction_limit INTEGER DEFAULT 20,
  weekly_target INTEGER DEFAULT 10,
  publish_count_week INTEGER DEFAULT 0,
  last_publish_at DATETIME,
  last_health_check_at DATETIME,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 匹配记录
CREATE TABLE IF NOT EXISTS match_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  match_score REAL DEFAULT 0,
  freshness_bonus REAL DEFAULT 0,
  final_priority REAL DEFAULT 0,
  matched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (content_id) REFERENCES content_pool(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- 4. 发布任务
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_record_id INTEGER,
  account_id INTEGER NOT NULL,
  content_id INTEGER,
  platform TEXT NOT NULL,
  batch_id TEXT DEFAULT '',
  draft_id TEXT DEFAULT '',
  action_type TEXT DEFAULT 'publish',
  target_note_url TEXT DEFAULT '',
  comment_text TEXT DEFAULT '',
  require_manual_confirm INTEGER DEFAULT 1,
  confirmed_at DATETIME,
  risk_level TEXT DEFAULT 'low',
  audit_payload TEXT DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  scheduled_at DATETIME,
  started_at DATETIME,
  finished_at DATETIME,
  result_url TEXT,
  error_log TEXT,
  retry_count INTEGER DEFAULT 0,
  screenshot_path TEXT,
  last_step TEXT,
  FOREIGN KEY (match_record_id) REFERENCES match_records(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (content_id) REFERENCES content_pool(id)
);

-- 5. 发布日志
CREATE TABLE IF NOT EXISTS publish_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  step TEXT NOT NULL,
  action TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER DEFAULT 0,
  screenshot_path TEXT,
  error TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 5.1 任务审计日志
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

-- 6. 代理IP池
CREATE TABLE IF NOT EXISTS proxy_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL,
  protocol TEXT DEFAULT 'http',
  city TEXT DEFAULT '',
  provider TEXT DEFAULT '',
  type TEXT DEFAULT 'pool',
  status TEXT DEFAULT 'active',
  last_check_at DATETIME,
  usage_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. 匹配规则
CREATE TABLE IF NOT EXISTS match_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL,
  content_field TEXT NOT NULL,
  operator TEXT NOT NULL,
  content_value TEXT NOT NULL,
  account_field TEXT NOT NULL,
  account_value TEXT NOT NULL,
  action TEXT DEFAULT 'exclude',
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes are created by guarded migrations in db.ts after legacy columns are verified.
