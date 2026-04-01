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
          {course.room && <Text className='course-meta'>📍 {course.room}</Text>}
        </View>
        <View className='card-side'>
          <Text className='period-badge'>第{course.slot}节</Text>
        </View>
      </View>
      {course.remark && <Text className='course-note'>{course.remark}</Text>}
    </View>
  )
}
