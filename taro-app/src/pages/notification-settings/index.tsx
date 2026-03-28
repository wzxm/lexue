import { View, Text, Switch, Picker, Button, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import * as notifyApi from '../../api/notify.api'
import * as studentApi from '../../api/student.api'
import type { Student, StudentNotifySetting } from '../../types/index'
import './index.scss'

const MINUTE_OPTIONS = [5, 10, 15, 20, 25]

export default function NotificationSettingsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [studentSettings, setStudentSettings] = useState<Record<string, StudentNotifySetting>>({})
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsList, settings] = await Promise.all([
          studentApi.listStudents(),
          notifyApi.getSettings()
        ])
        setStudents(studentsList)
        
        const s = settings as any
        if (s.student_settings) {
          setStudentSettings(s.student_settings)
        } else {
          const initialSettings: Record<string, StudentNotifySetting> = {}
          studentsList.forEach(student => {
            initialSettings[student.id] = {
              noon_enabled: true,
              afternoon_enabled: true,
              advance_minutes: 10
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

  if (pageLoading) {
    return <View className='notify-page'></View>
  }

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
                      onChange={(e) => updateStudentSetting(student.id, 'afternoon_enabled', e.detail.value)} 
                    />
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
    </View>
  )
}
