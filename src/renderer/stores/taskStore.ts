import { create } from 'zustand'
import type { Task } from '../../shared/types'

interface TaskState {
  tasks: (Task & { content_title?: string; account_nickname?: string })[]
  loading: boolean
  loadTasks: () => Promise<void>
  startTasks: (taskIds: number[]) => Promise<void>
  retryTask: (taskId: number) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,

  loadTasks: async () => {
    set({ loading: true })
    try {
      const data = await window.api.taskList()
      set({ tasks: data })
    } catch {
      // 开发模式下API可能未就绪
    }
    set({ loading: false })
  },

  startTasks: async (taskIds) => {
    await window.api.taskStart(taskIds)
    await get().loadTasks()
  },

  retryTask: async (taskId) => {
    await window.api.taskRetry(taskId)
    await get().loadTasks()
  }
}))
