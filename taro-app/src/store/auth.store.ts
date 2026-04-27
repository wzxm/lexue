import { create } from 'zustand'
import type { UserInfo } from '../types/index'
import { getProfile } from '../api/auth.api'
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
  validateSession: () => Promise<void>
  logout: () => void
}

function isInvalidSessionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || '')
  return (
    message.includes('NOT_FOUND') ||
    message.includes('UNAUTHORIZED') ||
    message.includes('NO_PERMISSION') ||
    message.includes('用户不存在') ||
    message.includes('账号状态异常')
  )
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

  validateSession: async () => {
    const state = getCachedAuth()
    if (!state.isLoggedIn) return

    try {
      const profile = await getProfile()
      set({ userInfo: profile, isLoggedIn: true })
      if (profile.openId) saveOpenId(profile.openId)
      saveUserInfo(profile)
      saveLoginFlag(true)
    } catch (err) {
      if (!isInvalidSessionError(err)) return
      clearOpenId()
      clearUserInfo()
      clearLoginFlag()
      set({ userInfo: null, isLoggedIn: false })
    }
  },

  logout: () => {
    clearOpenId()
    clearUserInfo()
    clearLoginFlag()
    set({ userInfo: null, isLoggedIn: false })
  },
}))
