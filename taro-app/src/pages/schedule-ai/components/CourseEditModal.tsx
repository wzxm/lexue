import { View, Text, Input, Picker } from '@tarojs/components'
import { useState, useEffect, useMemo } from 'react'
import WeekPickerSheet from '../../course-form/components/WeekPickerSheet'
import type { Course, WeekDay, PeriodIndex } from '../../../types/index'
import './CourseEditModal.scss'

interface CourseEditModalProps {
  visible: boolean
  course: Omit<Course, 'id'> | null
  courseIndex: number
  periods: number
  totalWeeks: number
  onSave: (index: number, updated: Omit<Course, 'id'>) => void
  onDelete: (index: number) => void
  onClose: () => void
}

const WEEKDAY_OPTIONS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function buildAllWeeks(totalWeeks: number): number[] {
  return Array.from({ length: totalWeeks }, (_, i) => i + 1)
}

function formatWeeksSummary(weeks: number[], totalWeeks: number): string {
  if (weeks.length === 0 || weeks.length === totalWeeks) return '每周'
  const allOdd = buildAllWeeks(totalWeeks).filter(w => w % 2 === 1)
  const allEven = buildAllWeeks(totalWeeks).filter(w => w % 2 === 0)
  if (weeks.length === allOdd.length && allOdd.every(w => weeks.includes(w))) return '单周'
  if (weeks.length === allEven.length && allEven.every(w => weeks.includes(w))) return '双周'
  if (weeks.length <= 5) return `第${weeks.join('、')}周`
  return `${weeks.length}周`
}

export default function CourseEditModal({
  visible,
  course,
  courseIndex,
  periods,
  totalWeeks,
  onSave,
  onDelete,
  onClose,
}: CourseEditModalProps) {
  const [name, setName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [slot, setSlot] = useState(1)
  const [teacher, setTeacher] = useState('')
  const [room, setRoom] = useState('')
  const [weeks, setWeeks] = useState<number[]>([])
  const [weekPickerVisible, setWeekPickerVisible] = useState(false)

  const allWeeks = useMemo(() => buildAllWeeks(totalWeeks), [totalWeeks])
  const periodRange = useMemo(
    () => Array.from({ length: periods }, (_, i) => `第${i + 1}节`),
    [periods]
  )
  const weeksSummary = useMemo(() => formatWeeksSummary(weeks, totalWeeks), [weeks, totalWeeks])

  useEffect(() => {
    if (!course) return
    setName(course.name || '')
    setDayOfWeek(course.day_of_week || 1)
    setSlot(course.slot || 1)
    setTeacher(course.teacher || '')
    setRoom(course.room || '')
    const initialWeeks = Array.isArray(course.weeks) && course.weeks.length > 0
      ? [...course.weeks].sort((a, b) => a - b)
      : allWeeks
    setWeeks(initialWeeks)
    setWeekPickerVisible(false)
  }, [course, allWeeks])

  if (!visible || !course) return null

  const canSave = name.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    const normalizedWeeks = weeks.length > 0 ? weeks : allWeeks
    const updated: Omit<Course, 'id'> = {
      ...course,
      name: name.trim(),
      day_of_week: dayOfWeek as WeekDay,
      slot: slot as PeriodIndex,
      teacher: teacher.trim(),
      room: room.trim(),
      weeks: normalizedWeeks,
      remark: (course.remark || '').replace('[待确认]', '').trim(),
    }
    onSave(courseIndex, updated)
  }

  const handleDelete = () => {
    onDelete(courseIndex)
  }

  return (
    <View className='course-edit-modal' onClick={onClose}>
      <View className='course-edit-modal__mask' />
      <View className='course-edit-modal__panel' onClick={(e) => e.stopPropagation()}>
        <View className='course-edit-modal__handle'>
          <View className='course-edit-modal__handle-bar' />
        </View>

        <View className='course-edit-modal__header'>
          <Text className='course-edit-modal__title'>编辑课程</Text>
        </View>

        <View className='course-edit-modal__body'>
          <View className='course-edit-field'>
            <Text className='course-edit-field__label'>课程名 *</Text>
            <Input
              className='course-edit-field__input'
              value={name}
              placeholder='请输入课程名'
              onInput={(e) => setName(e.detail.value)}
            />
          </View>

          <View className='course-edit-field'>
            <Text className='course-edit-field__label'>星期</Text>
            <Picker
              mode='selector'
              range={WEEKDAY_OPTIONS}
              value={dayOfWeek - 1}
              onChange={(e) => setDayOfWeek((e.detail.value as number) + 1)}
            >
              <View className='course-edit-field__picker'>
                <Text className='course-edit-field__picker-text'>{WEEKDAY_OPTIONS[dayOfWeek - 1]}</Text>
                <Text className='course-edit-field__picker-arrow'>▾</Text>
              </View>
            </Picker>
          </View>

          <View className='course-edit-field'>
            <Text className='course-edit-field__label'>节次</Text>
            <Picker
              mode='selector'
              range={periodRange}
              value={slot - 1}
              onChange={(e) => setSlot((e.detail.value as number) + 1)}
            >
              <View className='course-edit-field__picker'>
                <Text className='course-edit-field__picker-text'>{periodRange[slot - 1]}</Text>
                <Text className='course-edit-field__picker-arrow'>▾</Text>
              </View>
            </Picker>
          </View>

          <View className='course-edit-field'>
            <Text className='course-edit-field__label'>周次</Text>
            <View className='course-edit-field__picker' onClick={() => setWeekPickerVisible(true)}>
              <Text className='course-edit-field__picker-text'>{weeksSummary}</Text>
              <Text className='course-edit-field__picker-arrow'>▾</Text>
            </View>
          </View>

          <View className='course-edit-field'>
            <Text className='course-edit-field__label'>教师</Text>
            <Input
              className='course-edit-field__input'
              value={teacher}
              placeholder='请输入教师名（选填）'
              onInput={(e) => setTeacher(e.detail.value)}
            />
          </View>

          <View className='course-edit-field'>
            <Text className='course-edit-field__label'>教室</Text>
            <Input
              className='course-edit-field__input'
              value={room}
              placeholder='请输入教室（选填）'
              onInput={(e) => setRoom(e.detail.value)}
            />
          </View>
        </View>

        <View className='course-edit-modal__footer'>
          <View className='course-edit-modal__btn course-edit-modal__btn--danger' onClick={handleDelete}>
            <Text className='course-edit-modal__btn-text course-edit-modal__btn-text--danger'>删除</Text>
          </View>
          <View className='course-edit-modal__btn course-edit-modal__btn--ghost' onClick={onClose}>
            <Text className='course-edit-modal__btn-text'>取消</Text>
          </View>
          <View
            className={`course-edit-modal__btn course-edit-modal__btn--primary${!canSave ? ' course-edit-modal__btn--disabled' : ''}`}
            onClick={handleSave}
          >
            <Text className='course-edit-modal__btn-text course-edit-modal__btn-text--primary'>保存</Text>
          </View>
        </View>
      </View>

      <WeekPickerSheet
        show={weekPickerVisible}
        totalWeeks={totalWeeks}
        selectedWeeks={weeks}
        zIndex={2100}
        onCancel={() => setWeekPickerVisible(false)}
        onConfirm={(selected) => {
          setWeeks(selected.length > 0 ? selected : allWeeks)
          setWeekPickerVisible(false)
        }}
      />
    </View>
  )
}
