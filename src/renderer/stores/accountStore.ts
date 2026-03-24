import { create } from 'zustand'
import type { Account } from '../../shared/types'

interface AccountState {
  accounts: Account[]
  loading: boolean
  searchText: string
  setSearchText: (text: string) => void
  loadAccounts: () => Promise<void>
  createAccount: (account: Record<string, unknown>) => Promise<void>
  deleteAccount: (id: number) => Promise<void>
  updatePersona: (id: number, persona: Record<string, string>) => Promise<void>
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  loading: false,
  searchText: '',

  setSearchText: (text) => set({ searchText: text }),

  loadAccounts: async () => {
    set({ loading: true })
    try {
      const { searchText } = get()
      const filters = searchText ? { search: searchText } : undefined
      const data = await window.api.accounts.getAll(filters)
      set({ accounts: data as Account[] })
    } catch {
      // 开发模式下API可能未就绪
    }
    set({ loading: false })
  },

  createAccount: async (account) => {
    await window.api.accounts.insert(account)
    await get().loadAccounts()
  },

  deleteAccount: async (id) => {
    await window.api.accounts.delete(id)
    await get().loadAccounts()
  },

  updatePersona: async (id, persona) => {
    await window.api.accounts.updatePersona(id, persona)
    await get().loadAccounts()
  }
}))
