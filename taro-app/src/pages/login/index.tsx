import { View, Text, Button } from '@tarojs/components'
import { useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { login, loginWithPhone } from '../../api/auth.api'
import { LOGIN_MODE } from '../../constants/auth'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'
import './index.scss'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const redirectingRef = useRef(false)
  const setUserInfo = useAuthStore(s => s.setUserInfo)
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const loginDisabled = loading || !agreed
  const showDisabledStyle = loginDisabled
  const isPhoneMode = LOGIN_MODE === 'phone'

  const afterLogin = () => {
    if (redirectingRef.current) return
    redirectingRef.current = true
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack().finally(() => {
        redirectingRef.current = false
      })
    } else {
      Taro.reLaunch({ url: ROUTES.SCHEDULE }).finally(() => {
        redirectingRef.current = false
      })
    }
  }

  const handleLoginSuccess = (userInfo: Awaited<ReturnType<typeof login>>) => {
    setUserInfo(userInfo)
    afterLogin()
  }

  useDidShow(() => {
    if (isLoggedIn) {
      afterLogin()
    }
  })

  const ensureAgreed = () => {
    if (agreed) return true
    Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' })
    return false
  }

  const onWechatLogin = async () => {
    if (loading) return
    if (!ensureAgreed()) return

    setLoading(true)
    try {
      const userInfo = await login()
      handleLoginSuccess(userInfo)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '登录失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const onPhoneLogin = async (e: any) => {
    if (loading) return
    if (!ensureAgreed()) return

    const detail = e?.detail || {}
    if (detail.errMsg !== 'getPhoneNumber:ok' || !detail.code) {
      return
    }

    setLoading(true)
    try {
      const userInfo = await loginWithPhone({ phoneCode: detail.code })
      handleLoginSuccess(userInfo)
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

        {isPhoneMode ? (
          <Button
            className={`btn-login ${showDisabledStyle ? 'btn-login--disabled' : ''}`}
            openType='getPhoneNumber'
            onGetPhoneNumber={onPhoneLogin}
            loading={loading}
            disabled={loginDisabled}
          >
            {!loading ? <Text className='btn-text'>手机号快捷登录</Text> : null}
          </Button>
        ) : (
          <Button
            className={`btn-login ${showDisabledStyle ? 'btn-login--disabled' : ''}`}
            onClick={onWechatLogin}
            loading={loading}
            disabled={loginDisabled}
          >
            {!loading ? <Text className='btn-text'>微信一键登录</Text> : null}
          </Button>
        )}
      </View>
    </View>
  )
}
