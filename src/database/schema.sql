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
  customer_id TEXT,
  persona TEXT DEFAULT '{}',
  account_level TEXT DEFAULT 'new',
  proxy_type TEXT DEFAULT 'pool',
  proxy_config TEXT DEFAULT '{}',
  region TEXT DEFAULT '',
  daily_limit INTEGER DEFAULT 2,
  weekly_target INTEGER DEFAULT 10,
  publish_count_week INTEGER DEFAULT 0,
  last_publish_at DATETIME,
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
  content_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
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

-- ===== 索引 =====
CREATE INDEX IF NOT EXISTS idx_tasks_status_scheduled ON tasks(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_match_records_account_date ON match_records(account_id, matched_at);
CREATE INDEX IF NOT EXISTS idx_publish_logs_task ON publish_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_content_pool_status_tags ON content_pool(status, gender, age_group, health_focus);
CREATE INDEX IF NOT EXISTS idx_proxy_pool_city_status ON proxy_pool(city, status);
CREATE INDEX IF NOT EXISTS idx_accounts_customer ON accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_content_pool_draft ON content_pool(draft_id);
