import { View, Text, Switch, Picker, Button } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import * as notifyApi from '../../api/notify.api'
import './index.scss'

const MINUTE_OPTIONS = [5, 10, 15, 20, 25]

export default function NotificationSettingsPage() {
  const [afterSchoolEnabled, setAfterSchoolEnabled] = useState(true)
  const [afterSchoolMinutes, setAfterSchoolMinutes] = useState(15)
  const [afterSchoolIndex, setAfterSchoolIndex] = useState(2)
  const [classEnabled, setClassEnabled] = useState(true)
  const [classMinutes, setClassMinutes] = useState(10)
  const [classIndex, setClassIndex] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    notifyApi.getSettings().then((settings) => {
      // 注意：原项目 notification-settings 页面用了 afterSchoolReminderMinutes 等字段
      // 但 BackendSettings 类型里只有 notify_advance_minutes
      // 这里按实际后端返回兼容处理
      const s = settings as any
      if (s.notify_enabled !== undefined) {
        setAfterSchoolEnabled(s.notify_enabled)
        setClassEnabled(s.notify_enabled)
      }
      if (s.notify_advance_minutes !== undefined) {
        const mins = s.notify_advance_minutes
        setAfterSchoolMinutes(mins)
        setClassMinutes(mins)
        const idx = MINUTE_OPTIONS.indexOf(mins)
        if (idx !== -1) {
          setAfterSchoolIndex(idx)
          setClassIndex(idx)
        }
      }
    }).catch(() => {
      // 首次使用，用默认值
    })
  }, [])

  const onSave = async () => {
    setLoading(true)
    try {
      await notifyApi.updateSettings({
        notify_enabled: afterSchoolEnabled && classEnabled,
        notify_advance_minutes: afterSchoolMinutes,
        notify_time_slots: [],
      })
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='notify-page'>
      <View className='section'>
        <Text className='section-title'>放学提醒</Text>
        <View className='setting-card'>
          <View className='setting-row border-bottom'>
            <View className='setting-left'>
              <Text className='setting-icon'>🏠</Text>
              <View className='setting-info'>
                <Text className='setting-label'>开启放学提醒</Text>
                <Text className='setting-desc'>放学前提醒家长接孩子</Text>
              </View>
            </View>
            <Switch checked={afterSchoolEnabled} color='#00C853'
              onChange={(e) => setAfterSchoolEnabled(e.detail.value)} />
          </View>
          <View className={`setting-row ${!afterSchoolEnabled ? 'row-disabled' : ''}`}>
            <View className='setting-left'>
              <Text className='setting-icon'>⏰</Text>
              <Text className='setting-label'>提前提醒时间</Text>
            </View>
            <Picker mode='selector' range={MINUTE_OPTIONS} value={afterSchoolIndex}
              disabled={!afterSchoolEnabled}
              onChange={(e) => {
                const idx = Number(e.detail.value)
                setAfterSchoolIndex(idx)
                setAfterSchoolMinutes(MINUTE_OPTIONS[idx])
              }}>
              <View className='picker-value'>
                <Text className='picker-text'>{afterSchoolMinutes} 分钟</Text>
                <Text className='picker-arrow'>›</Text>
              </View>
            </Picker>
          </View>
        </View>
      </View>

      <View className='section'>
        <Text className='section-title'>上课提醒</Text>
        <View className='setting-card'>
          <View className='setting-row border-bottom'>
            <View className='setting-left'>
              <Text className='setting-icon'>📚</Text>
              <View className='setting-info'>
                <Text className='setting-label'>开启上课提醒</Text>
                <Text className='setting-desc'>上课前提醒孩子准备好</Text>
              </View>
            </View>
            <Switch checked={classEnabled} color='#00C853'
              onChange={(e) => setClassEnabled(e.detail.value)} />
          </View>
          <View className={`setting-row ${!classEnabled ? 'row-disabled' : ''}`}>
            <View className='setting-left'>
              <Text className='setting-icon'>⏰</Text>
              <Text className='setting-label'>提前提醒时间</Text>
            </View>
            <Picker mode='selector' range={MINUTE_OPTIONS} value={classIndex}
              disabled={!classEnabled}
              onChange={(e) => {
                const idx = Number(e.detail.value)
                setClassIndex(idx)
                setClassMinutes(MINUTE_OPTIONS[idx])
              }}>
              <View className='picker-value'>
                <Text className='picker-text'>{classMinutes} 分钟</Text>
                <Text className='picker-arrow'>›</Text>
              </View>
            </Picker>
          </View>
        </View>
      </View>

      <View className='footer-bar'>
        <Button className='btn-save' disabled={loading} onClick={onSave}>
          {loading ? '保存中...' : '保存设置'}
        </Button>
      </View>
    </View>
  )
}
