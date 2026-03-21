import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'

// 启动页：检查登录态跳转
export default function IndexPage() {
  useEffect(() => {
    const isLoggedIn = useAuthStore.getState().isLoggedIn
    if (isLoggedIn) {
      Taro.reLaunch({ url: ROUTES.SCHEDULE })
    } else {
      Taro.reLaunch({ url: ROUTES.LOGIN })
    }
  }, [])

  return null
}
