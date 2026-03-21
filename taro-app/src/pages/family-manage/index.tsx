import { View, Text, Button, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import * as familyApi from '../../api/family.api'
import * as shareApi from '../../api/share.api'
import type { MemberInfo } from '../../api/family.api'
import { useScheduleStore } from '../../store/schedule.store'
import './index.scss'

export default function FamilyManagePage() {
  const currentSchedule = useScheduleStore(s => s.currentSchedule)
  const scheduleId = currentSchedule?.id || ''

  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(true)

  const loadMembers = async (sid: string) => {
    if (!sid) return
    setLoading(true)
    try {
      const list = await familyApi.listMembers(sid)
      setMembers(list || [])
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers(scheduleId)
  }, [scheduleId])

  const handleInvite = async () => {
    if (!scheduleId) {
      Taro.showToast({ title: '请先选择课表', icon: 'none' })
      return
    }
    Taro.showLoading({ title: '生成邀请中...' })
    try {
      const res = await shareApi.generateInvite(scheduleId)
      Taro.hideLoading()
      Taro.setClipboardData({
        data: res.inviteUrl,
        success: () => Taro.showToast({ title: '邀请链接已复制，发给家人吧', icon: 'none', duration: 2500 }),
      })
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
    }
  }

  const handleRemoveMember = (openid: string, nickname: string) => {
    Taro.showModal({
      title: '移除成员',
      content: `确定移除「${nickname}」吗？`,
      confirmColor: '#FF5252',
      success: async (res) => {
        if (res.confirm) {
          try {
            await familyApi.removeMember(scheduleId, openid)
            Taro.showToast({ title: '已移除' })
            await loadMembers(scheduleId)
          } catch {
            Taro.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      },
    })
  }

  return (
    <View className='container'>
      <View className='header'>
        <Text className='title'>家人管理</Text>
        <Text className='subtitle'>最多支持 10 名家庭成员</Text>
      </View>

      {loading ? (
        <View className='loading'><Text>加载中...</Text></View>
      ) : members.length === 0 ? (
        <View className='empty'>
          <Text className='empty-icon'>👨‍👩‍👧</Text>
          <Text className='empty-text'>还没有家人，快去邀请吧</Text>
        </View>
      ) : (
        <View className='member-list'>
          {members.map((item) => (
            <View key={item.openid} className='member-item'>
              <View className='member-avatar'>
                {item.avatar_url ? (
                  <Image src={item.avatar_url} className='avatar-img' mode='aspectFill' />
                ) : (
                  <View className='avatar-placeholder'>
                    <Text>{item.nickname?.[0] || '?'}</Text>
                  </View>
                )}
              </View>
              <View className='member-info'>
                <Text className='member-name'>{item.nickname}</Text>
                <View className={`role-tag role-${item.permission}`}>
                  <Text>{item.is_owner ? '管理员' : item.permission === 'edit' ? '可编辑' : '仅查看'}</Text>
                </View>
              </View>
              {!item.is_owner && (
                <View className='member-actions'>
                  <Text className='remove-btn' onClick={() => handleRemoveMember(item.openid, item.nickname)}>移除</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <View className='bottom-bar'>
        <Button className='invite-btn' onClick={handleInvite}>+ 邀请家人</Button>
      </View>
    </View>
  )
}
