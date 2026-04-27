import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import FeatureHighlights from '../../components/FeatureHighlights'
import {
  verifyInvite,
  acceptInvite,
  type InvitePreview,
} from '../../api/share.api'
import { listSchedules } from '../../api/schedule.api'
import { listStudents } from '../../api/student.api'
import { useScheduleStore } from '../../store/schedule.store'
import { useStudentStore } from '../../store/student.store'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'
import './index.scss'

function getInviteOpenErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '')
  const msg = raw.toUpperCase()

  if (raw.includes('不能邀请自己')) {
    return '这是你发出的邀请，请转发给家人打开'
  }
  if (
    msg.includes('PARAM_ERROR') ||
    msg.includes('NOT_FOUND') ||
    raw.includes('缺少必要参数') ||
    raw.includes('不存在')
  ) {
    return '邀请链接无效，可能已失效或已被撤回'
  }
  if (raw.includes('过期') || raw.includes('EXPIRE')) {
    return '邀请链接已过期，请让家人重新发起邀请'
  }
  if (msg.includes('FORBIDDEN') || msg.includes('NO_PERMISSION')) {
    return '你暂时无法打开该邀请，请确认账号后重试'
  }
  if (msg.includes('UNAUTHORIZED')) {
    return '登录状态已失效，请先登录后再试'
  }
  if (raw.includes('网络') || msg.includes('NETWORK')) {
    return '网络异常，请检查网络后重试'
  }

  return '邀请暂时无法打开，请稍后重试或让家人重新发起邀请'
}

function getInviteAcceptErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '')
  const msg = raw.toUpperCase()

  if (raw.includes('不能邀请自己')) return '这是你发出的邀请，请转发给家人打开'
  if (msg.includes('LIMIT_EXCEEDED')) return '该家庭成员已达上限，暂时无法加入'
  if (msg.includes('PARAM_ERROR') || msg.includes('NOT_FOUND')) return '邀请已失效，请让家人重新发起邀请'
  if (msg.includes('UNAUTHORIZED')) return '登录状态已失效，请先登录后重试'
  if (msg.includes('INTERNAL_ERROR')) return '加入失败，请稍后重试'
  if (raw.includes('网络') || msg.includes('NETWORK')) return '网络异常，请检查网络后重试'

  return raw || '加入失败，请稍后重试'
}

export default function InviteAcceptPage() {
  const router = useRouter()
  const inviterOpenId = (router.params?.inviterOpenId || '').toString()

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const userInfo = useAuthStore(s => s.userInfo)
  const setSchedules = useScheduleStore(s => s.setSchedules)
  const setCurrentSchedule = useScheduleStore(s => s.setCurrentSchedule)
  const setStudents = useStudentStore(s => s.setStudents)

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '家人共享邀请' })
  }, [])

  useDidShow(() => {
    loadPreview()
  })

  const loadPreview = async () => {
    if (!inviterOpenId) {
      setLoading(false)
      setErrorMsg('邀请链接无效，缺少必要参数')
      return
    }
    setLoading(true)
    try {
      const data = await verifyInvite(inviterOpenId)
      setPreview(data)
      setErrorMsg('')
    } catch (err: unknown) {
      setErrorMsg(getInviteOpenErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!inviterOpenId || accepting) return
    if (!userInfo?.openId) {
      Taro.showModal({
        title: '请先登录',
        content: '接收邀请需要先登录，是否现在登录？',
        confirmText: '去登录',
        success: res => {
          if (res.confirm) {
            // navigateTo 保留邀请页，登录后 navigateBack 即可回来继续接收
            Taro.navigateTo({ url: ROUTES.LOGIN })
          }
        }
      })
      return
    }

    setAccepting(true)
    Taro.showLoading({ title: '处理中', mask: true })
    try {
      const result = await acceptInvite(inviterOpenId)
      Taro.hideLoading()

      // 同步刷新课表 / 学生缓存，保证管理页立即可见共享数据
      try {
        const [schedules, students] = await Promise.all([
          listSchedules(),
          listStudents(),
        ])
        setSchedules(schedules)
        setStudents(students)

        const joinedSchedule = schedules.find(
          s => result.scheduleIds.includes(s.id) || result.scheduleIds.includes(s._id || '')
        )
        if (joinedSchedule) {
          setCurrentSchedule(joinedSchedule)
        }
      } catch {
        // 刷新失败不影响成功弹窗，schedule 页会自己重新拉取
      }

      Taro.showModal({
        title: '已加入家人共享',
        content: '现在可以查看并编辑对方名下的全部学生、课表和课程',
        confirmText: '查看数据',
        showCancel: false,
        confirmColor: '#3b82f6',
        success: () => {
          // 销毁当前邀请页，直接进入课表
          Taro.reLaunch({ url: ROUTES.SCHEDULE })
        }
      })
    } catch (err: any) {
      Taro.hideLoading()
      console.error('[invite-accept] acceptInvite failed', err)
      Taro.showToast({ title: getInviteAcceptErrorMessage(err), icon: 'none' })
    } finally {
      setAccepting(false)
    }
  }

  const goHome = () => {
    Taro.reLaunch({ url: ROUTES.SCHEDULE })
  }

  if (loading) {
    return (
      <View className='invite-accept-page'>
        <View className='invite-loading'>加载中...</View>
      </View>
    )
  }

  if (errorMsg || !preview) {
    return (
      <View className='invite-accept-page'>
        <View className='invite-error'>
          <Text className='invite-error-title'>邀请无法打开</Text>
          <Text className='invite-error-desc'>{errorMsg || '邀请信息异常'}</Text>
          <Button className='invite-back-btn' onClick={goHome}>返回我的课表</Button>
        </View>
      </View>
    )
  }

  return (
    <View className='invite-accept-page'>
      <View className='invite-hero'>
        {preview.inviterAvatarUrl ? (
          <Image className='inviter-avatar' src={preview.inviterAvatarUrl} mode='aspectFill' />
        ) : (
          <View className='inviter-avatar inviter-avatar-placeholder'>
            <Text className='inviter-avatar-text'>
              {(preview.inviterNickname || '家人').charAt(0)}
            </Text>
          </View>
        )}
        <Text className='invite-hero-title'>
          {preview.inviterNickname ? `${preview.inviterNickname} ` : '家人'}邀请你加入家庭共享
        </Text>
        <Text className='invite-hero-desc'>
          将共享 <Text className='invite-hero-strong'>{preview.studentCount}</Text> 位学生
        </Text>
        <Text className='invite-hero-desc'>
          当前共有 <Text className='invite-hero-strong'>{preview.scheduleCount}</Text> 份课表
        </Text>

        {preview.students.length > 0 && (
          <View className='invite-schedule-list'>
            {preview.students.map((student) => (
              <View className='invite-schedule-item' key={student.studentId}>
                <Text className='invite-schedule-name'>{student.studentName}</Text>
                <Text className='invite-schedule-semester'>{student.scheduleCount} 份课表</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className='invite-feature-wrap'>
        <FeatureHighlights />
      </View>

      <View className='invite-bottom'>
        <Button
          className='invite-accept-btn'
          onClick={handleAccept}
          loading={accepting}
          disabled={accepting}
        >
          {accepting ? '' : '同意加入'}
        </Button>
      </View>
    </View>
  )
}
