import { View, Text, Switch, Picker, Button, Image, PageContainer } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import * as notifyApi from '../../api/notify.api'
import * as studentApi from '../../api/student.api'
import * as scheduleApi from '../../api/schedule.api'
import { requestSubscribeMessage, SUBSCRIBE_TEMPLATE_ID } from '../../utils/subscribe'
import type { Student, StudentNotifySetting, Schedule } from '../../types/index'
import noDataImg from '../../assets/noData.png'
import './index.scss'

const MINUTE_OPTIONS = [5, 10, 15, 20, 25]

export default function NotificationSettingsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [studentSettings, setStudentSettings] = useState<Record<string, StudentNotifySetting>>({})
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [subscribeStatus, setSubscribeStatus] = useState<{ hasValidAuth: boolean } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsList, schedulesList, settings, status] = await Promise.all([
          studentApi.listStudents(),
          scheduleApi.listSchedules(),
          notifyApi.getSettings(),
          notifyApi.checkSubscribeStatus(SUBSCRIBE_TEMPLATE_ID)
        ])
        setStudents(studentsList)
        setSchedules(schedulesList)
        setSubscribeStatus(status)

        const s = settings as any
        if (s.student_settings) {
          const fetchedSettings = { ...s.student_settings }
          // Fill missing schedule_id
          studentsList.forEach(student => {
            if (fetchedSettings[student.id] && !fetchedSettings[student.id].schedule_id) {
              const defaultSchedule = schedulesList.find(sch => sch.student_id === student.id)
              if (defaultSchedule) {
                fetchedSettings[student.id].schedule_id = defaultSchedule.id
              }
            }
          })
          setStudentSettings(fetchedSettings)
        } else {
          const initialSettings: Record<string, StudentNotifySetting> = {}
          studentsList.forEach(student => {
            const defaultSchedule = schedulesList.find(sch => sch.student_id === student.id)
            initialSettings[student.id] = {
              noon_enabled: true,
              afternoon_enabled: true,
              advance_minutes: 10,
              schedule_id: defaultSchedule?.id
            }
          })
          setStudentSettings(initialSettings)
        }
      } catch (error) {
        Taro.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        setPageLoading(false)
      }
    }
    fetchData()
  }, [])

  // Sheet states
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null)
  const fallbackSetting: StudentNotifySetting = {
    noon_enabled: true,
    afternoon_enabled: true,
    advance_minutes: 10,
  }

  const getStudentSchedules = (studentId: string) => {
    return schedules.filter(s => s.student_id === studentId)
  }

  const getStudentSetting = (studentId: string) => studentSettings[studentId] || fallbackSetting
  const hasAnyEnabled = students.some(student => {
    const setting = getStudentSetting(student.id)
    return setting.noon_enabled || setting.afternoon_enabled
  })
  const enabledStudentCount = students.filter(student => {
    const setting = getStudentSetting(student.id)
    return setting.noon_enabled || setting.afternoon_enabled
  }).length
  const linkedScheduleCount = students.filter(student => {
    const setting = getStudentSetting(student.id)
    const studentSchedules = getStudentSchedules(student.id)
    return !!setting.schedule_id || studentSchedules.length > 0
  }).length

  const updateStudentSetting = (studentId: string, key: keyof StudentNotifySetting, value: any) => {
    setStudentSettings(prev => {
      const current = prev[studentId] || fallbackSetting
      return {
        ...prev,
        [studentId]: {
          ...current,
          [key]: value
        }
      }
    })
  }

  const onSave = async () => {
    setLoading(true)
    try {
      // 如果有开启提醒，先请求订阅授权
      if (hasAnyEnabled) {
        const authorized = await requestSubscribeMessage()
        if (!authorized) {
          Taro.showModal({
            title: '提示',
            content: '需要授权订阅消息才能接收提醒通知，请在弹窗中点击"允许"',
            showCancel: false
          })
          setLoading(false)
          return
        }
      }

      await notifyApi.updateSettings({
        student_settings: studentSettings
      })
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <View className='notify-page notify-page--loading'>
        <View className='loading-strip'>
          <View className='loading-dot' />
          <Text className='loading-title'>正在载入提醒设置</Text>
        </View>
      </View>
    )
  }

  const activeStudentSchedules = activeStudentId ? getStudentSchedules(activeStudentId) : []
  const activeStudentSetting = activeStudentId ? studentSettings[activeStudentId] : null

  return (
    <View className='notify-page'>
      <View className='notify-bg notify-bg--top' />
      <View className='notify-bg notify-bg--bottom' />

      {/* 授权状态提示 */}
      {subscribeStatus && !subscribeStatus.hasValidAuth && (
        <View className='auth-warning'>
          <Text className='auth-warning-eyebrow'>订阅状态提醒</Text>
          <Text className='auth-warning-title'>授权已失效</Text>
          <Text className='auth-warning-text'>需要重新授权订阅消息，才能继续接收放学提醒。</Text>
        </View>
      )}

      <View className='notify-hero'>
        <View className='notify-hero-copy'>
          <Text className='hero-eyebrow'>提醒设置</Text>
          <Text className='hero-title'>放学提醒</Text>
          <Text className='hero-desc'>按学生独立配置中午和下午放学提醒，并为每位学生绑定对应课表。</Text>
        </View>

        <View className='notify-hero-stats'>
          <View className='hero-stat'>
            <Text className='hero-stat-value'>{students.length}</Text>
            <Text className='hero-stat-label'>学生</Text>
          </View>
          <View className='hero-stat'>
            <Text className='hero-stat-value'>{enabledStudentCount}</Text>
            <Text className='hero-stat-label'>已开启</Text>
          </View>
          <View className='hero-stat'>
            <Text className='hero-stat-value'>{linkedScheduleCount}</Text>
            <Text className='hero-stat-label'>已关联</Text>
          </View>
        </View>
      </View>

      {students.length === 0 ? (
        <View className='empty-state'>
          <Image className='empty-icon' src={noDataImg} mode='aspectFit' />
          <Text className='empty-title'>还没有可配置的提醒</Text>
          <Text className='empty-text'>先创建课表或加入家人共享，再回来设置放学提醒。</Text>
        </View>
      ) : (
        <View className='student-list'>
          {students.map(student => {
            const setting = getStudentSetting(student.id)
            const minuteIndex = MINUTE_OPTIONS.indexOf(setting.advance_minutes)
            const pickerValue = minuteIndex !== -1 ? minuteIndex : 1
            const studentSchedules = getStudentSchedules(student.id)
            const associatedSchedule = studentSchedules.find(s => s.id === setting.schedule_id) || studentSchedules[0]
            const isEnabled = setting.noon_enabled || setting.afternoon_enabled

            return (
              <View key={student.id} className='student-section'>
                <View className='setting-card'>
                  <View className='student-card-head'>
                    <View className='student-avatar'>
                      <Text className='student-avatar-text'>{student.name?.slice(0, 1) || '学'}</Text>
                    </View>
                    <View className='student-meta'>
                      <View className='student-title-row'>
                        <Text className='student-title'>{student.name}</Text>
                        <Text className={`student-status ${isEnabled ? 'student-status--on' : 'student-status--off'}`}>
                          {isEnabled ? '已开启' : '已关闭'}
                        </Text>
                      </View>
                      <Text className='student-subtitle'>
                        {associatedSchedule ? `课表：${associatedSchedule.name}` : '尚未关联课表'}
                      </Text>
                    </View>
                  </View>

                  <View className='setting-summary'>
                    <View className='summary-chip'>
                      <Text className='summary-chip-label'>中午</Text>
                      <Text className='summary-chip-value'>{setting.noon_enabled ? '开启' : '关闭'}</Text>
                    </View>
                    <View className='summary-chip'>
                      <Text className='summary-chip-label'>下午</Text>
                      <Text className='summary-chip-value'>{setting.afternoon_enabled ? '开启' : '关闭'}</Text>
                    </View>
                    <View className='summary-chip'>
                      <Text className='summary-chip-label'>触发</Text>
                      <Text className='summary-chip-value'>提前{setting.advance_minutes}分钟</Text>
                    </View>
                  </View>

                  <View className='setting-row setting-row--first border-bottom'>
                    <View className='setting-info'>
                      <Text className='setting-label'>中午放学</Text>
                      <Text className='setting-desc'>上午最后一节课结束前进行提醒</Text>
                    </View>
                    <Switch
                      checked={setting.noon_enabled}
                      color='#3b82f6'
                      style={{ transform: 'scale(0.8)' }}
                      onChange={(e) => updateStudentSetting(student.id, 'noon_enabled', e.detail.value)}
                    />
                  </View>

                  <View className='setting-row border-bottom'>
                    <View className='setting-info'>
                      <Text className='setting-label'>下午放学</Text>
                      <Text className='setting-desc'>下午最后一节课结束前进行提醒</Text>
                    </View>
                    <Switch
                      checked={setting.afternoon_enabled}
                      color='#3b82f6'
                      style={{ transform: 'scale(0.8)' }}
                      onChange={(e) => updateStudentSetting(student.id, 'afternoon_enabled', e.detail.value)}
                    />
                  </View>

                  <View className='setting-row border-bottom' onClick={() => setActiveStudentId(student.id)}>
                    <Text className='setting-label'>关联课表</Text>
                    <View className='picker-value'>
                      <Text className='picker-text'>{associatedSchedule ? associatedSchedule.name : '请选择课表'}</Text>
                      <Text className='picker-arrow'>›</Text>
                    </View>
                  </View>

                  <View className='setting-row'>
                    <Text className='setting-label'>触发时间</Text>
                    <Picker 
                      mode='selector' 
                      range={MINUTE_OPTIONS.map(m => `${m}分钟`)} 
                      value={pickerValue}
                      onChange={(e) => {
                        const idx = Number(e.detail.value)
                        updateStudentSetting(student.id, 'advance_minutes', MINUTE_OPTIONS[idx])
                      }}
                    >
                      <View className='picker-value'>
                        <Text className='picker-text'>提前{setting.advance_minutes}分钟</Text>
                        <Text className='picker-arrow'>›</Text>
                      </View>
                    </Picker>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {students.length > 0 && (
        <View className='footer-bar'>
          <Button className='btn-save' disabled={loading} onClick={onSave}>
            {loading ? '保存中...' : '保存设置'}
          </Button>
        </View>
      )}

      {/* 归属课表选择弹窗 */}
      <PageContainer
        show={!!activeStudentId}
        position="bottom"
        round
        zIndex={1000}
        onClickOverlay={() => setActiveStudentId(null)}
        onAfterLeave={() => setActiveStudentId(null)}
        customStyle="background-color: #F5F7FA;"
      >
        <View className="schedule-sheet">
          <View className="schedule-sheet-header">
            <Text className="schedule-sheet-title">选择关联课表</Text>
            <Text className="schedule-sheet-close" onClick={() => setActiveStudentId(null)}>×</Text>
          </View>
          <View className="schedule-sheet-list">
            {activeStudentSchedules.length > 0 ? (
              activeStudentSchedules.map((s) => {
                const isActive = activeStudentSetting?.schedule_id === s.id || (!activeStudentSetting?.schedule_id && activeStudentSchedules[0]?.id === s.id)
                return (
                  <View
                    key={s.id}
                    className={`schedule-sheet-item ${isActive ? "schedule-sheet-item--active" : ""}`}
                    onClick={() => { 
                      if (activeStudentId) {
                        updateStudentSetting(activeStudentId, 'schedule_id', s.id)
                      }
                      setActiveStudentId(null)
                    }}
                  >
                    <Text className="schedule-sheet-name">{s.name}</Text>
                    {isActive && <Text className="schedule-sheet-check">✓</Text>}
                  </View>
                )
              })
            ) : (
              <View className="schedule-sheet-empty">
                该学生暂无课表
              </View>
            )}
          </View>
        </View>
      </PageContainer>
    </View>
  )
}
