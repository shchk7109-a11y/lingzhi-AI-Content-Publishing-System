#!/bin/bash

# 灵芝水铺 AI 系统 - 服务器一键部署脚本
# 请赋予此脚本执行权限: chmod +x server-setup.sh

echo ">>> 开始部署灵芝水铺 AI 系统..."

# 1. 检查 Node.js
if ! command -v node &> /dev/null; then
    echo ">>> 未检测到 Node.js，正在安装 (Node 18)..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo ">>> Node.js 已安装: $(node -v)"
fi

# 2. 检查 PM2 (进程管理器)
if ! command -v pm2 &> /dev/null; then
    echo ">>> 未检测到 PM2，正在安装..."
    sudo npm install -g pm2
else
    echo ">>> PM2 已安装"
fi

# 3. 安装依赖
echo ">>> 正在安装项目依赖 (这可能需要几分钟)..."
npm install --production=false

# 4. 构建项目
echo ">>> 正在构建 Next.js 应用..."
npm run build

# 5. 启动服务
echo ">>> 正在启动服务 (PM2)..."
pm2 start ecosystem.config.js
pm2 save

echo "=============================================="
echo ">>> 部署成功！"
echo ">>> 应用运行在端口: 3001"
echo ">>> 请确保阿里云安全组已开放 TCP 3001 端口"
echo ">>> 访问地址: http://您的服务器IP:3001"
echo "=============================================="
