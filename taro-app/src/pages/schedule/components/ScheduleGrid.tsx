import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useMemo, useEffect } from 'react'
import type { Course, ScheduleGrid as ScheduleGridType, Period } from '../../../types/index'
import { tabState } from '../../../utils/tabState'

interface Props {
  weekNum: number;
  weekDates: string[];
  today: string;
  periods: Period[];
  grid: ScheduleGridType;
  totalWeeks: number;
  startDate?: string; // 课表开始日期 YYYY-MM-DD
  setWeekOffset: (offset: number) => void;
  onTapCourse: (course: Course) => void;
  onTapEmpty: (weekday: number, period: number) => void;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

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
}: Props) {
  const [showWeekPicker, setShowWeekPicker] = useState(false)
  const [tempSelectedWeek, setTempSelectedWeek] = useState(weekNum)

  // 根据课表开始日期和当前日期计算当前周数
  const getCurrentWeekByDate = (): number => {
    if (!startDate) {
      // 如果没有开始日期，根据 weekDates 计算
      if (weekDates.length === 0) return 1
      const mondayDate = new Date(weekDates[0])
      const todayDate = new Date(today)
      const diffDays = Math.floor((todayDate.getTime() - mondayDate.getTime()) / (1000 * 60 * 60 * 24))
      return Math.max(1, Math.min(Math.floor(diffDays / 7) + 1, totalWeeks))
    }
    
    // 根据课表开始日期计算
    const start = new Date(startDate)
    const todayDate = new Date(today)
    // 确保开始日期是周一
    const startDay = start.getDay()
    const diffToMonday = startDay === 0 ? -6 : 1 - startDay
    start.setDate(start.getDate() + diffToMonday)
    
    const diffMs = todayDate.getTime() - start.getTime()
    const diffWeeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7))
    return Math.max(1, Math.min(diffWeeks + 1, totalWeeks))
  }

  const currentWeekByDate = getCurrentWeekByDate()

  // 同步 tempSelectedWeek
  useEffect(() => {
    setTempSelectedWeek(weekNum)
  }, [weekNum])

  // 只显示当前周和剩余周数
  const availableWeeks = useMemo(
    () => Array.from({ length: totalWeeks - currentWeekByDate + 1 }, (_, i) => currentWeekByDate + i),
    [currentWeekByDate, totalWeeks]
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
    setTempSelectedWeek(weekNum)
    setShowWeekPicker(true)
    tabState.setVisible(false)
  }

  return (
    <View className='schedule-view'>
      <View className='grid-wrap'>
        <View className='week-corner' onClick={handleOpenWeekPicker}>
          <Text className='week-corner-text'>第{weekNum}周</Text>
        </View>

        <View className='grid-header-row'>
          {WEEKDAY_LABELS.map((label, idx) => (
            <View key={label} className={`grid-header-cell ${weekDates[idx] === today ? 'grid-header-cell--today' : ''}`}>
              <Text className='grid-header-day'>{label}</Text>
              <Text className='grid-header-date'>{weekDates[idx]?.slice(5).replace('-', '/') || ''}</Text>
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

      {/* 周数选择浮层（用 fixed View 替代 PageContainer，避免同页多实例报错） */}
      {showWeekPicker && (
        <>
          <View className='week-picker-overlay' onClick={handleCancel} />
          <View className='week-picker-popup'>
            {/* 顶部导航 */}
            <View className='week-picker-nav'>
              <Text className='week-picker-nav-btn' onClick={handleCancel}>取消</Text>
              <Text className='week-picker-nav-title'>选择周数</Text>
              <Text className='week-picker-nav-btn week-picker-nav-btn--primary' onClick={handleConfirm}>完成</Text>
            </View>

            {/* 周数网格 */}
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
    </View>
  )
}
