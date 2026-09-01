import { View, Text } from '@tarojs/components'
import { useState, useMemo, useEffect, Fragment, type CSSProperties } from 'react'
import type { Course, ScheduleGrid as ScheduleGridType, Period } from '../../../types/index'
import { tabState } from '../../../utils/tabState'
import './ScheduleGrid.scss'

interface Props {
  weekNum: number;
  weekDates: string[];
  today: string;
  periods: Period[];
  grid: ScheduleGridType;
  totalWeeks: number;
  startDate?: string;
  setWeekOffset: (offset: number) => void;
  onTapCourse: (course: Course) => void;
  onTapEmpty: (weekday: number, period: number) => void;
  /** 当前周为空、但其他周次有课的 slot，key=`${day_of_week}-${slot}` */
  offWeekSlotKeys?: Set<string>;
  hideWeekend?: boolean;
  /** 是否允许点击课程/空格子，预览场景可关闭 */
  interactive?: boolean;
  /** 是否允许切换周数，默认 true */
  allowWeekPicker?: boolean;
  /** 是否高亮今天所在的列，默认 true */
  highlightToday?: boolean;
  /** 自定义课程点击回调（替代默认 onTapCourse） */
  onCourseClick?: (course: Course, index: number) => void;
  /** 是否为 remark 含 [待确认] 的课程添加特殊样式 */
  highlightUncertain?: boolean;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const TODAY_COURSE_COLOR = '#3b82f6'
const NORMAL_COURSE_COLOR = '#22c55e'

function getDayNumber(dateStr?: string): string {
  if (!dateStr) return ''
  const day = parseInt(dateStr.split('-')[2], 10)
  return Number.isNaN(day) ? '' : String(day)
}

function resolveCourseChip(isTodayCol: boolean): { className: string; style?: CSSProperties } {
  const color = isTodayCol ? TODAY_COURSE_COLOR : NORMAL_COURSE_COLOR
  return {
    className: 'course-chip',
    style: {
      background: `${color}22`,
      color,
      borderLeftColor: color,
    },
  }
}

export default function ScheduleGrid({
  weekNum,
  weekDates,
  today,
  periods,
  grid,
  totalWeeks,
  startDate,
  setWeekOffset,
  onTapCourse,
  onTapEmpty,
  offWeekSlotKeys,
  hideWeekend = false,
  interactive = true,
  allowWeekPicker = true,
  highlightToday = true,
  onCourseClick,
  highlightUncertain = false,
}: Props) {
  const visibleDayIndices = hideWeekend ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6]
  const [showWeekPicker, setShowWeekPicker] = useState(false)
  const [tempSelectedWeek, setTempSelectedWeek] = useState(weekNum)

  const gridColumns = `45px repeat(${visibleDayIndices.length}, minmax(0, 1fr))`

