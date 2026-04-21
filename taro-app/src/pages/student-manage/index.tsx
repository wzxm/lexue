import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo } from 'react'
import { listStudents } from '../../api/student.api'
import { useStudentStore } from '../../store/student.store'
import { ROUTES } from '../../constants/routes'
import type { Student } from '../../types/index'
import './index.scss'

export default function StudentManagePage() {
  const students = useStudentStore(s => s.students)
  const setStudents = useStudentStore(s => s.setStudents)

  useDidShow(() => {
    fetchStudents()
  })

  const fetchStudents = async () => {
    try {
      const data = await listStudents()
      setStudents(data)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '获取失败', icon: 'none' })
    }
  }

  const { ownStudents, sharedStudents } = useMemo(() => {
    const own: Student[] = []
    const shared: Student[] = []
    for (const s of students) {
      if (s.isShared) shared.push(s)
      else own.push(s)
    }
    return { ownStudents: own, sharedStudents: shared }
  }, [students])

  const goToAdd = () => {
    Taro.navigateTo({ url: `${ROUTES.STUDENT_FORM}?mode=add` })
  }

  const goToEdit = (student: Student) => {
    if (student.isShared) {
      Taro.showToast({ title: '共享学生不可编辑', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `${ROUTES.STUDENT_FORM}?mode=edit&studentId=${student.id}` })
  }

  const renderStudentCard = (student: Student) => (
    <View
      key={student.id}
      className={`student-card ${student.isShared ? 'student-card--shared' : ''}`}
      onClick={() => goToEdit(student)}
    >
      <View className='card-left'>
        <View className='avatar'>
          {student.name === '默认学生' ? '默' : student.name.charAt(0)}
        </View>
        <View className='info'>
          <View className='name-row'>
            <Text className='name'>{student.name}</Text>
            {student.isShared && <Text className='shared-tag'>共享</Text>}
          </View>
          <Text className='desc'>
            {student.school || '未完善学校'}
            {student.grade ? ` (${student.grade})` : ' (未完善年级)'}
          </Text>
        </View>
      </View>
      <View className='card-right'>
        {student.isShared ? (
          <Text className='readonly-hint'>只读</Text>
        ) : (
          <>
            <Text className='iconfont card-side-icon'>&#xe704;</Text>
            <Text className='iconfont card-side-icon'>&#xe631;</Text>
          </>
        )}
      </View>
    </View>
  )

  return (
    <View className='manage-page'>
      <View className='tip-card'>
        <View className='tip-item'>
          <Text className='tip-dot'>•</Text>
          <Text className='tip-text'>完善信息有助于家人接送、应急等不时之需。</Text>
        </View>
        <View className='tip-item'>
          <Text className='tip-dot'>•</Text>
          <Text className='tip-text'>最少需保留 1 位学生。支持多位学生的课表管理，适用于多孩家庭。</Text>
        </View>
        <View className='tip-item'>
          <Text className='tip-dot'>•</Text>
          <Text className='tip-text'>升学后，请记得修改学生信息。</Text>
        </View>
        <View className='tip-item'>
          <Text className='tip-dot'>•</Text>
          <Text className='tip-text'>家人共享的学生仅供查看，不支持编辑或删除。</Text>
        </View>
      </View>

      <View className='list-header'>
        <Text className='list-count'>我的学生 {ownStudents.length} 位</Text>
        <View className='add-btn' onClick={goToAdd}>
          <Text className='add-icon'>+</Text>
          <Text className='add-text'>增加学生</Text>
        </View>
      </View>

      <View className='student-list'>
        {ownStudents.map(renderStudentCard)}
      </View>

      {sharedStudents.length > 0 && (
        <>
          <View className='list-header list-header--shared'>
            <Text className='list-count'>家人共享 {sharedStudents.length} 位</Text>
          </View>
          <View className='student-list'>
            {sharedStudents.map(renderStudentCard)}
          </View>
        </>
      )}
    </View>
  )
}
