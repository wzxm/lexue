import { View, Text, Button } from '@tarojs/components'
import type { Course } from '../../../types/index'
import { resolveCourseId } from '../../../utils/courseId'
import { formatWeeksSummary } from '../../../utils/weeks'

const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']

interface Props {
  courses: Course[];
  showCourseModal: boolean;
  setShowCourseModal: (show: boolean) => void;
  totalWeeks?: number;
  onEditCourse: () => void;
  onDeleteCourse: () => void;
}

function formatSlotTitle(courses: Course[]): string {
  const first = courses[0]
  if (!first) return '课程详情'
  const dayLabel = WEEKDAY_SHORT[first.day_of_week - 1] || ''
  return `周${dayLabel} 第${first.slot}节`
}

function formatMeta(course: Course): string {
  return [course.teacher, course.room].filter(Boolean).join(' · ')
}

export default function CourseModal({
  courses,
  showCourseModal,
  setShowCourseModal,
  totalWeeks = 20,
  onEditCourse,
  onDeleteCourse
}: Props) {
  if (!showCourseModal || courses.length === 0) return null

  return (
    <View className='modal-mask' onClick={() => setShowCourseModal(false)}>
      <View className='modal-content' onClick={(e) => e.stopPropagation()}>
        <View className='modal-drag-bar' />
        <View className='modal-header'>
          <Text className='modal-title'>{formatSlotTitle(courses)}</Text>
          <View className='modal-close' onClick={() => setShowCourseModal(false)}><Text>✕</Text></View>
        </View>
        <View className={`modal-body${courses.length > 1 ? ' modal-body--pair' : ''}`}>
          {courses.map((course, index) => {
            const weeksLabel = formatWeeksSummary(course.weeks || [], totalWeeks)
            const meta = formatMeta(course)
            return (
              <View
                key={resolveCourseKey(course, index)}
                className='modal-course-card'
              >
                <View className='modal-course-card__top'>
                  <Text className='modal-course-card__name'>{course.name}</Text>
                  <Text className='modal-course-card__week'>{weeksLabel}</Text>
                </View>
                {meta ? (
                  <Text className='modal-course-card__meta'>{meta}</Text>
                ) : null}
                {course.remark ? (
                  <Text className='modal-course-card__remark'>{course.remark}</Text>
                ) : null}
              </View>
            )
          })}
        </View>
        <View className='modal-footer'>
          <Button className='btn-edit' onClick={onEditCourse}>修改</Button>
          <Button className='btn-delete' onClick={onDeleteCourse}>删除</Button>
        </View>
      </View>
    </View>
  )
}

function resolveCourseKey(course: Course, index: number): string {
  return resolveCourseId(course) || `${course.day_of_week}-${course.slot}-${index}`
}
