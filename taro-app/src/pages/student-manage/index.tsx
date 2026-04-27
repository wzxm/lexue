import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo } from 'react'
import { listStudents, deleteStudent } from '../../api/student.api'
import { useStudentStore } from '../../store/student.store'
import { ROUTES } from '../../constants/routes'
import type { Student } from '../../types/index'
import './index.scss'

type SharedStudentGroup = {
  key: string
  parentName: string
  students: Student[]
}

const MAX_NAME_LENGTH = 7

function getDisplayName(name: string) {
  if (name.length <= MAX_NAME_LENGTH) return name
  return `${name.slice(0, MAX_NAME_LENGTH)}...`
}

function getSharedParentKey(student: Student) {
  return student.sharedFromOpenId || student.ownerOpenId || `unknown-${student.id}`
}

function getSharedParentName(student: Student) {
  return student.sharedFromNickname || '家长'
}

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

  const { ownStudents, sharedGroups } = useMemo(() => {
    const own: Student[] = []
    const sharedMap = new Map<string, SharedStudentGroup>()
    for (const s of students) {
      if (!s.isShared) {
        own.push(s)
        continue
      }

      const key = getSharedParentKey(s)
      const parentName = getSharedParentName(s)
      if (!sharedMap.has(key)) {
        sharedMap.set(key, { key, parentName, students: [] })
      }
      sharedMap.get(key)!.students.push(s)
    }
    return { ownStudents: own, sharedGroups: Array.from(sharedMap.values()) }
  }, [students])

  const goToAdd = () => {
    Taro.navigateTo({ url: `${ROUTES.STUDENT_FORM}?mode=add` })
  }

  const goToEdit = (student: Student) => {
    Taro.navigateTo({ url: `${ROUTES.STUDENT_FORM}?mode=edit&studentId=${student.id}` })
  }

  const handleDelete = (e: any, student: Student) => {
    e.stopPropagation()
    if (student.source === 'init') {
      Taro.showToast({ title: '默认学生不可删除', icon: 'none' })
      return
    }
    if (!student.isShared && ownStudents.length <= 1) {
      Taro.showToast({ title: '至少保留 1 位学生', icon: 'none' })
      return
    }
    Taro.showModal({
      title: '删除学生',
      content: `确定删除「${student.name}」？相关课表和课程也会一并删除。`,
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: async ({ confirm }) => {
        if (!confirm) return
        try {
          await deleteStudent(student.id)
          await fetchStudents()
          Taro.showToast({ title: '已删除', icon: 'success' })
        } catch (err: any) {
          Taro.showToast({ title: err.message || '删除失败', icon: 'none' })
        }
      },
    })
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
            <Text className='name'>{getDisplayName(student.name)}</Text>
            {student.isShared && <Text className='shared-tag'>共享</Text>}
            {student.source === 'init' && <Text className='init-tag'>默认</Text>}
          </View>
          <Text className='desc'>
            {student.school || '未完善学校'}
            {student.grade ? ` (${student.grade})` : ' (未完善年级)'}
          </Text>
        </View>
      </View>
      <View className='card-right'>
        <>
          <Text className='iconfont card-side-icon' onClick={(e) => { e.stopPropagation(); goToEdit(student) }}>&#xe704;</Text>
          <Text
            className={`iconfont card-side-icon card-side-icon--delete ${student.source === 'init' ? 'card-side-icon--disabled' : ''}`}
            onClick={(e) => handleDelete(e, student)}
          >&#xe7c3;</Text>
        </>
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
          <Text className='tip-text'>家人共享的数据可共同维护，修改后会同步给对应家人。</Text>
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

      {sharedGroups.length > 0 && (
        <>
          {sharedGroups.map((group) => (
            <View key={group.key} className='shared-section'>
              <View className='list-header list-header--shared'>
                <Text className='list-count'>{group.parentName}共享 {group.students.length} 位</Text>
              </View>
              <View className='student-list'>
                {group.students.map(renderStudentCard)}
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  )
}
