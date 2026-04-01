import { View, Text, Button } from '@tarojs/components'
import type { Course } from '../../../types/index'

interface Props {
  selectedCourse: Course | null;
  showCourseModal: boolean;
  setShowCourseModal: (show: boolean) => void;
  onEditCourse: () => void;
  onDeleteCourse: () => void;
}

export default function CourseModal({
  selectedCourse,
  showCourseModal,
  setShowCourseModal,
  onEditCourse,
  onDeleteCourse
}: Props) {
  if (!showCourseModal || !selectedCourse) return null;

  return (
    <View className='modal-mask' onClick={() => setShowCourseModal(false)}>
      <View className='modal-content' onClick={(e) => e.stopPropagation()}>
        <View className='modal-drag-bar' />
        <View className='modal-header'>
          <Text className='modal-title'>{selectedCourse.name}</Text>
          <View className='modal-close' onClick={() => setShowCourseModal(false)}><Text>✕</Text></View>
        </View>
        <View className='modal-body'>
          {selectedCourse.teacher && (
            <View className='info-row'>
              <Text className='info-label'>👩‍🏫 老师</Text>
              <Text className='info-value'>{selectedCourse.teacher}</Text>
            </View>
          )}
          {selectedCourse.room && (
            <View className='info-row'>
              <Text className='info-label'>🏫 教室</Text>
              <Text className='info-value'>{selectedCourse.room}</Text>
            </View>
          )}
          <View className='info-row'>
            <Text className='info-label'>🕐 时间</Text>
            <Text className='info-value'>第{selectedCourse.slot}节</Text>
          </View>
          {selectedCourse.remark && (
            <View className='info-row'>
              <Text className='info-label'>📝 备注</Text>
              <Text className='info-value'>{selectedCourse.remark}</Text>
            </View>
          )}
        </View>
        <View className='modal-footer'>
          <Button className='btn-edit' onClick={onEditCourse}>修改</Button>
          <Button className='btn-delete' onClick={onDeleteCourse}>删除</Button>
        </View>
      </View>
    </View>
  )
}
