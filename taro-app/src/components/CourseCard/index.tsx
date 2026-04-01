import { View, Text } from '@tarojs/components'
import type { Course, Period } from '../../types/index'
import './index.scss'

interface CourseCardProps {
  course: Course
  periods?: Period[]
  onTap?: (course: Course) => void
}

export default function CourseCard({ course, onTap }: CourseCardProps) {
  return (
    <View
      className='course-card'
      style={{ borderLeftColor: course.color || '#00C853' }}
      onClick={() => onTap?.(course)}
    >
      <View className='card-body'>
        <View className='card-main'>
          <Text className='course-name'>{course.name}</Text>
          {course.teacher && <Text className='course-meta'>👤 {course.teacher}</Text>}
          {course.classroom && <Text className='course-meta'>📍 {course.classroom}</Text>}
        </View>
        <View className='card-side'>
          <Text className='period-badge'>第{course.period}节</Text>
        </View>
      </View>
      {course.note && <Text className='course-note'>{course.note}</Text>}
    </View>
  )
}
