import { PropsWithChildren, useEffect, useRef } from 'react'
import { useDidShow } from '@tarojs/taro'
import { useAuthStore } from './store/auth.store'
import { ensureCloudInitialized } from './api/cloud'
import './app.scss'

const SESSION_VALIDATE_INTERVAL = 60 * 1000

function App({ children }: PropsWithChildren) {
  const lastValidatedAtRef = useRef(0)

  const rehydrateAndValidate = async () => {
    const auth = useAuthStore.getState()
    auth.hydrate()
    await auth.validateSession()
    lastValidatedAtRef.current = Date.now()
  }

  useEffect(() => {
    void ensureCloudInitialized()
      .then(() => {
        void rehydrateAndValidate()
      })
      .catch(() => {
        console.error('[app] 当前环境不支持云开发')
        useAuthStore.getState().hydrate()
      })
  }, [])

  useDidShow(() => {
    if (Date.now() - lastValidatedAtRef.current < SESSION_VALIDATE_INTERVAL) {
      return
    }
    void rehydrateAndValidate()
  })

  return children
}

export default App
