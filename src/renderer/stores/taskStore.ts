import { create } from 'zustand'
import type { Task } from '../../shared/types'

type TaskRow = Task & { content_title?: string; account_nickname?: string }

interface TaskState {
  tasks: TaskRow[]
  loading: boolean
  loadTasks: (filters?: Record<string, string>) => Promise<void>
  retryTask: (taskId: number) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,

  loadTasks: async (filters?) => {
    set({ loading: true })
    try {
      const data = await window.api.tasks.getAll(filters)
      set({ tasks: data as TaskRow[] })
    } catch {
      // 开发模式下API可能未就绪
    }
    set({ loading: false })
  },

  retryTask: async (taskId) => {
    await window.api.tasks.updateStatus(taskId, 'queued', { error_log: '' })
    await get().loadTasks()
  }
}))
