import { View, Text } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { tabState } from '../../utils/tabState'
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

import EmptyState from './components/EmptyState'
import EmptySchedule from './components/EmptySchedule'
import ScheduleGrid from './components/ScheduleGrid'
import CourseModal from './components/CourseModal'

import './index.scss'

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

  const windowInfo = Taro.getWindowInfo()
  const menuButtonInfo = Taro.getMenuButtonBoundingClientRect()

  // 状态栏高度
  const statusBarHeight = windowInfo.statusBarHeight || 0
  // 导航栏高度
  const navBarHeight = (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height

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
    if (!isLoggedIn) return
    loadData()
    const unsub = useScheduleStore.subscribe(syncView)
    return () => unsub()
  }, [isLoggedIn])

  Taro.useDidShow(() => {
    syncView()
    tabState.setSelected(0)
    if (useAuthStore.getState().isLoggedIn) {
      loadData()
    }
  })

  const loadData = async () => {
    Taro.showLoading({ title: '加载中', mask: true })
    try {
      const studentList = await listStudents()
      setStudents(studentList)
      const cur = useStudentStore.getState().currentStudent
      if (!cur) {
        setSchedules([])
        setCurrentSchedule(null)
        syncView()
        return
      }
      const schedules = await listSchedules(cur.id)
      setSchedules(schedules)
      const defaultSchedule = schedules.find(s => s.isDefault) || schedules[0]
      if (defaultSchedule) {
        const full = await getSchedule(defaultSchedule.id)
        setCurrentSchedule(full)
      } else {
        setCurrentSchedule(null)
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
    if (!isLoggedIn) {
      Taro.navigateTo({ url: ROUTES.LOGIN })
      return
    }
    if (!currentSchedule) {
      Taro.navigateTo({ url: ROUTES.SCHEDULE_FORM })
      return
    }
    Taro.navigateTo({ url: `${ROUTES.COURSE_FORM}?mode=add&scheduleId=${currentSchedule.id}` })
  }

  if (!isLoggedIn || !currentSchedule) {
    return (
      <View className='schedule-page empty-page'>
        <View className='custom-nav-bg' />
        <View
          className='custom-nav-bar'
          style={{
            paddingTop: `${menuButtonInfo.top}px`,
          }}
        >
          <View className='nav-title-wrap' style={{ height: `${menuButtonInfo.height}px` }}>
            <Text className='nav-title'>😊 欢迎使用乐学课表</Text>
          </View>
        </View>

        {/* <View style={{ flexShrink: 0, height: `${navBarHeight}px` }} /> */}
        <EmptyState onAddCourse={onAddCourse} />
      </View>
    )
  }

  // 有数据
  const hasCourses = currentSchedule.courses && currentSchedule.courses.length > 0;

  return (
    <View className='schedule-page'>
      <View className='custom-nav-bg' />
        <View
          className='custom-nav-bar'
          style={{
            paddingTop: `${statusBarHeight}px`,
            height: `${navBarHeight}px`,
            paddingRight: `${windowInfo.windowWidth - menuButtonInfo.left}px`
          }}
        >
          <View className='nav-title-wrap' style={{ height: `${menuButtonInfo.height}px` }}>
            <View className='nav-left-icons'>
              <Text className='header-icon-btn'>📋</Text>
              <Text className='header-icon-btn' onClick={onAddCourse}>➕</Text>
            </View>
            <View className='header-center' style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
              <Text className='student-name'>{currentStudent?.name || '未选择学生'} ⇌</Text>
              <Text className='student-sub'>{currentSchedule.name}</Text>
            </View>
          </View>
        </View>

      <View style={{ flexShrink: 0, height: `${statusBarHeight + navBarHeight}px` }} />
      
      {!hasCourses ? (
        <EmptySchedule currentSchedule={currentSchedule} />
      ) : (
        <ScheduleGrid
          weekNum={weekNum}
          weekDates={weekDates}
          today={today}
          periods={periods}
          grid={grid}
          setWeekOffset={setWeekOffset}
          onTapCourse={onTapCourse}
          onTapEmpty={onTapEmpty}
        />
      )}

      {/* 课程详情 Modal */}
      <CourseModal
        selectedCourse={selectedCourse}
        showCourseModal={showCourseModal}
        setShowCourseModal={setShowCourseModal}
        onEditCourse={onEditCourse}
        onDeleteCourse={onDeleteCourse}
      />
    </View>
  )
}
