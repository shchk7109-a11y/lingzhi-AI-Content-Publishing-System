import { create } from 'zustand'
import type { Account } from '../../shared/types'

interface AccountState {
  accounts: Account[]
  loading: boolean
  loadAccounts: () => Promise<void>
  createAccount: (account: Record<string, unknown>) => Promise<void>
  deleteAccount: (id: number) => Promise<void>
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  loading: false,

  loadAccounts: async () => {
    set({ loading: true })
    try {
      const data = await window.api.accountList()
      const accounts = data.map((row: Record<string, unknown>) => ({
        ...row,
        persona: JSON.parse((row.persona as string) || '{}'),
        proxy_config: JSON.parse((row.proxy_config as string) || '{}')
      }))
      set({ accounts })
    } catch {
      // 开发模式下API可能未就绪
    }
    set({ loading: false })
  },

  createAccount: async (account) => {
    await window.api.accountCreate(account)
  },

  deleteAccount: async (id) => {
    await window.api.accountDelete(id)
  }
}))
