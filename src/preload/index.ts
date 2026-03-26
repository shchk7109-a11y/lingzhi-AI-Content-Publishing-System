import { contextBridge, ipcRenderer } from 'electron'

try {
  const api = {
    // 内容池
    content: {
      getAll: (filters?: Record<string, string>) => ipcRenderer.invoke('db:content:getAll', filters),
      getById: (id: number) => ipcRenderer.invoke('db:content:getById', id),
      insert: (data: Record<string, unknown>) => ipcRenderer.invoke('db:content:insert', data),
      batchInsert: (items: Record<string, unknown>[]) => ipcRenderer.invoke('db:content:batchInsert', items),
      updateStatus: (id: number, status: string) => ipcRenderer.invoke('db:content:updateStatus', id, status),
      updateTags: (id: number, tags: string[]) => ipcRenderer.invoke('db:content:updateTags', id, tags),
      delete: (id: number) => ipcRenderer.invoke('db:content:delete', id)
    },

    // 账号
    accounts: {
      getAll: (filters?: Record<string, string>) => ipcRenderer.invoke('db:accounts:getAll', filters),
      getById: (id: number) => ipcRenderer.invoke('db:accounts:getById', id),
      insert: (data: Record<string, unknown>) => ipcRenderer.invoke('db:accounts:insert', data),
      batchInsert: (items: Record<string, unknown>[]) => ipcRenderer.invoke('db:accounts:batchInsert', items),
      updatePersona: (id: number, persona: Record<string, string>) => ipcRenderer.invoke('db:accounts:updatePersona', id, persona),
      updateStatus: (id: number, status: string) => ipcRenderer.invoke('db:accounts:updateStatus', id, status),
      delete: (id: number) => ipcRenderer.invoke('db:accounts:delete', id)
    },

    // 匹配记录
    matchRecords: {
      getAll: (filters?: Record<string, string>) => ipcRenderer.invoke('db:matchRecords:getAll', filters),
      insert: (data: Record<string, unknown>) => ipcRenderer.invoke('db:matchRecords:insert', data),
      updateStatus: (id: number, status: string) => ipcRenderer.invoke('db:matchRecords:updateStatus', id, status)
    },

    // 任务
    tasks: {
      getAll: (filters?: Record<string, string>) => ipcRenderer.invoke('db:tasks:getAll', filters),
      getById: (id: number) => ipcRenderer.invoke('db:tasks:getById', id),
      updateStatus: (id: number, status: string, extra?: Record<string, unknown>) => ipcRenderer.invoke('db:tasks:updateStatus', id, status, extra),
      getRunning: () => ipcRenderer.invoke('db:tasks:getRunning'),
      getQueued: (limit?: number) => ipcRenderer.invoke('db:tasks:getQueued', limit)
    },

    // 匹配规则
    matchRules: {
      getAll: () => ipcRenderer.invoke('db:matchRules:getAll'),
      insert: (rule: Record<string, unknown>) => ipcRenderer.invoke('db:matchRules:insert', rule),
      updateEnabled: (id: number, enabled: boolean) => ipcRenderer.invoke('db:matchRules:updateEnabled', id, enabled),
      delete: (id: number) => ipcRenderer.invoke('db:matchRules:delete', id)
    },

    // Bit浏览器
    bit: {
      healthCheck: () => ipcRenderer.invoke('bit:healthCheck'),
      openBrowser: (profileId: string) => ipcRenderer.invoke('bit:openBrowser', profileId),
      closeBrowser: (profileId: string) => ipcRenderer.invoke('bit:closeBrowser', profileId),
      getActiveBrowsers: () => ipcRenderer.invoke('bit:getActiveBrowsers'),
      getProfileList: (page?: number, pageSize?: number) => ipcRenderer.invoke('bit:getProfileList', page, pageSize)
    },

    // 设置
    settings: {
      get: () => ipcRenderer.invoke('settings:get'),
      update: (key: string, value: unknown) => ipcRenderer.invoke('settings:update', key, value),
      save: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),
      testBitConnection: () => ipcRenderer.invoke('settings:testBitConnection')
    },

    // 统计
    stats: {
      dashboard: () => ipcRenderer.invoke('db:stats:dashboard')
    },

    // 发布测试
    publish: {
      test: (params: {
        profileId: string; title: string; content: string
        tags: string[]; imagePaths: string[]; accountLevel: string
      }) => ipcRenderer.invoke('publish:test', params)
    },

    // 文件对话框
    dialog: {
      selectImages: () => ipcRenderer.invoke('dialog:selectImages') as Promise<string[]>
    },

    // 窗口池
    windowPool: {
      status: () => ipcRenderer.invoke('windowPool:status')
    },

    // 事件监听
    onTaskProgress: (callback: (data: unknown) => void) => {
      ipcRenderer.on('task:progress', (_event, data) => callback(data))
    },
    onLog: (callback: (data: unknown) => void) => {
      ipcRenderer.on('log:message', (_event, data) => callback(data))
    },
    onPublishStepUpdate: (callback: (data: unknown) => void) => {
      ipcRenderer.on('publish:step-update', (_event, data) => callback(data))
    },
    removePublishStepListener: () => {
      ipcRenderer.removeAllListeners('publish:step-update')
    }
  }

  contextBridge.exposeInMainWorld('api', api)
  console.log('[Preload] API exposed to renderer successfully')
} catch (error) {
  console.error('[Preload] Failed to expose API:', error)
}

