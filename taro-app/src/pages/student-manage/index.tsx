import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { listStudents } from '../../api/student.api'
import { useStudentStore } from '../../store/student.store'
import { ROUTES } from '../../constants/routes'
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

  const goToAdd = () => {
    Taro.navigateTo({ url: `${ROUTES.STUDENT_FORM}?mode=add` })
  }

  const goToEdit = (id: string) => {
    Taro.navigateTo({ url: `${ROUTES.STUDENT_FORM}?mode=edit&studentId=${id}` })
  }

  return (
    <View className='manage-page'>
      {/* 顶部提示卡片 */}
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
      </View>

      {/* 列表头部 */}
      <View className='list-header'>
        <Text className='list-count'>共 {students.length} 位学生</Text>
        <View className='add-btn' onClick={goToAdd}>
          <Text className='add-icon'>+</Text>
          <Text className='add-text'>增加学生</Text>
        </View>
      </View>

      {/* 学生列表 */}
      <View className='student-list'>
        {students.map((student) => (
          <View key={student.id} className='student-card' onClick={() => goToEdit(student.id)}>
            <View className='card-left'>
              <View className='avatar'>
                {student.name === '默认学生' ? '默' : student.name.charAt(0)}
              </View>
              <View className='info'>
                <View className='name-row'>
                  <Text className='name'>{student.name}</Text>
                </View>
                <Text className='desc'>
                  {student.school || '未完善学校'}
                  {student.grade ? ` (${student.grade})` : ' (未完善年级)'}
                </Text>
              </View>
            </View>
            <View className='card-right'>
              <Text className='iconfont card-side-icon'>&#xe704;</Text>
              <Text className='iconfont card-side-icon'>&#xe631;</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
