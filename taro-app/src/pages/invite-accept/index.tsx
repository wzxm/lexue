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

export default function InviteAcceptPage() {
  const router = useRouter()
  const token = (router.params?.token || '').toString()

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const userInfo = useAuthStore(s => s.userInfo)
  const setSchedules = useScheduleStore(s => s.setSchedules)
  const setCurrentSchedule = useScheduleStore(s => s.setCurrentSchedule)
  const setStudents = useStudentStore(s => s.setStudents)

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '课表共享邀请' })
  }, [])

  useDidShow(() => {
    loadPreview()
  })

  const loadPreview = async () => {
    if (!token) {
      setLoading(false)
      setErrorMsg('邀请链接无效，缺少必要参数')
      return
    }
    setLoading(true)
    try {
      const data = await verifyInvite(token)
      setPreview(data)
      setErrorMsg('')
    } catch (err: any) {
      const msg = err?.message || '邀请信息获取失败'
      setErrorMsg(msg.includes('NOT_FOUND') ? '邀请链接不存在或已失效' :
        msg.includes('过期') ? '邀请链接已过期' : msg)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!token || accepting) return
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
      const result = await acceptInvite(token)
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
        title: '邀请接收成功',
        content: result.joinedCount > 0
          ? `已成功加入${preview?.studentName || ''}的课表共享`
          : '你已是该课表的成员，无需重复接收',
        confirmText: '查看课表',
        showCancel: false,
        confirmColor: '#3b82f6',
        success: () => {
          // 销毁当前邀请页，直接进入课表
          Taro.reLaunch({ url: ROUTES.SCHEDULE })
        }
      })
    } catch (err: any) {
      Taro.hideLoading()
      Taro.showToast({ title: err?.message || '接收失败', icon: 'none' })
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
          {preview.inviterNickname ? `${preview.inviterNickname} ` : '家人'}邀请你查看课表
        </Text>
        <Text className='invite-hero-desc'>
          学生：<Text className='invite-hero-strong'>{preview.studentName}</Text>
        </Text>
        <Text className='invite-hero-desc'>
          将共享 <Text className='invite-hero-strong'>{preview.schedules.length}</Text> 份课表
        </Text>

        {preview.schedules.length > 0 && (
          <View className='invite-schedule-list'>
            {preview.schedules.map(s => (
              <View className='invite-schedule-item' key={s.scheduleId}>
                <Text className='invite-schedule-name'>{s.scheduleName}</Text>
                {s.semester ? <Text className='invite-schedule-semester'>{s.semester}</Text> : null}
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
          {accepting ? '处理中...' : '接收邀请'}
        </Button>
      </View>
    </View>
  )
}
