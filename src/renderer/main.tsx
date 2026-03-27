import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'

// 检查 preload API 是否可用
// 检测方式：window.api 存在 且 settings.get 是函数（排除mock）
const isRealElectron = !!(window.api && typeof window.api?.settings?.get === 'function' && !('__mock' in window.api))
;(window as any).__ELECTRON__ = isRealElectron
if (!window.api) {
  console.warn('[Renderer] window.api is undefined - 注入mock API')
  const mockInvoke = (...args: unknown[]) => {
    console.warn('[MockAPI] IPC not available, call ignored:', args)
    return Promise.resolve(null)
  }
  const noop = () => {}
  ;(window as any).api = {
    __mock: true,
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
