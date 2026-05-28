import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { listSchedules, refreshInviteCode } from '../../api/schedule.api'
import { listStudents } from '../../api/student.api'
import type { Schedule, Student } from '../../types/index'
import './index.scss'

export default function ShareSchedulePage() {
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const studentNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of students) map[s.id] = s.name
    return map
  }, [students])

  const schedulesByStudent = useMemo(() => {
    const map: Record<string, Schedule[]> = {}
    schedules.forEach(s => {
      const studentId = s.student_id || 'unknown'
      if (!map[studentId]) map[studentId] = []
      map[studentId].push(s)
    })
    return map
  }, [schedules])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [scheduleList, studentList] = await Promise.all([listSchedules(), listStudents()])
      setSchedules(scheduleList)
      setStudents(studentList)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useDidShow(() => {
    fetchData()
  })

  const handleCopyCode = (code?: string) => {
    if (!code) {
      Taro.showToast({ title: '该课表暂未生成口令', icon: 'none' })
      return
    }

    Taro.setClipboardData({
      data: code,
      success: () => Taro.showToast({ title: '口令已复制', icon: 'success' }),
    })
  }

  const handleRefreshCode = (schedule: Schedule) => {
    const sid = schedule.id || schedule._id || ''
    Taro.showModal({
      title: '',
      content: '更换新口令后，旧口令将无法复制课表，确认继续？',
      confirmText: '更换',
      confirmColor: '#3b82f6',
      cancelText: '取消',
      cancelColor: '#000000',
      success: async (res) => {
        if (res.confirm) {
          try {
            Taro.showLoading({ title: '正在更换' })
            const { invite_code } = await refreshInviteCode(sid)
            // Update local state
            setSchedules(prev => prev.map(s => {
              if ((s.id || s._id) === sid) {
                return { ...s, invite_code, inviteCode: invite_code }
              }
              return s
            }))
            Taro.hideLoading()
            handleCopyCode(invite_code)
          } catch (error: any) {
            Taro.hideLoading()
            Taro.showToast({ title: error.message || '更换失败', icon: 'none' })
          }
        }
      }
    })
  }

  const formatCode = (code: string) => {
    if (!code) return ''
    if (code.length === 8) {
      return `${code.slice(0, 4)} ${code.slice(4)}`
    }
    return code
  }

  const refreshIcon = '↻'

  return (
    <View className='share-schedule-page'>
      <View className='page-shell'>
        <View className='page-hero'>
          <Text className='page-title'>分享课表</Text>
          <Text className='page-desc'>将课表口令复制给家人或同学，即可快速同步相同排课。</Text>
          <View className='tip-card'>
            <View className='tip-item'>
              <View className='tip-bullet' />
              <Text className='tip-text'>仅能分享自己创建的课表，每个课表有独立口令。</Text>
            </View>
            <View className='tip-item'>
              <View className='tip-bullet' />
              <Text className='tip-text'>分享后，任何人获得口令均可复制课表。</Text>
            </View>
            <View className='tip-warn'>
              <Text className='tip-warn-icon'>⚠</Text>
              <Text className='tip-warn-text'>复制课表不会复制学生任何信息，也不会复制老师电话。</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View className='loading-strip' aria-label='加载中'>
            <View className='loading-track'>
              <View className='loading-bar' />
            </View>
          </View>
        ) : schedules.length === 0 ? (
          <View className='empty-state'>
            <View className='empty-badge'>未找到</View>
            <Text className='empty-title'>暂无可分享的课表</Text>
            <Text className='empty-desc'>先创建一份课表，再回来复制分享口令。</Text>
          </View>
        ) : (
          <View className='schedule-groups'>
            {Object.entries(schedulesByStudent).map(([studentId, studentSchedules]) => {
              const studentName = studentId === 'unknown' ? '未知学生' : (studentNameMap[studentId] || '未知学生')
              return (
                <View key={studentId} className='student-group'>
                  <View className='student-head'>
                    <Text className='student-name'>{studentName}</Text>
                    <Text className='student-count'>{studentSchedules.length} 个课表</Text>
                  </View>

                  <View className='schedule-list'>
                    {studentSchedules.map((schedule) => {
                      const sid = schedule.id || schedule._id || ''
                      const code = schedule.invite_code || schedule.inviteCode || ''

                      return (
                        <View key={sid} className='schedule-card'>
                          <View className='schedule-card-top'>
                            <Text className='schedule-name'>{schedule.name || '未命名课表'}</Text>
                            <Text className='schedule-tag'>{code ? '已生成口令' : '未生成'}</Text>
                          </View>

                          <View className='schedule-divider' />

                          <View className='schedule-code-row'>
                            <View className='code-meta'>
                              <Text className='code-label'>口令</Text>
                              <Text className='code-value'>{formatCode(code) || '暂未生成'}</Text>
                            </View>

                            <View className='code-actions'>
                              <View className='icon-btn' onClick={() => handleRefreshCode(schedule)}>
                                <Text className='refresh-icon'>{refreshIcon}</Text>
                              </View>
                              <View className='copy-btn' onClick={() => handleCopyCode(code)}>
                                复制
                              </View>
                            </View>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </View>
  )
}
