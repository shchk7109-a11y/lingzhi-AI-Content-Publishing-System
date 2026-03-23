#!/bin/sh
# 生产环境数据初始化脚本
# 在 Railway Volume 挂载后，将内置默认数据文件复制到 /app/data（若不存在）

DATA_DIR="/app/data"
DEFAULTS_DIR="/app/data-defaults"

echo "[init-data] 检查数据目录..."

# 确保数据目录存在且可写
mkdir -p "$DATA_DIR"

# 逐一检查并初始化数据文件
for file in knowledge_base.json prompts.json users.json ai-configs.json; do
  TARGET="$DATA_DIR/$file"
  SOURCE="$DEFAULTS_DIR/$file"
  
  if [ ! -f "$TARGET" ] || [ ! -s "$TARGET" ]; then
    if [ -f "$SOURCE" ]; then
      echo "[init-data] 初始化 $file（从默认值复制）"
      cp "$SOURCE" "$TARGET"
    else
      echo "[init-data] 警告：默认文件 $SOURCE 不存在，跳过 $file"
    fi
  else
    echo "[init-data] $file 已存在，跳过"
  fi
done

echo "[init-data] 数据初始化完成"

# 启动 Next.js 服务器
exec node /app/server.js
