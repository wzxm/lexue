import { View, Text, Switch } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { getProfile, updateDisplaySettings } from '../../api/auth.api'
import { useAuthStore } from '../../store/auth.store'
import { useScheduleStore } from '../../store/schedule.store'
import './index.scss'

export default function DisplaySettingsPage() {
  const userInfo = useAuthStore(s => s.userInfo)
  const setUserInfo = useAuthStore(s => s.setUserInfo)
  const currentSchedule = useScheduleStore(s => s.currentSchedule)
  const [hideWeekend, setHideWeekend] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const val = userInfo?.settings?.hide_weekend ?? false
    setHideWeekend(val)
  }, [userInfo])

  const handleToggle = async (val: boolean) => {
    // 仅在开启时校验：当前课表周六/周日有课程则不允许开启
    if (val) {
      const hasWeekendCourses = (currentSchedule?.courses || []).some(
        course => course.day_of_week === 6 || course.day_of_week === 7
      )
      if (hasWeekendCourses) {
        Taro.showModal({
          title: '',
          content: '你当前课表周六日有课程数据，暂不支持隐藏周末。',
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
    }

    setHideWeekend(val)
    setSaving(true)
    try {
      await updateDisplaySettings({ hideWeekend: val })
      // 刷新 store 里的 userInfo
      const updated = await getProfile()
      setUserInfo(updated)
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
      setHideWeekend(!val)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='display-settings-page'>
      <View className='ds-header'>
        <Text className='ds-header-title'>展示管理</Text>
        <Text className='ds-header-desc'>控制课表的显示方式</Text>
      </View>

      <View className='ds-section'>
        <View className='ds-section-title'>课表视图</View>
        <View className='ds-item'>
          <View className='ds-item-left'>
            <Text className='ds-item-label'>隐藏周末</Text>
            <Text className='ds-item-desc'>开启后，周视图和日视图均不显示周六、周日的课程</Text>
          </View>
          <Switch
            checked={hideWeekend}
            disabled={saving}
            color='#3b82f6'
            style={{ transform: 'scale(0.8)' }}
            onChange={e => handleToggle(e.detail.value)}
          />
        </View>
      </View>
    </View>
  )
}
