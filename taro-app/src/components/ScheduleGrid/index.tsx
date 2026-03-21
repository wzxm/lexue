import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import type { Course, Period } from '../../types/index'
import './index.scss'

interface ScheduleGridProps {
  courses: Course[]
  weekDates: string[]
  periods: Period[]
  onTapCourse?: (course: Course) => void
  onTapEmpty?: (weekday: number, period: number) => void
}

/** 课程列表 → 二维网格 grid[periodIdx][weekdayIdx] */
function buildGridData(courses: Course[], periodCount: number): (Course | null)[][] {
  const grid: (Course | null)[][] = []
  for (let p = 0; p < periodCount; p++) {
    grid[p] = new Array(7).fill(null)
  }
  courses.forEach(course => {
    const pIdx = course.period - 1
    const wIdx = course.weekday - 1
    if (pIdx >= 0 && pIdx < periodCount && wIdx >= 0 && wIdx < 7) {
      grid[pIdx][wIdx] = course
    }
  })
  return grid
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default function ScheduleGrid({ courses, weekDates, periods, onTapCourse, onTapEmpty }: ScheduleGridProps) {
  const today = getTodayStr()

  const weekHeaders = useMemo(() =>
    weekDates.map((d, i) => {
      const parts = d.split('-')
      return {
        label: `周${WEEK_LABELS[i]}`,
        date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
        isToday: d === today,
      }
    }),
    [weekDates, today]
  )

  const grid = useMemo(() =>
    buildGridData(courses, periods.length || 8),
    [courses, periods]
  )

  return (
    <View className='schedule-grid'>
      {/* 表头行 */}
      <View className='header-row'>
        <View className='period-label-cell'>
          <Text className='period-header-text'>节次</Text>
        </View>
        {weekHeaders.map((h) => (
          <View
            key={h.label}
            className={`header-cell ${h.isToday ? 'header-cell--today' : ''}`}
          >
            <Text className='header-day'>{h.label}</Text>
            <Text className='header-date'>{h.date}</Text>
          </View>
        ))}
      </View>

      {/* 课程行 */}
      {periods.map((period, pIdx) => (
        <View className='grid-row' key={period.index}>
          <View className='period-label-cell'>
            <Text className='period-num'>{period.index}</Text>
            <Text className='period-time'>{period.startTime}</Text>
          </View>
          {Array.from({ length: 7 }, (_, wIdx) => {
            const course = grid[pIdx]?.[wIdx] || null
            const cellIsToday = weekDates[wIdx] === today
            return (
              <View
                key={wIdx}
                className={`grid-cell ${cellIsToday ? 'grid-cell--today' : ''} ${course ? 'grid-cell--has-course' : ''}`}
                onClick={() => {
                  if (course) {
                    onTapCourse?.(course)
                  } else {
                    onTapEmpty?.(wIdx + 1, pIdx + 1)
                  }
                }}
              >
                {course && (
                  <View
                    className='course-block'
                    style={{
                      borderLeftColor: course.color || '#00C853',
                      background: course.color ? `${course.color}18` : '#E8F5E920',
                    }}
                  >
                    <Text className='course-name'>{course.name}</Text>
                    {course.teacher && <Text className='course-teacher'>{course.teacher}</Text>}
                  </View>
                )}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}
