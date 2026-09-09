import { create } from 'zustand'
import type { UserInfo } from '../types/index'
import {
  saveUserId, loadUserId, clearUserId,
  saveOpenId, clearOpenId,
  saveUserInfo, loadUserInfo, clearUserInfo,
  saveLoginFlag, loadLoginFlag, clearLoginFlag,
} from '../utils/storage'
import { isEphemeralAvatarUrl } from '../utils/avatar'

interface AuthState {
  userInfo: UserInfo | null
  isLoggedIn: boolean
  setUserInfo: (info: UserInfo) => void
  hydrate: () => void
  validateSession: () => Promise<void>
  logout: () => void
}

function sanitizeUserInfo(info: UserInfo | null): UserInfo | null {
  if (!info || !isEphemeralAvatarUrl(info.avatarUrl)) return info
  return { ...info, avatarUrl: '' }
}

function getCachedAuth() {
  const cachedUserInfo = sanitizeUserInfo(loadUserInfo())
  const cachedUserId = loadUserId()
  const cachedLoginFlag = loadLoginFlag()
  const userId = cachedUserInfo?.userId || cachedUserId || ''
  return {
    userInfo: cachedUserInfo,
    isLoggedIn: cachedLoginFlag || !!userId,
  }
}

const cached = getCachedAuth()

export const useAuthStore = create<AuthState>((set) => ({
  userInfo: cached.userInfo,
  isLoggedIn: cached.isLoggedIn,

  setUserInfo: (info) => {
    const safeInfo = sanitizeUserInfo(info) || info
    if (safeInfo.userId) {
      saveUserId(safeInfo.userId)
    }
    if (safeInfo.openId) {
      saveOpenId(safeInfo.openId)
    }
    saveUserInfo(safeInfo)
    saveLoginFlag(true)
    set({ userInfo: safeInfo, isLoggedIn: true })
  },

  hydrate: () => {
    const next = getCachedAuth()
    set(next)
  },

  validateSession: async () => {
    const state = getCachedAuth()
    if (!state.isLoggedIn) return
    // 登录态由本地缓存维护；只有主动退出或清理小程序缓存才会结束。
    set(state)
  },

  logout: () => {
    clearUserId()
    clearOpenId()
    clearUserInfo()
    clearLoginFlag()
    set({ userInfo: null, isLoggedIn: false })
  },
}))
