import { create } from 'zustand'
import type { UserInfo } from '../types/index'
import {
  saveOpenId, loadOpenId, clearOpenId,
  saveUserInfo, loadUserInfo, clearUserInfo,
  saveLoginFlag, loadLoginFlag, clearLoginFlag,
} from '../utils/storage'

interface AuthState {
  userInfo: UserInfo | null
  isLoggedIn: boolean
  setUserInfo: (info: UserInfo) => void
  hydrate: () => void
  logout: () => void
}

function getCachedAuth() {
  const cachedUserInfo = loadUserInfo()
  const cachedOpenId = loadOpenId()
  const cachedLoginFlag = loadLoginFlag()
  return {
    userInfo: cachedUserInfo,
    isLoggedIn: cachedLoginFlag || !!cachedOpenId || !!cachedUserInfo,
  }
}

const cached = getCachedAuth()

export const useAuthStore = create<AuthState>((set) => ({
  userInfo: cached.userInfo,
  isLoggedIn: cached.isLoggedIn,

  setUserInfo: (info) => {
    if (info.openId) {
      saveOpenId(info.openId)
    }
    saveUserInfo(info)
    saveLoginFlag(true)
    set({ userInfo: info, isLoggedIn: true })
  },

  hydrate: () => {
    const next = getCachedAuth()
    set(next)
  },

  logout: () => {
    clearOpenId()
    clearUserInfo()
    clearLoginFlag()
    set({ userInfo: null, isLoggedIn: false })
  },
}))
