import { create } from 'zustand'
import type { UserInfo } from '../types/index'
import { getProfile } from '../api/auth.api'
import {
  saveOpenId, loadOpenId, clearOpenId,
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

function sanitizeUserInfo(info: UserInfo | null): UserInfo | null {
  if (!info || !isEphemeralAvatarUrl(info.avatarUrl)) return info
  return { ...info, avatarUrl: '' }
}

function getCachedAuth() {
  const cachedUserInfo = sanitizeUserInfo(loadUserInfo())
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
    const safeInfo = sanitizeUserInfo(info) || info
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

    try {
      const rawProfile = await getProfile()
      const profile = sanitizeUserInfo(rawProfile) || rawProfile
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
