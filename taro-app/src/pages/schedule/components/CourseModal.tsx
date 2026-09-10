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
                <View className='modal-course-fields'>
                  {course.teacher ? (
                    <View className='modal-course-field'>
                      <Text className='modal-course-field__label'>老师</Text>
                      <Text className='modal-course-field__value'>{course.teacher}</Text>
                    </View>
                  ) : null}
                  {course.room ? (
                    <View className='modal-course-field'>
                      <Text className='modal-course-field__label'>教室</Text>
                      <Text className='modal-course-field__value'>{course.room}</Text>
                    </View>
                  ) : null}
                  {course.contact ? (
                    <View className='modal-course-field'>
                      <Text className='modal-course-field__label'>联系方式</Text>
                      <Text className='modal-course-field__value'>{course.contact}</Text>
                    </View>
                  ) : null}
                  {course.remark ? (
                    <View className='modal-course-field'>
                      <Text className='modal-course-field__label'>备注</Text>
                      <Text className='modal-course-field__value'>{course.remark}</Text>
                    </View>
                  ) : null}
                </View>
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