  // 根据课表开始日期和当前日期计算当前周数
  const getCurrentWeekByDate = (): number => {
    if (!startDate) {
      if (weekDates.length === 0) return 1
      const mondayDate = new Date(weekDates[0])
      const todayDate = new Date(today)
      const diffDays = Math.floor((todayDate.getTime() - mondayDate.getTime()) / (1000 * 60 * 60 * 24))
      return Math.max(1, Math.min(Math.floor(diffDays / 7) + 1, totalWeeks))
    }

    const start = new Date(startDate)
    const todayDate = new Date(today)
    const startDay = start.getDay()
    const diffToMonday = startDay === 0 ? -6 : 1 - startDay
    start.setDate(start.getDate() + diffToMonday)

    const diffMs = todayDate.getTime() - start.getTime()
    const diffWeeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7))
    return Math.max(1, Math.min(diffWeeks + 1, totalWeeks))
  }

  const currentWeekByDate = getCurrentWeekByDate()

  useEffect(() => {
    setTempSelectedWeek(weekNum)
  }, [weekNum])

  const availableWeeks = useMemo(
    () => Array.from({ length: totalWeeks }, (_, i) => i + 1),
    [totalWeeks]
  )

  const handleSelectWeek = (week: number) => {
    setTempSelectedWeek(week)
  }

  const handleConfirm = () => {
    const offset = tempSelectedWeek - 1
    setWeekOffset(offset)
    setShowWeekPicker(false)
    tabState.setVisible(true)
  }

  const handleCancel = () => {
    setTempSelectedWeek(weekNum)
    setShowWeekPicker(false)
    tabState.setVisible(true)
  }

  const handleOpenWeekPicker = () => {
    if (!allowWeekPicker) return
    setTempSelectedWeek(weekNum)
    setShowWeekPicker(true)
    tabState.setVisible(false)
  }

  return (
    <>
      <View className='schedule-view'>
        <View className='week-schedule-grid'>
          <View className='schedule-card'>
            <View className='grid-header' style={{ gridTemplateColumns: gridColumns }}>
              <View
                className={`time-col ${allowWeekPicker ? 'time-col--picker' : ''}`}
                onClick={allowWeekPicker ? handleOpenWeekPicker : undefined}
              >
                <Text className='week-picker-label'>第{weekNum}周</Text>
              </View>

              {visibleDayIndices.map((idx) => {
                const isToday = highlightToday && weekDates[idx] === today
                return (
                  <View key={idx} className={`day-col ${isToday ? 'day-col--today' : ''}`}>
                    <Text className='day-name'>{WEEKDAY_LABELS[idx]}</Text>
                    <Text className='day-num'>{getDayNumber(weekDates[idx])}</Text>
                  </View>
                )
              })}
            </View>

            <View className='grid-body' style={{ gridTemplateColumns: gridColumns }}>
              {periods.map((period, pIdx) => (
                <Fragment key={period.index}>
                  <View className='time-slot'>
                    <Text className='period-index'>{period.index}</Text>
                    <Text className='period-time'>{period.startTime}</Text>
                    <Text className='period-time period-time--end'>{period.endTime}</Text>
                  </View>
                  {visibleDayIndices.map((dIdx) => {
                    const course = grid[pIdx]?.[dIdx] || null
                    const isTodayCol = highlightToday && weekDates[dIdx] === today
                    const isUncertain = highlightUncertain && course?.remark?.includes('[待确认]')
                    const chip = course ? resolveCourseChip(isTodayCol) : null
                    const slotKey = `${dIdx + 1}-${period.index}`
                    const hasOffWeekCourse = !course && offWeekSlotKeys?.has(slotKey)
                    return (
                      <View key={dIdx} className={`course-cell${isTodayCol ? ' course-cell--today' : ''}`}>
                        {course ? (
                          <View
                            className={`${chip?.className || ''}${isUncertain ? ' course-chip--uncertain' : ''}`}
                            style={chip?.style}
                            onClick={interactive ? () => {
                              if (onCourseClick) {
                                const idx = parseInt(course.id.replace('preview-', ''), 10)
                                onCourseClick(course, isNaN(idx) ? 0 : idx)
                              } else {
                                onTapCourse(course)
                              }
                            } : undefined}
                          >
                            <Text className='course-chip-name'>{isUncertain ? `⚠️${course.name}` : course.name}</Text>
                            {course.room ? (
                              <Text className='course-chip-room'>{course.room}</Text>
                            ) : null}
                          </View>
                        ) : (
                          <View
                            className={`empty-cell${hasOffWeekCourse ? ' empty-cell--offweek' : ''}`}
                            onClick={interactive ? () => onTapEmpty(dIdx + 1, period.index) : undefined}
                          >
                            {hasOffWeekCourse && (
                              <Text className='empty-cell-hint'>其他周有课</Text>
                            )}
                          </View>
                        )}
                      </View>
                    )
                  })}
                </Fragment>
              ))}
            </View>
          </View>
        </View>
      </View>

      {showWeekPicker && (
        <>
          <View className='week-picker-overlay' onClick={handleCancel} />
          <View className='week-picker-popup'>
            <View className='week-picker-nav'>
              <Text className='week-picker-nav-btn' onClick={handleCancel}>取消</Text>
              <Text className='week-picker-nav-title'>选择周数</Text>
              <Text className='week-picker-nav-btn week-picker-nav-btn--primary' onClick={handleConfirm}>完成</Text>
            </View>

            <View className='week-picker-grid'>
              {availableWeeks.map(week => {
                const isSelected = week === tempSelectedWeek
                const isCurrent = week === currentWeekByDate
                return (
                  <View
                    key={week}
                    className={`week-grid-item ${isSelected ? 'week-grid-item--selected' : ''}`}
                    onClick={() => handleSelectWeek(week)}
                  >
                    <Text className={`week-grid-text ${isSelected ? 'week-grid-text--selected' : ''}`}>
                      {week}
                    </Text>
                    {isCurrent && !isSelected && (
                      <Text className='week-grid-tag'>当前</Text>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        </>
      )}
    </>
  )
}