// 类型导出（仅TypeScript编译期，不影响运行时）
export type ElectronAPI = {
  content: {
    getAll: (filters?: Record<string, string>) => Promise<unknown>
    getById: (id: number) => Promise<unknown>
    insert: (data: Record<string, unknown>) => Promise<unknown>
    batchInsert: (items: Record<string, unknown>[]) => Promise<unknown>
    updateStatus: (id: number, status: string) => Promise<unknown>
    updateTags: (id: number, tags: string[]) => Promise<unknown>
    delete: (id: number) => Promise<unknown>
  }
  accounts: {
    getAll: (filters?: Record<string, string>) => Promise<unknown>
    getById: (id: number) => Promise<unknown>
    insert: (data: Record<string, unknown>) => Promise<unknown>
    batchInsert: (items: Record<string, unknown>[]) => Promise<unknown>
    updatePersona: (id: number, persona: Record<string, string>) => Promise<unknown>
    updateStatus: (id: number, status: string) => Promise<unknown>
    delete: (id: number) => Promise<unknown>
  }
  matchRecords: {
    getAll: (filters?: Record<string, string>) => Promise<unknown>
    insert: (data: Record<string, unknown>) => Promise<unknown>
    updateStatus: (id: number, status: string) => Promise<unknown>
  }
  tasks: {
    getAll: (filters?: Record<string, string>) => Promise<unknown>
    getById: (id: number) => Promise<unknown>
    updateStatus: (id: number, status: string, extra?: Record<string, unknown>) => Promise<unknown>
    getRunning: () => Promise<unknown>
    getQueued: (limit?: number) => Promise<unknown>
  }
  matchRules: {
    getAll: () => Promise<unknown>
    insert: (rule: Record<string, unknown>) => Promise<unknown>
    updateEnabled: (id: number, enabled: boolean) => Promise<unknown>
    delete: (id: number) => Promise<unknown>
  }
  bit: {
    healthCheck: () => Promise<unknown>
    openBrowser: (profileId: string) => Promise<unknown>
    closeBrowser: (profileId: string) => Promise<unknown>
    getActiveBrowsers: () => Promise<unknown>
    getProfileList: (page?: number, pageSize?: number) => Promise<unknown>
  }
  settings: {
    get: () => Promise<unknown>
    update: (key: string, value: unknown) => Promise<unknown>
    save: (settings: Record<string, unknown>) => Promise<unknown>
    testBitConnection: () => Promise<unknown>
  }
  stats: {
    dashboard: () => Promise<unknown>
  }
  publish: {
    test: (params: Record<string, unknown>) => Promise<unknown>
  }
  dialog: {
    selectImages: () => Promise<string[]>
  }
  windowPool: {
    status: () => Promise<unknown>
  }
  onTaskProgress: (callback: (data: unknown) => void) => void
  onLog: (callback: (data: unknown) => void) => void
  onPublishStepUpdate: (callback: (data: unknown) => void) => void
  removePublishStepListener: () => void
}
