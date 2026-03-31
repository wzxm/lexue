import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAuthStore } from '../../store/auth.store'
import { useScheduleStore } from '../../store/schedule.store'
import { useStudentStore } from '../../store/student.store'
import { ROUTES } from '../../constants/routes'
import { listSchedules, deleteSchedule } from '../../api/schedule.api'
import noDataImg from '../../assets/noData.png'
import './index.scss'
import { useMemo, useState } from 'react'
import type { Schedule } from '../../types/index'

export default function ScheduleManagePage() {
  const userInfo = useAuthStore(s => s.userInfo)
  const schedules = useScheduleStore(s => s.schedules)
  const setSchedules = useScheduleStore(s => s.setSchedules)
  const students = useStudentStore(s => s.students)
  
  const [loading, setLoading] = useState(false)

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const data = await listSchedules()
      setSchedules(data)
    } catch (e: any) {
      Taro.showToast({ title: e.message || '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useDidShow(() => {
    fetchSchedules()
  })

  const goAddSchedule = () => {
    Taro.navigateTo({ url: ROUTES.SCHEDULE_FORM })
  }

  const goEditSchedule = (id: string) => {
    Taro.navigateTo({ url: `${ROUTES.SCHEDULE_FORM}?id=${id}` })
  }

  const goStudentManage = () => {
    Taro.navigateTo({ url: ROUTES.STUDENT_MANAGE })
  }

  const handleDelete = async (e: any, schedule: Schedule) => {
    e.stopPropagation()
    const res = await Taro.showModal({
      title: '删除课表',
      content: '确定要删除这份课表吗？删除后将无法恢复。',
      confirmColor: '#FF4D4F'
    })
    if (res.confirm) {
      try {
        Taro.showLoading({ title: '删除中' })
        const scheduleId = schedule.id || schedule._id
        if (!scheduleId) {
          Taro.showToast({ title: '课表ID异常，无法删除', icon: 'none' })
          return
        }
        await deleteSchedule(scheduleId)
        Taro.showToast({ title: '删除成功', icon: 'success' })
        fetchSchedules()
      } catch (err: any) {
        Taro.showToast({ title: err.message || '删除失败', icon: 'none' })
      } finally {
        Taro.hideLoading()
      }
    }
  }

  const handleExitShare = async (e: any, schedule: Schedule) => {
    e.stopPropagation()
    const res = await Taro.showModal({
      title: '退出共享',
      content: '确定要退出该共享课表吗？',
      confirmColor: '#FF4D4F'
    })
    if (res.confirm) {
      Taro.showToast({ title: '退出共享(需完善API)', icon: 'none' })
      // TODO: implement exit share API
    }
  }

  const groupedSchedules = useMemo(() => {
    const map = new Map<string, { studentName: string, isShared: boolean, ownerName?: string, items: Schedule[] }>()
    for (const s of schedules) {
      const isOwner = !s.owner_openid || s.owner_openid === userInfo?.openId
      const studentInfo = students.find(st => st.id === (s.studentId || s.student_id))
      const key = s.studentId || s.student_id || 'unknown'
      
      if (!map.has(key)) {
        let stuName = studentInfo?.name || '未知学生'
        map.set(key, { 
          studentName: stuName, 
          isShared: !isOwner,
          ownerName: !isOwner ? '他人' : undefined,
          items: [] 
        })
      }
      map.get(key)!.items.push(s)
    }
    return Array.from(map.values())
  }, [schedules, students, userInfo])

  return (
    <View className='schedule-manage-page'>
      <View className='header-hints'>
        <View className='hint-item'>
          <View className='dot' />
          <Text>支持多位学生的课表管理，适用于多孩家庭。</Text>
        </View>
        <View className='hint-item'>
          <View className='dot' />
          <Text>共享课表不支持修改，请联系分享人。</Text>
        </View>
      </View>

      {schedules.length === 0 && !loading ? (
        <View className='empty-state'>
          <Image className='empty-img' src={noDataImg} mode='aspectFit' />
          <Text className='empty-text'>暂无课表数据</Text>
          <View className='add-btn' onClick={goAddSchedule}>
            新增课表
          </View>
        </View>
      ) : (
        <View className='list-container'>
          <View className='list-header'>
            <Text className='count-text'>共{schedules.length}份课表</Text>
            <Text className='student-manage-link' onClick={goStudentManage}>学生管理</Text>
          </View>

          {groupedSchedules.map((group, idx) => (
            <View key={idx} className='student-group'>
              <View className='student-name'>
                {group.studentName}
                {group.isShared && <Text className='shared-tag'>({group.ownerName}共享)</Text>}
              </View>
              
              <View className='schedule-cards'>
                {group.items.map(schedule => {
                  const isOwner = !schedule.owner_openid || schedule.owner_openid === userInfo?.openId;
                  
                  return (
                    <View className='schedule-card-wrap' key={schedule.id || schedule._id}>
                      <View 
                        className='schedule-card' 
                        onClick={() => {
                          if (isOwner) goEditSchedule(schedule.id || schedule._id!)
                        }}
                      >
                        <View className='card-left'>
                          <Text className='card-title'>{schedule.semester || schedule.name}</Text>
                          <Text className='card-subtitle'>20周</Text>
                        </View>
                        <View className='card-right'>
                          {isOwner && <Text className='arrow-icon'>›</Text>}
                        </View>
                      </View>
                      
                      {isOwner ? (
                        <View className='action-btn action-delete' onClick={(e) => handleDelete(e, schedule)}>
                          <Text className='iconfont'>&#xe60a;</Text>
                        </View>
                      ) : (
                        <View className='action-btn action-exit' onClick={(e) => handleExitShare(e, schedule)}>
                          <Text className='iconfont'>&#xe60b;</Text>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            </View>
          ))}

          <View className='bottom-btn-wrap'>
            <View className='add-btn' onClick={goAddSchedule}>
              新增课表
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
