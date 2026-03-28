import Taro from '@tarojs/taro'
import { PropsWithChildren, useEffect } from 'react'
import { useDidShow } from '@tarojs/taro'
import { useAuthStore } from './store/auth.store'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    useAuthStore.getState().hydrate()
    // 云开发初始化（Taro.cloud.init 等效于 wx.cloud.init）
    if (Taro.cloud) {
      Taro.cloud.init({
        env: 'cloud1-1g0kf2p8b07af20f',
        traceUser: true,
      })
      console.log('[app] 云开发初始化完成')
    } else {
      console.error('[app] 当前环境不支持云开发')
    }
  }, [])

  useDidShow(() => {
    useAuthStore.getState().hydrate()
  })

  return children
}

export default App
