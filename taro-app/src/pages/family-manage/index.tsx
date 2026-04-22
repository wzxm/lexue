import { View, Text, Image, PageContainer, Button } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import * as familyApi from '../../api/family.api'
import * as shareApi from '../../api/share.api'
import * as scheduleApi from '../../api/schedule.api'
import * as studentApi from '../../api/student.api'
import type { MemberInfo } from '../../api/family.api'
import type { Student, Schedule } from '../../types/index'
import { ROUTES } from '../../constants/routes'
import './index.scss'

const AVATAR_COLORS = ['#A0A4F0', '#E8C86A', '#7EC8A0', '#E88A8A', '#8AB4E8', '#D4A0E8']

interface AggregatedMember {
  openid: string
  nickname: string
  avatar_url: string
  is_owner: boolean
  visibleStudents: string[]
}

interface InviteOption {
  studentId: string
  studentName: string
  scheduleCount: number
}

export default function FamilyManagePage() {
  const [aggregatedMembers, setAggregatedMembers] = useState<AggregatedMember[]>([])
  const [loading, setLoading] = useState(true)

  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const [inviteStep, setInviteStep] = useState<'select' | 'share'>('select')
  const [inviteOptions, setInviteOptions] = useState<InviteOption[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [pendingToken, setPendingToken] = useState('')

  const [showEditSheet, setShowEditSheet] = useState(false)
  const [editingMember, setEditingMember] = useState<AggregatedMember | null>(null)
  const [editStudentIds, setEditStudentIds] = useState<string[]>([])
  const [ownStudents, setOwnStudents] = useState<Student[]>([])
  const [editSaving, setEditSaving] = useState(false)

  const selectedOption = inviteOptions.find(o => o.studentId === selectedStudentId) || null

  // 微信分享回调：分享卡片时取当前状态生成 path（path 需以 / 开头）
  useShareAppMessage(() => {
    const option = inviteOptions.find(o => o.studentId === selectedStudentId)
    const studentName = option?.studentName || '家人'
    const title = `${studentName}的课表已为你开启共享`
    const path = pendingToken
      ? `${ROUTES.INVITE_ACCEPT}?token=${pendingToken}`
      : ROUTES.SCHEDULE
    return { title, path }
  })

  useEffect(() => {
    loadFamilyData()
  }, [])

  const loadFamilyData = async () => {
    setLoading(true)
    try {
      const [schedules, students] = await Promise.all([
        scheduleApi.listSchedules(),
        studentApi.listStudents(),
      ])

      if (!schedules || schedules.length === 0) {
        setAggregatedMembers([])
        setLoading(false)
        return
      }

      const studentMap: Record<string, string> = {}
      students.forEach((s: Student) => { studentMap[s.id] = s.name })

      const scheduleStudentMap: Record<string, string> = {}
      schedules.forEach((sch: Schedule) => {
        const sid = sch.studentId || sch.student_id || ''
        scheduleStudentMap[sch.id] = studentMap[sid] || '未知学生'
      })

      const memberResults = await Promise.all(
        schedules.map((sch: Schedule) =>
          familyApi.listMembers(sch.id)
            .then(members => ({ scheduleId: sch.id, members: members || [] }))
            .catch(() => ({ scheduleId: sch.id, members: [] as MemberInfo[] }))
        )
      )

      const memberAgg: Record<string, AggregatedMember> = {}

      for (const { scheduleId, members } of memberResults) {
        const studentName = scheduleStudentMap[scheduleId] || '未知学生'
        for (const m of members) {
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

  const handleInvite = async () => {
    try {
      Taro.showLoading({ title: '加载中...' })
      const [schedules, students] = await Promise.all([
        scheduleApi.listSchedules(),
        studentApi.listStudents(),
      ])
      Taro.hideLoading()

      // 仅允许分享自己创建的学生（排除他人共享给我的学生）
      const ownStudents = students.filter((student: Student) => !student.isShared)
      const ownStudentIdSet = new Set(ownStudents.map(s => s.id))

      // 按学生聚合其名下的课表数量（同样限定为自己名下的学生 id）
      const options: InviteOption[] = []
      ownStudents.forEach((student: Student) => {
        const studentSchedules = schedules.filter((s: Schedule) => {
          const scheduleStudentId = s.studentId || s.student_id || ''
          return scheduleStudentId === student.id && ownStudentIdSet.has(scheduleStudentId)
        })
        if (studentSchedules.length > 0) {
          options.push({
            studentId: student.id,
            studentName: student.name,
            scheduleCount: studentSchedules.length,
          })
        }
      })

      if (options.length === 0) {
        Taro.showToast({ title: '请先创建属于自己的课表', icon: 'none' })
        return
      }

      setInviteOptions(options)
      setSelectedStudentId(options[0].studentId)
      setPendingToken('')
      setInviteStep('select')
      setShowInviteSheet(true)
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const closeInviteSheet = () => {
    setShowInviteSheet(false)
    setTimeout(() => {
      setInviteStep('select')
      setPendingToken('')
    }, 200)
  }

  // 第一步：确认学生后生成邀请 token，进入分享步骤
  const confirmSelectStudent = async () => {
    if (!selectedStudentId) {
      Taro.showToast({ title: '请选择一位学生', icon: 'none' })
      return
    }
    Taro.showLoading({ title: '生成邀请中...', mask: true })
    try {
      const res = await shareApi.generateInvite(selectedStudentId)
      setPendingToken(res.token)
      setInviteStep('share')
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '生成失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const onShareButtonClick = () => {
    // 分享卡片发出后（由微信回调触发 useShareAppMessage），提示用户
    // 此处仅做埋点与兜底
    if (!pendingToken) {
      Taro.showToast({ title: '邀请数据异常，请重试', icon: 'none' })
    }
  }

  const handleMemberClick = async (member: AggregatedMember) => {
    try {
      Taro.showLoading({ title: '加载中...' })
      const [, students] = await Promise.all([
        scheduleApi.listSchedules(),
        studentApi.listStudents(),
      ])
      Taro.hideLoading()

      const myStudents = students.filter((s: Student) => !s.isShared)

      // 根据 visibleStudents（学生名列表）找出对应的学生 id
      const currentIds = myStudents
        .filter((s: Student) => member.visibleStudents.includes(s.name))
        .map((s: Student) => s.id)

      setOwnStudents(myStudents)
      setEditStudentIds(currentIds)
      setEditingMember(member)
      setShowEditSheet(true)
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }

  const closeEditSheet = () => {
    setShowEditSheet(false)
    setTimeout(() => {
      setEditingMember(null)
      setEditStudentIds([])
      setOwnStudents([])
    }, 200)
  }

  const toggleEditStudent = (id: string) => {
    setEditStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const confirmEditStudents = async () => {
    if (!editingMember) return
    setEditSaving(true)
    try {
      await familyApi.updateMemberStudents(editingMember.openid, editStudentIds)
      Taro.showToast({ title: '修改成功' })
      closeEditSheet()
      await loadFamilyData()
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '修改失败', icon: 'none' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleRemoveMember = () => {
    if (!editingMember) return
    const member = editingMember
    Taro.showModal({
      title: '取消共享',
      content: `确定取消与「${member.nickname}」的共享吗？将从所有课表中移除该成员的访问权限。`,
      confirmColor: '#ef4444',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          try {
            const schedules = await scheduleApi.listSchedules()
            await Promise.all(
              schedules.map((sch: Schedule) =>
                familyApi.removeMember(sch.id, member.openid).catch(() => {})
              )
            )
            Taro.showToast({ title: '已取消共享' })
            closeEditSheet()
            await loadFamilyData()
          } catch {
            Taro.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      },
    })
  }

  const getAvatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length]

  return (
    <View className='family-page'>
      <View className='family-tip'>
        <Text className='family-tip-text'>
          邀请家人后，家人可查看你设定的课表数据范围。但是通知提醒需要每位家人自行打开开关。
        </Text>
      </View>

      <View className='family-count'>
        <Text className='family-count-text'>对{aggregatedMembers.length}位家人开放</Text>
      </View>

      {loading ? (
        <View className='family-loading'>
          <Text className='family-loading-text'>加载中...</Text>
        </View>
      ) : aggregatedMembers.length === 0 ? (
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

      <View className='family-bottom'>
        <View className='family-invite-btn' onClick={handleInvite}>
          <Text className='family-invite-text'>发起邀请</Text>
        </View>
      </View>

      {/* 发起邀请弹窗：分两步 - 选择学生 → 生成邀请后点按钮分享卡片 */}
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
            <Text className='invite-sheet-title'>
              {inviteStep === 'select' ? '选择要共享的学生' : '分享邀请卡片'}
            </Text>
            <View className='invite-sheet-close' onClick={closeInviteSheet}>×</View>
          </View>

          {inviteStep === 'select' ? (
            <>
              <View className='invite-sheet-subtitle'>
                选中学生后，其名下全部课表将共享给被邀请人。
              </View>
              <View className='invite-options-list'>
                {inviteOptions.map(option => (
                  <View
                    key={option.studentId}
                    className={`invite-option ${selectedStudentId === option.studentId ? 'active' : ''}`}
                    onClick={() => setSelectedStudentId(option.studentId)}
                  >
                    <Text className='invite-option-text'>
                      {option.studentName}（{option.scheduleCount}份课表）
                    </Text>
                  </View>
                ))}
              </View>
              <View className='invite-confirm-btn' onClick={confirmSelectStudent}>
                <Text className='invite-confirm-text'>下一步</Text>
              </View>
            </>
          ) : (
            <>
              <View className='invite-sheet-subtitle'>
                点击下方按钮，调起微信分享将 <Text className='invite-strong'>{selectedOption?.studentName}</Text> 及名下 <Text className='invite-strong'>{selectedOption?.scheduleCount}</Text> 份课表分享给家人。
              </View>
              <View className='invite-share-tip'>
                家人点击卡片即可打开邀请详情页并一键接收。
              </View>
              <Button
                className='invite-share-btn'
                openType='share'
                onClick={onShareButtonClick}
              >
                分享给家人
              </Button>
            </>
          )}
        </View>
      </PageContainer>

      {/* 修改课表范围弹窗 */}
      <PageContainer
        show={showEditSheet}
        position='bottom'
        round
        zIndex={1000}
        onClickOverlay={closeEditSheet}
        onAfterLeave={closeEditSheet}
      >
        <View className='edit-sheet-content'>
          <View className='edit-sheet-header'>
            <Text className='edit-sheet-title'>修改课表范围</Text>
            <View className='edit-sheet-close' onClick={closeEditSheet}>×</View>
          </View>
          <View className='edit-sheet-subtitle'>
            修改「{editingMember?.nickname}」可看的学生课表
          </View>
          <View className='edit-student-list'>
            {ownStudents.map(student => {
              const checked = editStudentIds.includes(student.id)
              return (
                <View
                  key={student.id}
                  className={`edit-student-item ${checked ? 'checked' : ''}`}
                  onClick={() => toggleEditStudent(student.id)}
                >
                  <Text className='edit-student-name'>{student.name}</Text>
                  {checked && <Text className='edit-student-check'>✓</Text>}
                </View>
              )
            })}
          </View>
          <View
            className={`edit-confirm-btn ${editSaving ? 'disabled' : ''}`}
            onClick={editSaving ? undefined : confirmEditStudents}
          >
            <Text className='edit-confirm-text'>{editSaving ? '保存中...' : '确认修改'}</Text>
          </View>
          <View className='edit-remove-btn' onClick={handleRemoveMember}>
            <Text className='edit-remove-text'>取消共享</Text>
          </View>
        </View>
      </PageContainer>
    </View>
  )
}
