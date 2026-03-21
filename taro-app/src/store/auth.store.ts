import { create } from 'zustand'
import type { UserInfo } from '../types/index'
import { saveOpenId, loadOpenId, clearOpenId } from '../utils/storage'

interface AuthState {
  userInfo: UserInfo | null
  isLoggedIn: boolean
  setUserInfo: (info: UserInfo) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userInfo: null,
  isLoggedIn: !!loadOpenId(),

  setUserInfo: (info) => {
    saveOpenId(info.openId)
    set({ userInfo: info, isLoggedIn: true })
  },

  logout: () => {
    clearOpenId()
    set({ userInfo: null, isLoggedIn: false })
  },
}))
