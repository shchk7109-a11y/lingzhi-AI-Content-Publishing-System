import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的API给渲染进程
const api = {
  // 内容池
  contentList: (filters?: Record<string, string>) => ipcRenderer.invoke('content:list', filters),
  contentImport: (contents: Record<string, unknown>[]) => ipcRenderer.invoke('content:import', contents),
  contentUpdate: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('content:update', id, data),
  contentDelete: (id: number) => ipcRenderer.invoke('content:delete', id),

  // 账号
  accountList: () => ipcRenderer.invoke('account:list'),
  accountCreate: (account: Record<string, unknown>) => ipcRenderer.invoke('account:create', account),
  accountUpdate: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('account:update', id, data),
  accountDelete: (id: number) => ipcRenderer.invoke('account:delete', id),

  // 匹配
  matchRun: () => ipcRenderer.invoke('match:run'),
  matchList: () => ipcRenderer.invoke('match:list'),
  matchConfirm: (matchIds: number[]) => ipcRenderer.invoke('match:confirm', matchIds),

  // 任务
  taskList: () => ipcRenderer.invoke('task:list'),
  taskStart: (taskIds: number[]) => ipcRenderer.invoke('task:start', taskIds),
  taskRetry: (taskId: number) => ipcRenderer.invoke('task:retry', taskId),

  // 设置
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSave: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),

  // 匹配规则
  rulesList: () => ipcRenderer.invoke('rules:list'),
  rulesSave: (rule: Record<string, unknown>) => ipcRenderer.invoke('rules:save', rule),

  // 统计
  statsDashboard: () => ipcRenderer.invoke('stats:dashboard'),

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
