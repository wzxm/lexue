// 在 App.tsx 或首页添加授权状态检查和提示

import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import * as notifyApi from './api/notify.api'
import { SUBSCRIBE_TEMPLATE_ID, requestSubscribeMessage } from './utils/subscribe'

export function useSubscribeAuthCheck() {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const status = await notifyApi.checkSubscribeStatus(SUBSCRIBE_TEMPLATE_ID)

        // 如果授权失效，显示提示
        if (!status.hasValidAuth) {
          // 检查是否已经提示过（避免每次打开都提示）
          const lastPromptTime = Taro.getStorageSync('last_subscribe_prompt')
          const now = Date.now()

          // 每24小时提示一次
          if (!lastPromptTime || now - lastPromptTime > 24 * 60 * 60 * 1000) {
            Taro.showModal({
              title: '提醒授权已失效',
              content: '您的上课提醒授权已失效，需要重新授权才能继续接收提醒。是否立即授权？',
              confirmText: '立即授权',
              cancelText: '稍后再说',
              success: async (res) => {
                if (res.confirm) {
                  const authorized = await requestSubscribeMessage()
                  if (authorized) {
                    Taro.showToast({ title: '授权成功', icon: 'success' })
                  }
                }
                // 记录提示时间
                Taro.setStorageSync('last_subscribe_prompt', now)
              }
            })
          }
        }
      } catch (error) {
        console.error('检查订阅授权失败', error)
      }
    }

    checkAuth()
  }, [])
}

// 使用方式：在 App.tsx 或首页调用
// useSubscribeAuthCheck()
