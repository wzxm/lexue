import { View, Text, Image, PageContainer, Button } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import * as familyApi from '../../api/family.api'
import type { MemberInfo } from '../../api/family.api'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'
import './index.scss'

const AVATAR_COLORS = ['#A0A4F0', '#E8C86A', '#7EC8A0', '#E88A8A', '#8AB4E8', '#D4A0E8']

function getAvatarText(name?: string) {
  const normalized = (name || '').trim()
  if (!normalized) return '微'
  // Use code-point aware split so emoji won't be cut into broken chars.
  return Array.from(normalized)[0] || '微'
}

export default function FamilyManagePage() {
  const userInfo = useAuthStore((state) => state.userInfo)
  const currentOpenId = userInfo?.openId || ''

  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showManageSheet, setShowManageSheet] = useState(false)
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null)

  useShareAppMessage(() => ({
    title: `${userInfo?.nickname || '家人'}邀请你加入乐学课表家庭共享`,
    path: `${ROUTES.INVITE_ACCEPT}?inviterOpenId=${currentOpenId}`,
  }))

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '家人管理' })
  }, [])

  useDidShow(() => {
    loadFamilyData()
  })

  const loadFamilyData = async () => {
    setLoading(true)
    try {
      const list = await familyApi.listMembers()
      setMembers(list || [])
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = () => {
    if (!currentOpenId) {
      Taro.showToast({ title: '请先登录后再邀请', icon: 'none' })
      return
    }
    Taro.showToast({ title: '点击右上角发送给家人', icon: 'none' })
  }

  const closeManageSheet = () => {
    setShowManageSheet(false)
    setTimeout(() => setSelectedMember(null), 200)
  }

  const handleRemoveMember = async () => {
    if (!selectedMember) return
    try {
      Taro.showLoading({ title: '处理中...', mask: true })
      await familyApi.removeMember(selectedMember.openid)
      Taro.hideLoading()
      Taro.showToast({ title: '已取消共享' })
      closeManageSheet()
      await loadFamilyData()
    } catch (err: any) {
      Taro.hideLoading()
      Taro.showToast({ title: err?.message || '操作失败', icon: 'none' })
    }
  }

  const getAvatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length]

  return (
    <View className='family-page'>
      <View className='family-tip'>
        <Text className='family-tip-text'>
          邀请家人后，对方将加入你的家长列表，并可查看、编辑你名下的全部学生、课表和课程。
        </Text>
      </View>

      <View className='family-count'>
        <Text className='family-count-text'>已共享给 {members.length} 位家人</Text>
      </View>

      {loading ? (
        <View className='family-loading'>
          <Text className='family-loading-text'>加载中...</Text>
        </View>
      ) : members.length === 0 ? (
        <View className='family-empty'>
          <Image
            className='family-empty-icon'
            src='../../assets/noData.png'
            mode='aspectFit'
          />
          <Text className='family-empty-text'>暂未邀请家人</Text>
        </View>
      ) : (
        <View className='family-list'>
          {members.map((member, index) => (
            <View
              key={member.openid}
              className='family-member'
              onClick={() => {
                setSelectedMember(member)
                setShowManageSheet(true)
              }}
            >
              <View className='member-left'>
                {member.avatar_url ? (
                  <Image
                    className='member-avatar-img'
                    src={member.avatar_url}
                    mode='aspectFill'
                  />
                ) : (
                  <View
                    className='member-avatar-placeholder'
                    style={{ background: getAvatarColor(index) }}
                  >
                    <Text className='member-avatar-text'>{getAvatarText(member.nickname)}</Text>
                  </View>
                )}
                <View className='member-detail'>
                  <Text className='member-nickname'>{member.nickname || '微信用户'}</Text>
                  <Text className='member-desc'>可查看并编辑全部共享信息</Text>
                </View>
              </View>
              <Text className='member-arrow'>›</Text>
            </View>
          ))}
        </View>
      )}

      <View className='family-bottom'>
        <Button className='family-invite-btn' openType='share' onClick={handleInvite}>
          <Text className='family-invite-text'>发起邀请</Text>
        </Button>
      </View>

      <PageContainer
        show={showManageSheet}
        position='bottom'
        round
        zIndex={1000}
        onClickOverlay={closeManageSheet}
        onAfterLeave={closeManageSheet}
      >
        <View className='edit-sheet-content'>
          <View className='edit-sheet-header'>
            <Text className='edit-sheet-title'>家人共享设置</Text>
            <View className='edit-sheet-close' onClick={closeManageSheet}>×</View>
          </View>
          <View className='edit-sheet-subtitle'>
            「{selectedMember?.nickname || '该成员'}」当前可查看并编辑你的全部共享信息。
          </View>
          <View className='invite-share-tip'>
            取消共享后，对方将立即失去对你的学生、课表和课程的访问权限。
          </View>
          <View className='edit-remove-btn' onClick={handleRemoveMember}>
            <Text className='edit-remove-text'>取消共享</Text>
          </View>
        </View>
      </PageContainer>
    </View>
  )
}
