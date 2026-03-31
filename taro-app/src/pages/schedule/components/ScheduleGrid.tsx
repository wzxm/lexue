import { View, Text, ScrollView } from '@tarojs/components'
import type { Course, ScheduleGrid as ScheduleGridType, Period } from '../../../types/index'

interface Props {
  weekNum: number;
  weekDates: string[];
  today: string;
  periods: Period[];
  grid: ScheduleGridType;
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
  setWeekOffset,
  onTapCourse,
  onTapEmpty,
}: Props) {
  return (
    <View className='schedule-view'>
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
  )
}
