import { View, Text, Image } from '@tarojs/components'
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
    // 获取课表列表，选择要共享的课表
    try {
      const schedules = await scheduleApi.listSchedules()
      if (!schedules || schedules.length === 0) {
        Taro.showToast({ title: '请先创建课表', icon: 'none' })
        return
      }

      // 如果只有一个课表，直接邀请
      if (schedules.length === 1) {
        await doInvite(schedules[0].id)
        return
      }

      // 多个课表时让用户选择
      const students = await studentApi.listStudents()
      const studentMap: Record<string, string> = {}
      students.forEach((s: Student) => { studentMap[s.id] = s.name })

      const names = schedules.map(s => `${studentMap[s.studentId] || '未知'}的${s.name}`)
      Taro.showActionSheet({
        itemList: names,
        success: async (res) => {
          await doInvite(schedules[res.tapIndex].id)
        },
      })
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
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
    </View>
  )
}
