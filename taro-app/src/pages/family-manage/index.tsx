import { View, Text, Image, PageContainer } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import * as familyApi from '../../api/family.api'
import * as shareApi from '../../api/share.api'
import * as scheduleApi from '../../api/schedule.api'
import * as studentApi from '../../api/student.api'
import type { MemberInfo } from '../../api/family.api'
import type { Student, Schedule } from '../../types/index'
import './index.scss'

// 头像占位颜色列表
const AVATAR_COLORS = ['#A0A4F0', '#E8C86A', '#7EC8A0', '#E88A8A', '#8AB4E8', '#D4A0E8']

// 聚合后的家人信息（跨课表去重）
interface AggregatedMember {
  openid: string
  nickname: string
  avatar_url: string
  is_owner: boolean
  // 该家人可查看的学生列表
  visibleStudents: string[]
}

export default function FamilyManagePage() {
  const [aggregatedMembers, setAggregatedMembers] = useState<AggregatedMember[]>([])
  const [loading, setLoading] = useState(true)

  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const [inviteOptions, setInviteOptions] = useState<{studentId: string, studentName: string, scheduleId: string}[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('')

  useEffect(() => {
    loadFamilyData()
  }, [])

  // 加载所有课表 → 每个课表获取成员列表 → 聚合去重
  const loadFamilyData = async () => {
    setLoading(true)
    try {
      // 并行拉取课表列表和学生列表
      const [schedules, students] = await Promise.all([
        scheduleApi.listSchedules(),
        studentApi.listStudents(),
      ])

      if (!schedules || schedules.length === 0) {
        setAggregatedMembers([])
        setLoading(false)
        return
      }

      // 构建学生 id → 名称映射
      const studentMap: Record<string, string> = {}
      students.forEach((s: Student) => {
        studentMap[s.id] = s.name
      })

      // 构建课表 id → 学生名称映射
      const scheduleStudentMap: Record<string, string> = {}
      schedules.forEach((sch: Schedule) => {
        scheduleStudentMap[sch.id] = studentMap[sch.studentId] || '未知学生'
      })

      // 并行拉取所有课表的成员列表
      const memberResults = await Promise.all(
        schedules.map((sch: Schedule) =>
          familyApi.listMembers(sch.id)
            .then(members => ({ scheduleId: sch.id, members: members || [] }))
            .catch(() => ({ scheduleId: sch.id, members: [] as MemberInfo[] }))
        )
      )

      // 聚合：按 openid 去重，收集每个成员可查看的学生
      const memberAgg: Record<string, AggregatedMember> = {}

      for (const { scheduleId, members } of memberResults) {
        const studentName = scheduleStudentMap[scheduleId] || '未知学生'
        for (const m of members) {
          // 跳过 owner（即课表创建者自己），只展示被邀请的家人
          if (m.is_owner) continue

          if (!memberAgg[m.openid]) {
            memberAgg[m.openid] = {
              openid: m.openid,
              nickname: m.nickname,
              avatar_url: m.avatar_url,
              is_owner: false,
              visibleStudents: [],
            }
          }
          // 添加可查看的学生，避免重复
          if (!memberAgg[m.openid].visibleStudents.includes(studentName)) {
            memberAgg[m.openid].visibleStudents.push(studentName)
          }
        }
      }

      setAggregatedMembers(Object.values(memberAgg))
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 发起邀请
  const handleInvite = async () => {
    try {
      Taro.showLoading({ title: '加载中...' })
      const [schedules, students] = await Promise.all([
        scheduleApi.listSchedules(),
        studentApi.listStudents(),
      ])
      Taro.hideLoading()

      // listStudents 仅返回自己创建的学生
      const options: Array<{studentId: string, studentName: string, scheduleId: string}> = []
      students.forEach((student: Student) => {
        const studentSchedules = schedules.filter((s: Schedule) => s.studentId === student.id)
        if (studentSchedules.length > 0) {
          // 优先取默认课表，否则取第一个
          const targetSchedule = studentSchedules.find((s: Schedule) => s.isDefault) || studentSchedules[0]
          options.push({
            studentId: student.id,
            studentName: student.name,
            scheduleId: targetSchedule.id
          })
        }
      })

      if (options.length === 0) {
        Taro.showToast({ title: '请先创建属于自己的课表', icon: 'none' })
        return
      }

      setInviteOptions(options)
      setSelectedScheduleId(options[0].scheduleId)
      setShowInviteSheet(true)
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const closeInviteSheet = () => {
    setShowInviteSheet(false)
  }

  const confirmInvite = async () => {
    if (!selectedScheduleId) return
    closeInviteSheet()
    await doInvite(selectedScheduleId)
  }

  const doInvite = async (scheduleId: string) => {
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

  // 点击成员，可移除
  const handleMemberClick = (member: AggregatedMember) => {
    Taro.showActionSheet({
      itemList: ['移除该成员'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          Taro.showModal({
            title: '移除成员',
            content: `确定移除「${member.nickname}」吗？移除后将从所有课表中删除该成员的访问权限。`,
            confirmColor: '#FF5252',
            success: async (modalRes) => {
              if (modalRes.confirm) {
                try {
                  // 从所有课表中移除该成员
                  const schedules = await scheduleApi.listSchedules()
                  await Promise.all(
                    schedules.map(sch =>
                      familyApi.removeMember(sch.id, member.openid).catch(() => {})
                    )
                  )
                  Taro.showToast({ title: '已移除' })
                  await loadFamilyData()
                } catch {
                  Taro.showToast({ title: '操作失败', icon: 'none' })
                }
              }
            },
          })
        }
      },
    })
  }

  // 获取头像占位颜色
  const getAvatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length]

  return (
    <View className='family-page'>
      {/* 顶部说明 */}
      <View className='family-tip'>
        <Text className='family-tip-text'>
          邀请家人后，家人可查看你设定的课表数据范围。但是通知提醒需要每位家人自行打开开关。
        </Text>
      </View>

      {/* 成员数量标题 */}
      <View className='family-count'>
        <Text className='family-count-text'>对{aggregatedMembers.length}位家人开放</Text>
      </View>

      {loading ? (
        <View className='family-loading'>
          <Text className='family-loading-text'>加载中...</Text>
        </View>
      ) : aggregatedMembers.length === 0 ? (
        // 空状态
        <View className='family-empty'>
          <Image
            className='family-empty-icon'
            src='../../assets/noData.png'
            mode='aspectFit'
          />
          <Text className='family-empty-text'>暂未邀请家人</Text>
        </View>
      ) : (
        // 成员列表
        <View className='family-list'>
          {aggregatedMembers.map((member, index) => (
            <View
              key={member.openid}
              className='family-member'
              onClick={() => handleMemberClick(member)}
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
                  />
                )}
                <View className='member-detail'>
                  <Text className='member-nickname'>{member.nickname}</Text>
                  <Text className='member-desc'>
                    可查看{member.visibleStudents.join('、')}
                  </Text>
                </View>
              </View>
              <Text className='member-arrow'>›</Text>
            </View>
          ))}
        </View>
      )}

      {/* 底部邀请按钮 */}
      <View className='family-bottom'>
        <View className='family-invite-btn' onClick={handleInvite}>
          <Text className='family-invite-text'>发起邀请</Text>
        </View>
      </View>

      {/* 选择课表范围弹窗 */}
      <PageContainer
        show={showInviteSheet}
        position='bottom'
        round
        zIndex={1000}
        onClickOverlay={closeInviteSheet}
        onAfterLeave={closeInviteSheet}
      >
        <View className='invite-sheet-content'>
          <View className='invite-sheet-header'>
            <Text className='invite-sheet-title'>选择课表范围</Text>
            <View className='invite-sheet-close' onClick={closeInviteSheet}>×</View>
          </View>
          <View className='invite-sheet-subtitle'>
            选中后，被邀请人注册成功后可看的学生课表
          </View>
          <View className='invite-options-list'>
            {inviteOptions.map(option => (
              <View
                key={option.scheduleId}
                className={`invite-option ${selectedScheduleId === option.scheduleId ? 'active' : ''}`}
                onClick={() => setSelectedScheduleId(option.scheduleId)}
              >
                <Text className='invite-option-text'>{option.studentName}</Text>
              </View>
            ))}
          </View>
          <View className='invite-confirm-btn' onClick={confirmInvite}>
            <Text className='invite-confirm-text'>发起邀请</Text>
          </View>
        </View>
      </PageContainer>
    </View>
  )
}

