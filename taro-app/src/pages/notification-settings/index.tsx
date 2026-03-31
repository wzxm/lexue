import { View, Text, Switch, Picker, Button, Image, PageContainer } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import * as notifyApi from '../../api/notify.api'
import * as studentApi from '../../api/student.api'
import * as scheduleApi from '../../api/schedule.api'
import type { Student, StudentNotifySetting, Schedule } from '../../types/index'
import './index.scss'

const MINUTE_OPTIONS = [5, 10, 15, 20, 25]

export default function NotificationSettingsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [studentSettings, setStudentSettings] = useState<Record<string, StudentNotifySetting>>({})
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  // Sheet states
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsList, schedulesList, settings] = await Promise.all([
          studentApi.listStudents(),
          scheduleApi.listSchedules(),
          notifyApi.getSettings()
        ])
        setStudents(studentsList)
        setSchedules(schedulesList)
        
        const s = settings as any
        if (s.student_settings) {
          const fetchedSettings = { ...s.student_settings }
          // Fill missing schedule_id
          studentsList.forEach(student => {
            if (fetchedSettings[student.id] && !fetchedSettings[student.id].schedule_id) {
              const defaultSchedule = schedulesList.find(sch => sch.studentId === student.id)
              if (defaultSchedule) {
                fetchedSettings[student.id].schedule_id = defaultSchedule.id
              }
            }
          })
          setStudentSettings(fetchedSettings)
        } else {
          const initialSettings: Record<string, StudentNotifySetting> = {}
          studentsList.forEach(student => {
            const defaultSchedule = schedulesList.find(sch => sch.studentId === student.id)
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

  const updateStudentSetting = (studentId: string, key: keyof StudentNotifySetting, value: any) => {
    setStudentSettings(prev => {
      const current = prev[studentId] || { noon_enabled: true, afternoon_enabled: true, advance_minutes: 10 }
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

  const getStudentSchedules = (studentId: string) => {
    return schedules.filter(s => s.studentId === studentId)
  }

  if (pageLoading) {
    return <View className='notify-page'></View>
  }

  const activeStudentSchedules = activeStudentId ? getStudentSchedules(activeStudentId) : []
  const activeStudentSetting = activeStudentId ? studentSettings[activeStudentId] : null

  return (
    <View className='notify-page'>
      <View className='notify-header'>
        <Text className='header-title'>开启后，系统将通过小程序通知进行提醒。</Text>
        <Text className='header-desc'>• 若有多位学生课表，则需要进行独立设置。</Text>
        <Text className='header-desc'>• 目前仅支持放学提醒，后续将逐步完善更多提醒。</Text>
        <Text className='header-desc'>• 通知依赖微信下发，高峰期微信可能会有一定滞后。</Text>
      </View>

      {students.length === 0 ? (
        <View className='empty-state'>
          <Image className='empty-icon' src='../../images/icons/box.png' mode='aspectFit' />
          <Text className='empty-text'>您暂未创建/加入课表</Text>
        </View>
      ) : (
        <View className='student-list'>
          {students.map(student => {
            const setting = studentSettings[student.id] || { noon_enabled: true, afternoon_enabled: true, advance_minutes: 10 }
            const minuteIndex = MINUTE_OPTIONS.indexOf(setting.advance_minutes)
            const pickerValue = minuteIndex !== -1 ? minuteIndex : 1
            const studentSchedules = getStudentSchedules(student.id)
            const associatedSchedule = studentSchedules.find(s => s.id === setting.schedule_id) || studentSchedules[0]

            return (
              <View key={student.id} className='student-section'>
                <Text className='student-title'>{student.name}的放学提醒</Text>
                <View className='setting-card'>
                  <View className='setting-row border-bottom'>
                    <View className='setting-info'>
                      <Text className='setting-label'>中午放学</Text>
                      <Text className='setting-desc'>上午最后一节课结束前进行提醒</Text>
                    </View>
                    <Switch 
                      checked={setting.noon_enabled} 
                      color='#00C853'
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
                      color='#00C853'
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
            {loading ? '保存中...' : '确定'}
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
        customStyle="background-color: #F7F7F7;"
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
