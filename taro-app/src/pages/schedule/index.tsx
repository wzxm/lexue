import { View, Text, ScrollView, Button } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { useScheduleStore, buildGrid } from '../../store/schedule.store'
import { useStudentStore } from '../../store/student.store'
import { useAuthStore } from '../../store/auth.store'
import { listStudents } from '../../api/student.api'
import { listSchedules, getSchedule } from '../../api/schedule.api'
import { deleteCourse } from '../../api/course.api'
import { getWeekDates, formatShortDate } from '../../utils/date'
import { ROUTES } from '../../constants/routes'
import { DEFAULT_PERIODS } from '../../constants/periods'
import type { Course, ScheduleGrid as ScheduleGridType } from '../../types/index'
import './index.scss'

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default function SchedulePage() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const { students, currentStudent, setStudents } = useStudentStore()
  const {
    currentSchedule, weekOffset,
    setSchedules, setCurrentSchedule, setWeekOffset, removeCourse: removeCourseFromStore,
  } = useScheduleStore()

  const [grid, setGrid] = useState<ScheduleGridType>([])
  const [weekDates, setWeekDates] = useState<string[]>([])
  const [weekLabel, setWeekLabel] = useState('')
  const [weekNum, setWeekNum] = useState(1)
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  const periods = currentSchedule?.periods || DEFAULT_PERIODS
  const today = new Date().toISOString().slice(0, 10)

  const syncView = useCallback(() => {
    const offset = useScheduleStore.getState().weekOffset
    const schedule = useScheduleStore.getState().currentSchedule
    const dates = getWeekDates(offset)
    const num = Math.abs(offset) + 1
    const start = formatShortDate(dates[0])
    const end = formatShortDate(dates[6])

    setGrid(buildGrid(schedule, offset))
    setWeekDates(dates)
    setWeekLabel(`第${num}周 ${start}-${end}`)
    setWeekNum(num)
  }, [])

  useEffect(() => {
    if (!isLoggedIn) {
      Taro.reLaunch({ url: ROUTES.LOGIN })
      return
    }
    loadData()
    // 订阅 store 变化
    const unsub = useScheduleStore.subscribe(syncView)
    return () => unsub()
  }, [])

  // onShow 等效：useDidShow
  Taro.useDidShow(() => syncView())

  const loadData = async () => {
    Taro.showLoading({ title: '加载中', mask: true })
    try {
      const studentList = await listStudents()
      setStudents(studentList)
      const cur = useStudentStore.getState().currentStudent
      if (!cur) {
        Taro.hideLoading()
        Taro.showModal({
          title: '还没有学生', content: '先添加一个学生吧',
          confirmText: '去添加', showCancel: false,
          success: () => Taro.navigateTo({ url: ROUTES.STUDENT_FORM }),
        })
        return
      }
      const schedules = await listSchedules(cur.id)
      setSchedules(schedules)
      const defaultSchedule = schedules.find(s => s.isDefault) || schedules[0]
      if (defaultSchedule) {
        const full = await getSchedule(defaultSchedule.id)
        setCurrentSchedule(full)
      }
      syncView()
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none', duration: 3000 })
    } finally {
      Taro.hideLoading()
    }
  }

  const onTapEmpty = (weekday: number, period: number) => {
    if (!currentSchedule) {
      Taro.showToast({ title: '请先创建课表', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `${ROUTES.COURSE_FORM}?mode=add&weekday=${weekday}&period=${period}&scheduleId=${currentSchedule.id}` })
  }

  const onTapCourse = (course: Course) => {
    setSelectedCourse(course)
    setShowCourseModal(true)
  }

  const onEditCourse = () => {
    if (!selectedCourse) return
    setShowCourseModal(false)
    Taro.navigateTo({ url: `${ROUTES.COURSE_FORM}?mode=edit&courseId=${selectedCourse.id}` })
  }

  const onDeleteCourse = async () => {
    if (!selectedCourse) return
    const { confirm } = await Taro.showModal({ title: '删除课程', content: `确认删除「${selectedCourse.name}」？` })
    if (!confirm) return
    try {
      await deleteCourse(selectedCourse.id)
      removeCourseFromStore(selectedCourse.id)
      setShowCourseModal(false)
      setSelectedCourse(null)
      Taro.showToast({ title: '已删除' })
    } catch (err: any) {
      Taro.showToast({ title: err.message, icon: 'none' })
    }
  }

  const onAddCourse = () => {
    if (!currentSchedule) {
      Taro.navigateTo({ url: ROUTES.SCHEDULE_FORM })
      return
    }
    Taro.navigateTo({ url: `${ROUTES.COURSE_FORM}?mode=add&scheduleId=${currentSchedule.id}` })
  }

  // 空状态
  if (!currentSchedule) {
    return (
      <View className='schedule-page'>
        <View className='empty-guide'>
          <View className='guide-header'>
            <Text className='guide-title'>😊 欢迎使用乐学课表</Text>
            <View className='guide-placeholder' />
            <Text className='guide-subtitle'>课表亮点功能</Text>
          </View>
          <View className='guide-body'>
            <View className='feature-grid'>
              {[
                { icon: '🔔', name: '微信通知', desc: '提前提醒家人接送' },
                { icon: '🔗', name: '课表共享', desc: '家人随时查看孩子课程' },
                { icon: '📅', name: '课周定位', desc: '不怕单双周记不住' },
                { icon: '👨‍👩‍👧', name: '多孩管理', desc: '多个孩子课表轻松管理' },
              ].map(f => (
                <View key={f.name} className='feature-item'>
                  <View className='feature-icon-wrap'><Text className='feature-icon'>{f.icon}</Text></View>
                  <Text className='feature-name'>{f.name}</Text>
                  <Text className='feature-desc'>{f.desc}</Text>
                </View>
              ))}
            </View>
            <Button className='create-btn' onClick={onAddCourse}>创建课表（约耗时1分钟）</Button>
          </View>
        </View>
      </View>
    )
  }

  // 有数据
  return (
    <View className='schedule-page'>
      <View className='schedule-view'>
        <View className='header'>
          <View className='header-left'>
            <View className='header-icons'>
              <Text className='header-icon-btn'>📋</Text>
              <Text className='header-icon-btn'>➕</Text>
            </View>
          </View>
          <View className='header-center'>
            <Text className='student-name'>{currentStudent?.name || '未选择学生'} ⇌</Text>
            <Text className='student-sub'>{currentSchedule.name}</Text>
          </View>
          <View className='header-right' />
        </View>

        <View className='grid-wrap'>
          <View className='week-corner' onClick={() => setWeekOffset(0)}>
            <Text className='week-corner-text'>第{weekNum}周 ▾</Text>
          </View>

          <View className='grid-header-row'>
            {WEEKDAY_LABELS.map((label, idx) => (
              <View key={label} className={`grid-header-cell ${weekDates[idx] === today ? 'grid-header-cell--today' : ''}`}>
                <Text className='grid-header-day'>{label}</Text>
                <Text className='grid-header-date'>{weekDates[idx]?.slice(5).replace('-', '-') || ''}</Text>
              </View>
            ))}
          </View>

          <ScrollView scrollY className='grid-body'>
            {periods.map((period, pIdx) => (
              <View key={period.index} className='grid-row'>
                <View className='period-cell'>
                  <Text className='period-num'>{period.index}</Text>
                  <Text className='period-time-line'>{period.startTime}</Text>
                  <Text className='period-time-line'>{period.endTime}</Text>
                </View>
                {Array.from({ length: 7 }, (_, dIdx) => {
                  const course = grid[pIdx]?.[dIdx] || null
                  const cellIsToday = weekDates[dIdx] === today
                  return (
                    <View key={dIdx} className={`course-cell-wrap ${cellIsToday ? 'course-cell-wrap--today' : ''}`}>
                      {course ? (
                        <View
                          className='course-block'
                          style={{
                            background: course.color ? `${course.color}22` : '#C8F0D8',
                            color: course.color || '#00C853',
                          }}
                          onClick={() => onTapCourse(course)}
                        >
                          <Text className='course-block-name'>{course.name}</Text>
                        </View>
                      ) : (
                        <View className='empty-cell' onClick={() => onTapEmpty(dIdx + 1, pIdx + 1)} />
                      )}
                    </View>
                  )
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* 课程详情 Modal */}
      {showCourseModal && selectedCourse && (
        <View className='modal-mask' onClick={() => setShowCourseModal(false)}>
          <View className='modal-content' onClick={(e) => e.stopPropagation()}>
            <View className='modal-drag-bar' />
            <View className='modal-header'>
              <Text className='modal-title'>{selectedCourse.name}</Text>
              <View className='modal-close' onClick={() => setShowCourseModal(false)}><Text>✕</Text></View>
            </View>
            <View className='modal-body'>
              {selectedCourse.teacher && (
                <View className='info-row'>
                  <Text className='info-label'>👩‍🏫 老师</Text>
                  <Text className='info-value'>{selectedCourse.teacher}</Text>
                </View>
              )}
              {selectedCourse.classroom && (
                <View className='info-row'>
                  <Text className='info-label'>🏫 教室</Text>
                  <Text className='info-value'>{selectedCourse.classroom}</Text>
                </View>
              )}
              <View className='info-row'>
                <Text className='info-label'>🕐 时间</Text>
                <Text className='info-value'>第{selectedCourse.period}节</Text>
              </View>
              {selectedCourse.note && (
                <View className='info-row'>
                  <Text className='info-label'>📝 备注</Text>
                  <Text className='info-value'>{selectedCourse.note}</Text>
                </View>
              )}
            </View>
            <View className='modal-footer'>
              <Button className='btn-edit' onClick={onEditCourse}>修改</Button>
              <Button className='btn-delete' onClick={onDeleteCourse}>删除</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
