import { View, Text, Button } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { login } from '../../api/auth.api'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'
import './index.scss'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const setUserInfo = useAuthStore(s => s.setUserInfo)

  const onGetUserInfo = async (e: any) => {
    if (e.detail?.errMsg !== 'getUserInfo:ok') {
      Taro.showToast({ title: '需要授权才能使用', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const userInfo = await login()
      setUserInfo(userInfo)
      Taro.reLaunch({ url: ROUTES.SCHEDULE })
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
          <Text className='logo-emoji'>📚</Text>
        </View>
        <Text className='app-name'>乐学课表</Text>
        <Text className='slogan'>让全家都知道孩子的学校节奏</Text>
      </View>

      <View className='login-area'>
        <Button
          className='btn-login'
          openType='getUserInfo'
          onGetUserInfo={onGetUserInfo}
          loading={loading}
          disabled={loading}
        >
          <Text className='btn-icon'>💬</Text>
          <Text className='btn-text'>微信一键登录</Text>
        </Button>
        <Text className='privacy-tip'>登录即同意《用户协议》和《隐私政策》</Text>
      </View>
    </View>
  )
}
