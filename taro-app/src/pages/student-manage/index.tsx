import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo } from 'react'
import { listStudents } from '../../api/student.api'
import { useStudentStore } from '../../store/student.store'
import { ROUTES } from '../../constants/routes'
import type { Student } from '../../types/index'
import './index.scss'

const MAX_NAME_LENGTH = 7
const AVATAR_VARIANTS = ['blue', 'green', 'purple', 'orange'] as const

function getDisplayName(name: string) {
  if (name.length <= MAX_NAME_LENGTH) return name
  return `${name.slice(0, MAX_NAME_LENGTH)}...`
}

function getStudentInitial(student: Student) {
  if (student.name === '默认学生') return '默'
  return student.name?.charAt(0) || '学'
}

function getAvatarVariant(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i)
  return AVATAR_VARIANTS[hash % AVATAR_VARIANTS.length]
}

function getStudentSchoolLine(student: Student) {
  const school = student.school?.trim()
  const grade = student.grade?.trim()?.replace(/，/g, '')
  if (school && grade) return `${school} · ${grade}`
  if (school) return school
  if (grade) return grade
  return '未完善学校信息'
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
    Taro.navigateTo({ url: `${ROUTES.STUDENT_FORM}?mode=edit&studentId=${student.id}` })
  }

  const renderStudentCard = (student: Student) => (
    <View
      key={student.id}
      className='student-card'
      onClick={() => goToEdit(student)}
    >
      <View className={`avatar avatar--${getAvatarVariant(student.id)}`}>
        {student.avatar ? (
          <Image className='avatar-img' src={student.avatar} mode='aspectFill' />
        ) : (
          <Text className='avatar-initial'>{getStudentInitial(student)}</Text>
        )}
      </View>

      <View className='student-info'>
        <View className='student-name-row'>
          <Text className='student-name'>{getDisplayName(student.name)}</Text>
          {student.source === 'init' && !student.isShared ? (
            <Text className='init-tag'>默认</Text>
          ) : null}
        </View>
        <Text className='student-school'>{getStudentSchoolLine(student)}</Text>
        {student.isShared ? (
          <View className='shared-badge'>
            <View className='shared-badge-icon' />
            <Text className='shared-badge-text'>家人共享中</Text>
          </View>
        ) : null}
      </View>

      <View className='student-actions'>
        <View
          className={`action-icon ${student.isShared ? 'action-icon--view' : 'action-icon--edit'}`}
          onClick={(e) => {
            e.stopPropagation()
            goToEdit(student)
          }}
        />
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

      <View className='student-section'>
        <View className='group-header'>
          <Text className='group-title'>我的学生</Text>
          <Text className='group-count'>{ownStudents.length} 人</Text>
        </View>

        <View className='student-list'>
          {ownStudents.map(student => renderStudentCard(student))}
        </View>

        <View className='add-card' onClick={goToAdd}>
          <View className='add-card-icon' />
          <Text className='add-card-text'>添加学生</Text>
        </View>
      </View>

      {sharedStudents.length > 0 ? (
        <>
          <View className='section-gap' />
          <View className='student-section'>
            <View className='group-header'>
              <Text className='group-title'>共享学生</Text>
              <Text className='group-count'>{sharedStudents.length} 人</Text>
            </View>

            <View className='student-list'>
              {sharedStudents.map(student => renderStudentCard(student))}
            </View>
          </View>
        </>
      ) : null}
    </View>
  )
}
