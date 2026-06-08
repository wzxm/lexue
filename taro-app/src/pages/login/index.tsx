import { View, Text, Button } from '@tarojs/components'
import { useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { login, loginWithPhone } from '../../api/auth.api'
import { LOGIN_MODE } from '../../constants/auth'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'
import './index.scss'

const FEATURES = [
  { icon: '\ue600', label: '家庭共享' },
  { icon: '\ue696', label: '多孩课表' },
  { icon: '\ue603', label: 'AI 识别' },
] as const

const USER_AGREEMENT_PDF =
  'cloud://test-d7gxuxk5a8418c629.7465-test-d7gxuxk5a8418c629-1437432577/prototype/《用户协议》.pdf'
const PRIVACY_POLICY_PDF =
  'cloud://test-d7gxuxk5a8418c629.7465-test-d7gxuxk5a8418c629-1437432577/prototype/《隐私政策》.pdf'

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

  const openPdfDocument = async (fileID: string, title: string) => {
    Taro.showLoading({ title: '打开中...' })
    try {
      const { tempFilePath } = await Taro.cloud.downloadFile({ fileID })
      await Taro.openDocument({
        filePath: tempFilePath,
        fileType: 'pdf',
      })
    } catch (err: any) {
      Taro.showToast({ title: err?.message || `${title}打开失败`, icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
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
      <View className='content'>
        <View className='brand-area'>
          <View className='logo-icon'>
            <Text className='iconfont logo-icon-inner'>{'\ue696'}</Text>
          </View>
          <Text className='app-name'>智鑫课表</Text>
          {/* <Text className='app-slogan'>让每个家庭的课表管理更轻松</Text> */}

          <View className='features'>
            {FEATURES.map(item => (
              <View key={item.label} className='feature-chip'>
                <Text className='iconfont feature-chip-icon'>{item.icon}</Text>
                <Text className='feature-chip-label'>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='login-card'>
          <Text className='login-title'>登录后可管理课表</Text>

          <View className='agreement' onClick={() => setAgreed(!agreed)}>
            <View className={`checkbox ${agreed ? 'checkbox--checked' : ''}`}>
              {agreed ? <Text className='checkbox-mark'>✓</Text> : null}
            </View>
            <Text className='agreement-text'>
              我已阅读并同意
              <Text
                className='agreement-link'
                onClick={(e) => {
                  e.stopPropagation()
                  void openPdfDocument(USER_AGREEMENT_PDF, '用户协议')
                }}
              >
                《用户协议》
              </Text>
              和
              <Text
                className='agreement-link'
                onClick={(e) => {
                  e.stopPropagation()
                  void openPdfDocument(PRIVACY_POLICY_PDF, '隐私政策')
                }}
              >
                《隐私政策》
              </Text>
            </Text>
          </View>

          {isPhoneMode ? (
            <Button
              className={`login-btn ${showDisabledStyle ? 'login-btn--disabled' : ''}`}
              openType='getPhoneNumber'
              onGetPhoneNumber={onPhoneLogin}
              loading={loading}
              disabled={loginDisabled}
            >
              {!loading ? (
                <View className='login-btn-content'>
                  <Text className='iconfont login-btn-icon login-btn-icon--phone'>{'\ue642'}</Text>
                  <Text className='login-btn-text'>手机号快捷登录</Text>
                </View>
              ) : null}
            </Button>
          ) : (
            <Button
              className={`login-btn ${showDisabledStyle ? 'login-btn--disabled' : ''}`}
              onClick={onWechatLogin}
              loading={loading}
              disabled={loginDisabled}
            >
              {!loading ? (
                <View className='login-btn-content'>
                  <View className='login-btn-icon login-btn-icon--wechat' />
                  <Text className='login-btn-text'>微信一键登录</Text>
                </View>
              ) : null}
            </Button>
          )}
        </View>

        {/* <Text className='bottom-text'>无需注册账号，基于微信安全登录</Text> */}
      </View>
    </View>
  )
}
