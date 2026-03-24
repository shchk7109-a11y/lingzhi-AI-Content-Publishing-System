import { contextBridge, ipcRenderer } from 'electron'

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

  // 事件监听
  onTaskProgress: (callback: (data: unknown) => void) => {
    ipcRenderer.on('task:progress', (_event, data) => callback(data))
  },
  onLog: (callback: (data: unknown) => void) => {
    ipcRenderer.on('log:message', (_event, data) => callback(data))
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
