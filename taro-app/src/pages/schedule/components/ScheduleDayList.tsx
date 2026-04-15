import { View, Text, ScrollView, Picker } from '@tarojs/components'
import { useScheduleStore } from '../../../store/schedule.store'
import type { Course, ScheduleGrid as ScheduleGridType, Period } from '../../../types/index'
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
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default function ScheduleDayList({
  weekNum,
  weekDates,
  // today, // actually unused in this component because we derive title manually
  periods,
  grid,
  setWeekOffset,
  onTapCourse,
  onTapEmpty,
  selectedDayIndex,
  setSelectedDayIndex
}: Props) {
  const weekOffset = useScheduleStore(state => state.weekOffset)
  const currentSchedule = useScheduleStore(state => state.currentSchedule)
  const totalWeeks = currentSchedule?.total_weeks || currentSchedule?.totalWeeks || 20
  const weekOptions = Array.from({ length: totalWeeks }, (_, i) => `第${i + 1}周`)

  const currentDateTitle = `周${WEEKDAY_LABELS[selectedDayIndex]}(${weekDates[selectedDayIndex]?.slice(5)?.replace('-', '-') || ''})`

  const handlePrevDay = () => {
    if (selectedDayIndex > 0) {
      setSelectedDayIndex(selectedDayIndex - 1)
    } else {
      setWeekOffset(weekOffset - 1)
      setSelectedDayIndex(6)
    }
  }

  const handleNextDay = () => {
    if (selectedDayIndex < 6) {
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
          <Picker
            mode='selector'
            range={weekOptions}
            value={weekNum > 0 ? weekNum - 1 : 0}
            onChange={(e) => {
              const selectedIdx = Number(e.detail.value)
              setWeekOffset(selectedIdx)
            }}
          >
            <View className='day-week-picker'>
              <Text className='day-week-picker-text'>第{weekNum}周 ▾</Text>
            </View>
          </Picker>
          
          <View className='day-stepper'>
            <Text className='stepper-btn iconfont' onClick={handlePrevDay}>&#xe600;</Text>
            <Text className='stepper-title'>{currentDateTitle}</Text>
            <Text className='stepper-btn iconfont' onClick={handleNextDay}>&#xe602;</Text>
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
