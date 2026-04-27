import { View, Text, ScrollView } from '@tarojs/components'
import { useScheduleStore } from '../../../store/schedule.store'
import type { Course, ScheduleGrid as ScheduleGridType, Period } from '../../../types/index'
import { formatDate } from '../../../utils/date'
import './ScheduleDayList.scss'

interface Props {
  weekNum: number;
  weekDates: string[];
  today: string;
  periods: Period[];
  grid: ScheduleGridType;
  setWeekOffset: (offset: number) => void;
  onTapCourse: (course: Course) => void;
  onTapEmpty: (weekday: number, period: number) => void;
  selectedDayIndex: number;
  setSelectedDayIndex: (idx: number) => void;
  onOpenWeekPicker: () => void;
  hideWeekend?: boolean;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default function ScheduleDayList({
  weekNum,
  weekDates,
  today,
  periods,
  grid,
  setWeekOffset,
  onTapCourse,
  onTapEmpty,
  selectedDayIndex,
  setSelectedDayIndex,
  onOpenWeekPicker,
  hideWeekend = false,
}: Props) {
  const weekOffset = useScheduleStore(state => state.weekOffset)
  // 隐藏周末时最大可选 index 为 4（周五），否则为 6
  const maxDayIndex = hideWeekend ? 4 : 6

  // 今天所在周的周一（ISO 日期字符串）
  const todayMonday = (() => {
    const d = new Date(today)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return formatDate(d, 'YYYY-MM-DD')
  })()

  // 当前显示周的周一
  const currentMonday = weekDates[0] || ''

  // 是否已到达"今天所在周的周一"这一天（不能再往前翻）
  const isAtEarliestDay = currentMonday === todayMonday && selectedDayIndex === 0

  const currentDateTitle = `周${WEEKDAY_LABELS[selectedDayIndex]}(${weekDates[selectedDayIndex]?.slice(5)?.replace('-', '/') || ''})`

  const handlePrevDay = () => {
    if (isAtEarliestDay) return
    if (selectedDayIndex > 0) {
      setSelectedDayIndex(selectedDayIndex - 1)
    } else {
      setWeekOffset(weekOffset - 1)
      setSelectedDayIndex(maxDayIndex)
    }
  }

  const handleNextDay = () => {
    if (selectedDayIndex < maxDayIndex) {
      setSelectedDayIndex(selectedDayIndex + 1)
    } else {
      setWeekOffset(weekOffset + 1)
      setSelectedDayIndex(0)
    }
  }

  return (
    <View className='schedule-view'>
      <View className='grid-wrap'>
        <View className='day-list-header'>
          <View className='day-week-picker' onClick={onOpenWeekPicker}>
            <Text className='day-week-picker-text'>第{weekNum}周</Text>
          </View>

          <View className='day-stepper'>
            <Text
              className={`stepper-btn iconfont${isAtEarliestDay ? ' stepper-btn--disabled' : ''}`}
              onClick={handlePrevDay}
            >&#xe67f;</Text>
            <Text className='stepper-title'>{currentDateTitle}</Text>
            <Text className='stepper-btn iconfont' onClick={handleNextDay}>&#xe681;</Text>
          </View>
        </View>

        <ScrollView scrollY className='day-list-body'>
          {periods.map((period, pIdx) => {
            const course = grid[pIdx]?.[selectedDayIndex] || null
            let isCurrentWeek = true

            if (course && course.weeks && course.weeks.length > 0) {
              isCurrentWeek = course.weeks.includes(weekNum)
            }

            const bgColor = isCurrentWeek
              ? (course?.color?.startsWith('#') ? `${course.color}1A` : (course?.color === 'red' ? '#FFEBEB' : '#eff6ff'))
              : '#EFEFEF'

            const borderColor = isCurrentWeek
              ? (course?.color?.startsWith('#') ? course.color : (course?.color === 'red' ? '#FF4D4F' : '#3b82f6'))
              : '#CCCCCC'

            const titleColor = isCurrentWeek ? '#333333' : '#999999'
            const subTextColor = isCurrentWeek ? '#999999' : '#C0C0C0'

            return (
              <View className='day-row' key={period.index}>
                <View className='day-time-col'>
                  <Text className='day-time-text'>{period.startTime}</Text>
                  <View className='day-time-line' />
                  <Text className='day-time-text'>{period.endTime}</Text>
                </View>

                <View className='day-course-col'>
                  {course ? (
                    <View
                      className={`day-course-card ${!isCurrentWeek ? 'day-course-card--inactive' : ''}`}
                      style={{ background: bgColor, borderLeftColor: borderColor }}
                      onClick={() => onTapCourse(course)}
                    >
                      <View className='day-course-header'>
                        <Text className='day-course-name' style={{ color: titleColor }}>{course.name}</Text>
                        <Text className='day-course-period' style={{ color: subTextColor }}>第 {period.index} 节</Text>
                      </View>
                      <Text className='day-course-detail' style={{ color: subTextColor }}>{course.room || '未填写教室'}</Text>
                      <Text className='day-course-detail' style={{ color: subTextColor }}>{course.teacher || '未填写教师'}</Text>
                    </View>
                  ) : (
                    <View className='day-empty-card' onClick={() => onTapEmpty(selectedDayIndex + 1, period.index)}>
                      <Text className='day-empty-text'>+ 添加课程</Text>
                    </View>
                  )}
                </View>
              </View>
            )
          })}
          <View className='day-list-bottom-padding' />
        </ScrollView>
      </View>
    </View>
  )
}
