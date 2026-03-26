import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'

// 检查 preload API 是否可用，不可用时提供 mock 防止崩溃
// 标记是否在Electron环境中运行
;(window as any).__ELECTRON__ = !!window.api
if (!window.api) {
  console.warn('[Renderer] window.api is undefined - 当前在浏览器中运行，非Electron环境。IPC功能不可用。')
  const mockInvoke = (...args: unknown[]) => {
    console.warn('[MockAPI] IPC not available, call ignored:', args)
    return Promise.resolve(null)
  }
  const noop = () => {}
  ;(window as any).api = {
    content: { getAll: mockInvoke, getById: mockInvoke, insert: mockInvoke, batchInsert: mockInvoke, updateStatus: mockInvoke, updateTags: mockInvoke, delete: mockInvoke },
    accounts: { getAll: mockInvoke, getById: mockInvoke, insert: mockInvoke, batchInsert: mockInvoke, updatePersona: mockInvoke, updateStatus: mockInvoke, delete: mockInvoke },
    matchRecords: { getAll: mockInvoke, insert: mockInvoke, updateStatus: mockInvoke },
    tasks: { getAll: mockInvoke, getById: mockInvoke, updateStatus: mockInvoke, getRunning: mockInvoke, getQueued: mockInvoke },
    matchRules: { getAll: mockInvoke, insert: mockInvoke, updateEnabled: mockInvoke, delete: mockInvoke },
    bit: { healthCheck: mockInvoke, openBrowser: mockInvoke, closeBrowser: mockInvoke, getActiveBrowsers: mockInvoke, getProfileList: mockInvoke },
    settings: { get: mockInvoke, update: mockInvoke, save: mockInvoke, testBitConnection: mockInvoke },
    stats: { dashboard: () => Promise.resolve({ totalContent: 0, totalAccounts: 0, totalTasks: 0, successTasks: 0, pendingTasks: 0, activeAccounts: 0, successRate: 0 }) },
    publish: { test: mockInvoke },
    dialog: { selectImages: () => Promise.resolve([]) },
    windowPool: { status: mockInvoke },
    onTaskProgress: noop, onLog: noop, onPublishStepUpdate: noop, removePublishStepListener: noop
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1A5C3A',
          colorSuccess: '#52c41a',
          colorWarning: '#D4A853',
          borderRadius: 6
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
