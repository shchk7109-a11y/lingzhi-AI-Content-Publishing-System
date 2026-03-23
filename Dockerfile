# ─── 阶段1：依赖安装 ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─── 阶段2：构建 ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

RUN npm install -g pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma 客户端
RUN pnpm exec prisma generate

# 构建 Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ─── 阶段3：生产运行 ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 复制 Prisma 相关文件（运行时需要）
COPY --from=builder /app/node_modules/.pnpm /app/node_modules/.pnpm
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/@prisma/adapter-better-sqlite3 ./node_modules/@prisma/adapter-better-sqlite3
COPY --from=builder /app/prisma ./prisma

# ── 关键修复：将默认数据文件复制到 data-defaults 目录（不挂载 Volume）──
# Volume 会挂载到 /app/data，data-defaults 作为只读备份供首次初始化使用
RUN mkdir -p /app/data-defaults
COPY --from=builder /app/data/knowledge_base.json ./data-defaults/knowledge_base.json
COPY --from=builder /app/data/prompts.json ./data-defaults/prompts.json
COPY --from=builder /app/data/users.json ./data-defaults/users.json

# 创建空的 ai-configs.json 默认文件
RUN echo '[]' > ./data-defaults/ai-configs.json

# 创建 /app/data 目录（Railway Volume 会挂载到此处）
RUN mkdir -p /app/data

# 复制启动初始化脚本
COPY --from=builder /app/scripts/init-data.sh ./init-data.sh
RUN chmod +x ./init-data.sh

# 以 root 运行，确保对 Volume 挂载目录有完整读写权限
# （Railway Volume 挂载后所有者为 root，nextjs 用户无法写入）
# 注意：Railway 环境中容器以非特权方式运行，root 用户是安全的

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["/app/init-data.sh"]
