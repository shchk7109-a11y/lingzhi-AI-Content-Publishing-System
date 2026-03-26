# 灵芝水铺 AI多平台智能发布系统 v3.0

> lingzhi-publisher — 内容池管理、智能匹配引擎、多平台自动化发布

## 技术栈

- **桌面容器**: Electron 28+ (TypeScript)
- **前端框架**: React 18 + TypeScript
- **UI组件库**: Ant Design 5
- **状态管理**: Zustand
- **本地数据库**: better-sqlite3
- **自动化引擎**: puppeteer-core (CDP连接Bit浏览器)
- **本地文件服务**: Express
- **Excel解析**: SheetJS (xlsx)
- **构建工具**: electron-vite + Vite
- **打包工具**: electron-builder (Windows NSIS)

## 目录结构

```
src/
├── main/           # Electron 主进程
├── preload/        # 预加载脚本
├── renderer/       # React 渲染进程（页面、组件、状态管理）
├── core/           # 核心业务逻辑
│   └── publishers/ # 平台发布适配器
├── database/       # 数据库 schema 和连接
└── shared/         # 共享类型定义和常量
```

## 核心模块

| 模块 | 说明 |
|------|------|
| ContentOrganizer | Excel解析 + 图片/视频匹配 + 内容池入库 |
| SmartMatcher | 智能匹配引擎（硬规则+软评分+轮换均衡） |
| BitBrowserManager | Bit指纹浏览器API封装 |
| WindowPool | 并发窗口池（信号量 + 资源监控） |
| TaskScheduler | 任务调度器（令牌桶+时间窗） |
| HumanBehaviorEngine | 拟人行为引擎 |
| ProxyManager | 代理IP管理 |
| CrashRecovery | 崩溃恢复（自检+断点续传） |

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建打包

```bash
npm run package:win
```

## 功能页面

1. **控制台** - 发布统计、健康状态、实时日志
2. **内容池** - Excel导入、卡片列表、标签编辑、预览
3. **账号管理** - 画像编辑、分组、批量导入、IP配置
4. **智能匹配** - 触发匹配、结果预览、手动调整
5. **任务中心** - 任务列表、进度、截图、重试
6. **设置** - Bit配置、并发数、代理、养号参数
