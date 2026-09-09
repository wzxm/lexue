import { View, Text, Button, Input } from '@tarojs/components'
import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { loginByPhone, sendSmsCode } from '../../api/auth.api'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'
import { loadSmsCooldownUntil, saveSmsCooldownUntil } from '../../utils/storage'
import './index.scss'

const FEATURES = [
  { icon: '\ue600', label: '家庭共享' },
  { icon: '\ue696', label: '多孩课表' },
  { icon: '\ue603', label: '智能识别' },
] as const

const SMS_COOLDOWN_SEC = 60

const USER_AGREEMENT_PDF =
  'cloud://cloud1-d5gbyvu3l05e11828.636c-cloud1-d5gbyvu3l05e11828-1483343796/prototype/user-agreement.pdf'
const PRIVACY_POLICY_PDF =
  'cloud://cloud1-d5gbyvu3l05e11828.636c-cloud1-d5gbyvu3l05e11828-1483343796/prototype/privacy-policy.pdf'

function calcRemainingSec(untilMs: number) {
  return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000))
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [loginError, setLoginError] = useState('')
  const redirectingRef = useRef(false)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const setUserInfo = useAuthStore(s => s.setUserInfo)
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const loginDisabled = loading || !agreed || !phone || !smsCode
  const showDisabledStyle = loginDisabled
  const codeBtnDisabled = sendingCode || countdown > 0 || !/^1[3-9]\d{9}$/.test(phone)

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  const startCountdown = useCallback((untilMs: number) => {
    clearCountdownTimer()
    saveSmsCooldownUntil(untilMs)
    const tick = () => {
      const remain = calcRemainingSec(untilMs)
      setCountdown(remain)
      if (remain <= 0) {
        clearCountdownTimer()
      }
    }
    tick()
    countdownTimerRef.current = setInterval(tick, 1000)
  }, [clearCountdownTimer])

  useEffect(() => {
    const until = loadSmsCooldownUntil()
    if (until && until > Date.now()) {
      startCountdown(until)
    }
    return clearCountdownTimer
  }, [clearCountdownTimer, startCountdown])

  const afterLogin = () => {
    if (redirectingRef.current) return
    redirectingRef.current = true
    const clearRedirecting = () => {
      redirectingRef.current = false
    }
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack().then(clearRedirecting, clearRedirecting)
    } else {
      Taro.reLaunch({ url: ROUTES.SCHEDULE }).then(clearRedirecting, clearRedirecting)
    }
  }

  const handleLoginSuccess = (userInfo: Awaited<ReturnType<typeof loginByPhone>>) => {
    setLoginError('')
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

  const onSendCode = async () => {
    if (codeBtnDisabled) return
    if (!ensureAgreed()) return
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号码', icon: 'none' })
      return
    }

    setSendingCode(true)
    try {
      await sendSmsCode(phone)
      startCountdown(Date.now() + SMS_COOLDOWN_SEC * 1000)
      await Taro.showModal({
        title: '验证码已发送',
        content: '请留意【腾讯云】开头的短信验证码，课表管家登录/注册验证服务由腾讯云提供。',
        showCancel: false,
        confirmText: '知道了',
      })
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '发送失败，请稍后重试', icon: 'none' })
    } finally {
      setSendingCode(false)
    }
  }

  const onPhoneLogin = async () => {
    if (loading) return
    if (!ensureAgreed()) return

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号码', icon: 'none' })
      return
    }
    if (!/^\d{6}$/.test(smsCode)) {
      Taro.showToast({ title: '请输入 6 位短信验证码', icon: 'none' })
      return
    }

    setLoading(true)
    setLoginError('')
    try {
      const userInfo = await loginByPhone({ phone, smsCode })
      handleLoginSuccess(userInfo)
    } catch (err: any) {
      const message = err?.message || '登录失败，请重试'
      setLoginError(message)
      Taro.showToast({ title: message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const codeBtnText = sendingCode
    ? '发送中...'
    : countdown > 0
      ? `${countdown}s`
      : '获取验证码'

  return (
    <View className='login-page'>
      <View className='content'>
        <View className='brand-area'>
          <View className='logo-icon'>
            <Text className='iconfont logo-icon-inner'>{'\ue696'}</Text>
          </View>
          <Text className='app-name'>课表管家</Text>

          <View className='features'>
            {FEATURES.map((item, index) => (
              <View key={item.label} className='feature-chip'>
                {index > 0 && <Text className='feature-divider'>｜</Text>}
                <Text className='iconfont feature-chip-icon'>{item.icon}</Text>
                <Text className='feature-chip-label'>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='login-card'>
          <Text className='login-title'>登录后管理您的课表</Text>

          <Input
            className='login-input'
            type='number'
            maxlength={11}
            placeholder='请输入手机号码'
            value={phone}
            onInput={e => {
              setPhone(e.detail.value)
              setLoginError('')
            }}
          />
          <View className='code-row'>
            <Input
              className='login-input code-input'
              type='number'
              maxlength={6}
              placeholder='请输入短信验证码'
              value={smsCode}
              onInput={e => {
                setSmsCode(e.detail.value)
                setLoginError('')
              }}
            />
            <Button
              className={`code-btn ${codeBtnDisabled ? 'code-btn--disabled' : ''}`}
              disabled={codeBtnDisabled}
              loading={sendingCode}
              onClick={onSendCode}
            >
              {codeBtnText}
            </Button>
          </View>
          {loginError ? <Text className='login-error'>{loginError}</Text> : null}
          <Button
            className={`login-btn ${showDisabledStyle ? 'login-btn--disabled' : ''}`}
            onClick={onPhoneLogin}
            loading={loading}
            disabled={loginDisabled}
          >
            <Text className='login-btn-text'>手机号登录</Text>
          </Button>

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
        </View>
      </View>
    </View>
  )
}
