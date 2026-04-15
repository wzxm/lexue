import { View, Text, PageContainer } from '@tarojs/components'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { tabState } from '../../utils/tabState'
import { useScheduleStore, buildGrid } from '../../store/schedule.store'
import { useStudentStore } from '../../store/student.store'
import { useAuthStore } from '../../store/auth.store'
import { listStudents } from '../../api/student.api'
import {
  listSchedules,
  getSchedule,
  setDefaultSchedule,
  updateSchedule
} from '../../api/schedule.api'
import { deleteCourse } from '../../api/course.api'
import { getWeekDates, getCurrentWeekOffset } from '../../utils/date'
import { ROUTES } from '../../constants/routes'
import { resolveCourseId } from '../../utils/courseId'
import { groupSchedulesByStudent } from '../../utils/groupSchedulesByStudent'
import ScheduleSwitchDrawer from '../../components/ScheduleSwitchDrawer'
import { DEFAULT_PERIODS } from '../../constants/periods'
import type {
  Course,
  ScheduleGrid as ScheduleGridType
} from '../../types/index'

import EmptyState from './components/EmptyState'
import EmptySchedule from './components/EmptySchedule'
import ScheduleGrid from './components/ScheduleGrid'
import ScheduleDayList from './components/ScheduleDayList'
import CourseModal from './components/CourseModal'

import './index.scss'

