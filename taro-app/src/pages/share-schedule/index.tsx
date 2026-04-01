import { View, Text, Image } from '@tarojs/components'
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
      const studentId = s.student_id || s.studentId || 'unknown'
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
      confirmColor: '#07c160',
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

  // A green refresh icon
  const refreshIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2307c160" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>'

  return (
    <View className='share-schedule-page'>
      <View className='header-card'>
        <View className='header-list'>
          <View className='header-item'>
            <Text className='dot'>•</Text>
            <Text className='text'>仅能分享自己创建的课表，每个课表有独立口令。</Text>
          </View>
          <View className='header-item'>
            <Text className='dot'>•</Text>
            <Text className='text'>分享后，任何人获得口令均可复制课表。</Text>
          </View>
          <View className='header-item'>
            <Text className='dot'>•</Text>
            <Text className='text'>
              <Text style={{ color: '#ff9c00', marginRight: '4px' }}>⚠️</Text>
              复制课表不会复制学生任何信息、不会复制老师电话。
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className='loading-wrap'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      ) : schedules.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty-text'>暂无可分享的课表</Text>
        </View>
      ) : (
        <View className='list-wrap'>
          {Object.entries(schedulesByStudent).map(([studentId, studentSchedules]) => {
            const studentName = studentId === 'unknown' ? '未知学生' : (studentNameMap[studentId] || '未知学生')
            return (
              <View key={studentId} className='student-group'>
                <Text className='student-name'>{studentName}</Text>
                
                {studentSchedules.map((schedule) => {
                  const sid = schedule.id || schedule._id || ''
                  const code = schedule.invite_code || schedule.inviteCode || ''
                  
                  return (
                    <View key={sid} className='schedule-card'>
                      <View className='card-top'>
                        <Text className='schedule-name'>{schedule.name || '未命名课表'}</Text>
                      </View>
                      
                      <View className='divider-item' />
                      
                      <View className='card-bottom'>
                        <View className='code-info'>
                          <Text className='code-label'>口令:</Text>
                          <Text className='code-value'>{formatCode(code) || '暂未生成'}</Text>
                          <Image 
                            className='refresh-icon' 
                            src={refreshIcon} 
                            onClick={() => handleRefreshCode(schedule)} 
                          />
                        </View>
                        <View className='copy-btn' onClick={() => handleCopyCode(code)}>
                          复制
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
