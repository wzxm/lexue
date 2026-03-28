import { View, Text, Button } from '@tarojs/components'
import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { login } from '../../api/auth.api'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'
import './index.scss'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const setUserInfo = useAuthStore(s => s.setUserInfo)
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const loginDisabled = loading || !agreed
  const showDisabledStyle = !agreed

  const afterLogin = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
    } else {
      Taro.reLaunch({ url: ROUTES.SCHEDULE })
    }
  }

  useDidShow(() => {
    if (isLoggedIn) {
      afterLogin()
    }
  })

  const onLogin = async () => {
    if (loading) return
    if (!agreed) {
      Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' })
      return
    }
    
    setLoading(true)
    try {
      // 1. 获取用户信息 (头像、昵称等)
      // 注意：微信基础库 2.27.1 及以上，getUserProfile 接口已被收回，只能获取到匿名信息
      // 这里为了演示，我们直接调用 login 获取 openid 并模拟用户信息
      const userInfo = await login()
      setUserInfo(userInfo)
      afterLogin()
    } catch (err: any) {
      Taro.showToast({ title: err.message || '登录失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='login-page'>
      <View className='brand-area'>
        <View className='logo-circle'>
          <Text className='iconfont logo-icon'>{'\ue696'}</Text>
        </View>
        <Text className='app-name'>乐学课表</Text>
        <View className='feature-list'>
          <Text className='feature-line'>· 家人共享，随时看课表</Text>
          <Text className='feature-line'>· 放学提醒，接送更准时</Text>
          <Text className='feature-line'>· 实用工具，起步更稳定</Text>
        </View>
      </View>

      <View className='login-area'>
        <View className='agree-row' onClick={() => setAgreed(!agreed)}>
          <View className={`agree-check ${agreed ? 'agree-check--on' : ''}`}>
            {agreed ? <Text className='agree-mark'>✓</Text> : null}
          </View>
          <Text className='agree-text'>
            我已充分阅读并同意<Text className='agree-text-link'>《课表平台服务协议》</Text>和<Text className='agree-text-link'>《课表隐私政策》</Text>
          </Text>
        </View>
        <Button
          className={`btn-login ${showDisabledStyle ? 'btn-login--disabled' : ''}`}
          onClick={onLogin}
          loading={loading}
          disabled={loginDisabled}
        >
          {!loading ? <Text className='btn-text'>微信一键登录</Text> : null}
        </Button>
      </View>
    </View>
  )
}
