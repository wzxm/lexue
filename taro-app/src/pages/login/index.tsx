import { View, Text, Button, Image, Input } from '@tarojs/components'
import { useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { login } from '../../api/auth.api'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'
import defaultAvatar from '../../assets/default-avatar.png'
import './index.scss'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const redirectingRef = useRef(false)
  const setUserInfo = useAuthStore(s => s.setUserInfo)
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const loginDisabled = loading || !agreed || !nickname.trim() || !avatarUrl
  const showDisabledStyle = loginDisabled

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
      if (!nickname.trim()) {
        Taro.showToast({ title: '请先填写微信昵称', icon: 'none' })
        return
      }
      if (!avatarUrl) {
        Taro.showToast({ title: '请先授权微信头像', icon: 'none' })
        return
      }
      const userInfo = await login({
        nickname: nickname.trim(),
        avatarUrl,
      })
      setUserInfo(userInfo)
      afterLogin()
    } catch (err: any) {
      Taro.showToast({ title: err.message || '登录失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const onChooseAvatar = (e: any) => {
    const nextAvatarUrl = e?.detail?.avatarUrl || ''
    if (!nextAvatarUrl) return
    setAvatarUrl(nextAvatarUrl)
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
        <View className='profile-auth-area'>
          <Button
            className='avatar-authorize-btn'
            openType='chooseAvatar'
            onChooseAvatar={onChooseAvatar}
          >
            <Image
              className='avatar-authorize-img'
              src={avatarUrl || defaultAvatar}
              mode='aspectFill'
            />
          </Button>
          <Input
            className='nickname-input'
            type='nickname'
            maxlength={20}
            placeholder='请输入微信昵称'
            value={nickname}
            onInput={(e) => setNickname(e.detail.value)}
          />
        </View>
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