export default function SchedulePage () {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const userInfo = useAuthStore(s => s.userInfo)
  const { currentStudent, setStudents, students, setCurrentStudent } =
    useStudentStore()
  const {
    schedules,
    currentSchedule,
    setSchedules,
    setCurrentSchedule,
    setWeekOffset,
    removeCourse: removeCourseFromStore
  } = useScheduleStore()

  const [grid, setGrid] = useState<ScheduleGridType>([])
  const [weekDates, setWeekDates] = useState<string[]>([])
  const [weekNum, setWeekNum] = useState(1)
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showAddCourseSheet, setShowAddCourseSheet] = useState(false)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)

  /** 课程详情弹层打开时隐藏底部自定义 TabBar，关闭或卸载时恢复 */
  useEffect(() => {
    if (!showCourseModal) return
    tabState.setVisible(false)
    return () => {
      tabState.setVisible(true)
    }
  }, [showCourseModal])

  const periods = currentSchedule?.periods || DEFAULT_PERIODS
  const today = new Date().toISOString().slice(0, 10)

  const groupedSchedules = useMemo(
    () => groupSchedulesByStudent(schedules, students),
    [schedules, students]
  )

  /** 根据课表 start_date 算出当前周 offset，clamp 到 [0, totalWeeks-1] */
  const calcInitialOffset = (schedule: typeof currentSchedule): number => {
    const startDate = schedule?.start_date || schedule?.startDate
    if (!startDate) return 0 // 没有开学日则默认第1周
    const totalWeeks = schedule?.total_weeks || schedule?.totalWeeks || 20
    const offset = getCurrentWeekOffset(startDate)
    return Math.max(0, Math.min(offset, totalWeeks - 1))
  }

  const goLogin = () => {
    Taro.navigateTo({ url: ROUTES.LOGIN })
  }

  const openDrawer = () => {
    if (!isLoggedIn) {
      goLogin()
      return
    }
    setShowDrawer(true)
  }

  const closeDrawer = () => {
    setShowDrawer(false)
  }

  const handleSelectSchedule = async (schedule: typeof schedules[0]) => {
    if (currentSchedule?.id === schedule.id) {
      closeDrawer()
      return
    }
    try {
      Taro.showLoading({ title: '切换中', mask: true })
      const full = await getSchedule(schedule.id)
      const sid = full.studentId || full.student_id
      if (sid) {
        const st = students.find(s => s.id === sid)
        if (st) setCurrentStudent(st)
      }
      const openId = userInfo?.openId
      if (openId && schedule.owner_openid === openId) {
        await setDefaultSchedule(schedule.id)
      }
      setCurrentSchedule(full)
      setWeekOffset(calcInitialOffset(full))
      closeDrawer()
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '切换失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const goManageSchedule = () => {
    closeDrawer()
    Taro.navigateTo({ url: ROUTES.SCHEDULE_MANAGE })
  }

  const goManageStudent = () => {
    closeDrawer()
    Taro.navigateTo({ url: ROUTES.STUDENT_MANAGE })
  }

  const windowInfo = Taro.getWindowInfo()
  const menuButtonInfo = Taro.getMenuButtonBoundingClientRect()

  /** 内容要向下偏移，不要压在导航栏上 */
  const headerPaddingTop = menuButtonInfo.top

  /** 同步视图 */
  const syncView = useCallback(() => {
    const offset = useScheduleStore.getState().weekOffset
    const schedule = useScheduleStore.getState().currentSchedule
    const startDate = schedule?.start_date || schedule?.startDate
    // 有开学日时以开学周为锚点，保证日历日期和周序号对齐
    const dates = getWeekDates(offset, startDate)
    const num = Math.abs(offset) + 1
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayIdx = dates.indexOf(todayStr)

    setGrid(buildGrid(schedule, offset))
    setWeekDates(dates)
    setWeekNum(num)
    // 切换到日视图时，默认定位到今天（若今天在当前周内），否则周一
    setSelectedDayIndex(prev => {
      // 如果是首次加载（prev === 0）且今天在本周，定位到今天
      if (todayIdx >= 0) return todayIdx
      return prev
    })
  }, [])

  /** 页面初始化 */
  useEffect(() => {
    if (!isLoggedIn) return
    loadData()
    const unsub = useScheduleStore.subscribe(syncView)
    return () => unsub()
  }, [isLoggedIn])

  /** 页面显示 */
  Taro.useDidShow(() => {
    syncView()
    tabState.setSelected(0)
    if (useAuthStore.getState().isLoggedIn) {
      loadData()
    }
  })

  /** 加载数据 */
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
        setWeekOffset(calcInitialOffset(full))
      } else {
        setCurrentSchedule(null)
      }
      syncView()
    } catch (err: any) {
      Taro.showToast({
        title: err.message || '加载失败',
        icon: 'none',
        duration: 3000
      })
    } finally {
      Taro.hideLoading()
    }
  }

  /** 空课表页面点击添加课程 */
  const onTapEmpty = (weekday: number, period: number) => {
    if (!currentSchedule) {
      Taro.showToast({ title: '请先创建课表', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `${ROUTES.COURSE_FORM}?mode=add&weekday=${weekday}&period=${period}&scheduleId=${currentSchedule.id}`
    })
  }

  /** 课程点击 */
  const onTapCourse = (course: Course) => {
    setSelectedCourse(course)
    setShowCourseModal(true)
  }

  /** 编辑课程 */
  const onEditCourse = () => {
    if (!selectedCourse) return
    const cid = resolveCourseId(selectedCourse)
    if (!cid) {
      Taro.showToast({ title: '课程数据异常', icon: 'none' })
      return
    }
    setShowCourseModal(false)
    const sid = currentSchedule?.id || selectedCourse.schedule_id
    Taro.navigateTo({
      url: `${ROUTES.COURSE_FORM}?mode=edit&courseId=${encodeURIComponent(cid)}&scheduleId=${encodeURIComponent(sid)}`
    })
  }

  /** 删除课程 */
  const onDeleteCourse = async () => {
    if (!selectedCourse) return
    const { confirm } = await Taro.showModal({
      title: '删除课程',
      content: `确认删除「${selectedCourse.name}」？`
    })
    if (!confirm) return
    try {
      const cid = resolveCourseId(selectedCourse)
      if (!cid) {
        Taro.showToast({ title: '课程数据异常', icon: 'none' })
        return
      }
      await deleteCourse(cid)
      removeCourseFromStore(cid)
      setShowCourseModal(false)
      setSelectedCourse(null)
      Taro.showToast({ title: '已删除' })
    } catch (err: any) {
      Taro.showToast({ title: err.message, icon: 'none' })
    }
  }

  /** 切换视图模式（乐观更新：先切本地，后台异步持久化） */
  const onToggleViewMode = () => {
    if (!currentSchedule) return
    const prevMode = currentSchedule.view_mode === 'day' ? 'day' : 'week'
    const newMode = prevMode === 'day' ? 'week' : 'day'
    // 立即切换，不等网络
    setCurrentSchedule({
      ...currentSchedule,
      view_mode: newMode,
      viewMode: newMode
    })
    // 后台持久化，失败回滚
    updateSchedule(currentSchedule.id, { view_mode: newMode }).catch((err: any) => {
      setCurrentSchedule({
        ...currentSchedule,
        view_mode: prevMode,
        viewMode: prevMode
      })
      Taro.showToast({ title: err.message || '切换失败', icon: 'none' })
    })
  }

  /** 添加课程 */
  const onAddCourse = () => {
    if (!isLoggedIn) {
      Taro.navigateTo({ url: ROUTES.LOGIN })
      return
    }
    if (!currentSchedule) {
      Taro.navigateTo({ url: ROUTES.SCHEDULE_FORM })
      return
    }
    tabState.setVisible(false)
    setShowAddCourseSheet(true)
  }

  /** 空状态页面 */
  if (!isLoggedIn || !currentSchedule) {
    return (
      <View className='schedule-page empty-page'>
        <View className='custom-nav-bg' />
        <View
          className='custom-nav-bar'
          style={{
            paddingTop: `${headerPaddingTop + 20}px`,
            height: `${menuButtonInfo.height}px`,
            paddingRight: `${windowInfo.windowWidth - menuButtonInfo.left}px`
          }}
        >
          <View className='nav-title-wrap'>
            <Text className='nav-title'>😊 欢迎使用乐学课表</Text>
          </View>
        </View>

        <View
          style={{
            flexShrink: 0,
            height: `${headerPaddingTop + menuButtonInfo.height}px`
          }}
        />
        <EmptyState onAddCourse={onAddCourse} />
      </View>
    )
  }

  /** 有数据页面 */
  const hasCourses =
    currentSchedule.courses && currentSchedule.courses.length > 0
  return (
    <View className='schedule-page'>
      <View className='custom-nav-bg' />
      <View
        className='custom-nav-bar'
        style={{
          paddingTop: `${headerPaddingTop + 20}px`,
          height: `${menuButtonInfo.height}px`,
          paddingRight: `${windowInfo.windowWidth - menuButtonInfo.left}px`
        }}
      >
        <View className='nav-title-wrap'>
          {hasCourses && (
            <View className='nav-left-icons'>
              <Text
                className='iconfont header-icon-btn'
                onClick={onToggleViewMode}
              >
                {currentSchedule?.view_mode === 'day' ? '\ue606' : '\ue605'}
              </Text>
              <Text className='iconfont header-icon-btn' onClick={onAddCourse}>
                {'\ue604'}
              </Text>
            </View>
          )}
          <View
            className='header-center'
            onClick={openDrawer}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
          >
            <Text className='student-name'>
              <Text>{currentStudent?.name || '未选择学生'}</Text>
              <Text className='student-sub-icon'>⇌</Text>
            </Text>
            <Text className='student-sub'>{currentSchedule.name}</Text>
          </View>
          {/* 仅为占位保持中间居中不跑偏 */}
          {/* <View className='nav-right-icons' style={{ visibility: 'hidden' }}>
            <Text className='header-icon-btn'>📋</Text>
            <Text className='header-icon-btn'>➕</Text>
          </View> */}
        </View>
      </View>

      <View
        style={{
          flexShrink: 0,
          height: `${headerPaddingTop + menuButtonInfo.height + 40}px`
        }}
      />

      {!hasCourses ? (
        <EmptySchedule scheduleId={currentSchedule?.id} />
      ) : currentSchedule?.view_mode === 'day' ? (
        <ScheduleDayList
          key='day'
          weekNum={weekNum}
          weekDates={weekDates}
          today={today}
          periods={periods}
          grid={grid}
          setWeekOffset={setWeekOffset}
          onTapCourse={onTapCourse}
          onTapEmpty={onTapEmpty}
          selectedDayIndex={selectedDayIndex}
          setSelectedDayIndex={setSelectedDayIndex}
        />
      ) : (
        <ScheduleGrid
          key='week'
          weekNum={weekNum}
          weekDates={weekDates}
          today={today}
          periods={periods}
          grid={grid}
          totalWeeks={
            currentSchedule?.total_weeks || currentSchedule?.totalWeeks || 20
          }
          startDate={currentSchedule?.start_date || currentSchedule?.startDate}
          setWeekOffset={setWeekOffset}
          onTapCourse={onTapCourse}
          onTapEmpty={onTapEmpty}
        />
      )}

      {/* 课程详情 Modal */}
      {showCourseModal && (
        <CourseModal
          selectedCourse={selectedCourse}
          showCourseModal={showCourseModal}
          setShowCourseModal={setShowCourseModal}
          onEditCourse={onEditCourse}
          onDeleteCourse={onDeleteCourse}
        />
      )}

      {/* 课表切换抽屉 */}
      {showDrawer && (
        <ScheduleSwitchDrawer
          visible={showDrawer}
          onClose={closeDrawer}
          schedules={schedules}
          groupedSchedules={groupedSchedules}
          currentScheduleId={currentSchedule?.id}
          onSelectSchedule={handleSelectSchedule}
          onManageSchedule={goManageSchedule}
          onManageStudent={goManageStudent}
        />
      )}

      {/* 添加课程方式弹窗 */}
      {showAddCourseSheet && (
        <PageContainer
          show={showAddCourseSheet}
          position='bottom'
          round
          zIndex={1000}
          onClickOverlay={() => setShowAddCourseSheet(false)}
          onAfterLeave={() => {
            setShowAddCourseSheet(false)
            tabState.setVisible(true)
          }}
          customStyle='background-color: #F7F7F7;'
        >
          <View className='add-course-sheet'>
            <View className='add-course-sheet-header'>
              <Text className='add-course-sheet-title'>选择添加课程方式</Text>
              <Text
                className='add-course-sheet-close'
                onClick={() => setShowAddCourseSheet(false)}
              >
                ×
              </Text>
            </View>
            <EmptySchedule
              scheduleId={currentSchedule?.id}
              useRedirect={false}
              hideTitle
            />
          </View>
        </PageContainer>
      )}
    </View>
  )
}
