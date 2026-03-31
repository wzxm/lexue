import { View, Text, Input, Picker, Button, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { createStudent, updateStudent, deleteStudent } from '../../api/student.api'
import { useStudentStore } from '../../store/student.store'
import type { Student } from '../../types/index'
import './index.scss'

const GRADE_OPTIONS = [
  '小学，一年级', '小学，二年级', '小学，三年级', '小学，四年级', '小学，五年级', '小学，六年级',
  '初中，一年级', '初中，二年级', '初中，三年级',
  '高中，一年级', '高中，二年级', '高中，三年级',
]

export default function StudentFormPage() {
  const router = useRouter()
  const mode = (router.params.mode || 'add') as 'add' | 'edit'
  const studentId = router.params.studentId || ''

  const students = useStudentStore(s => s.students)
  const addStudentToStore = useStudentStore(s => s.addStudent)
  const updateStudentInStore = useStudentStore(s => s.updateStudent)
  const removeStudentFromStore = useStudentStore(s => s.removeStudent)

  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [grade, setGrade] = useState('小学，一年级')
  const [gender, setGender] = useState<number>(0) // 0=未选, 1=男, 2=女
  const [gradeIndex, setGradeIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && studentId) {
      const student = students.find(s => s.id === studentId)
      if (student) {
        setName(student.name)
        setSchool(student.school || '')
        setGrade(student.grade || '小学，一年级')
        setGender(student.gender || 0)
        
        const gIdx = GRADE_OPTIONS.indexOf(student.grade)
        setGradeIndex(gIdx >= 0 ? gIdx : 0)
      }
    }
    Taro.setNavigationBarTitle({ title: mode === 'edit' ? '学生信息' : '学生信息' })
  }, [])

  const onGradeChange = (e: any) => {
    const idx = Number(e.detail.value)
    setGradeIndex(idx)
    setGrade(GRADE_OPTIONS[idx])
  }

  const onSave = async () => {
    if (!name.trim()) { Taro.showToast({ title: '姓名不能为空', icon: 'none' }); return }

    setLoading(true)
    const payload: Omit<Student, 'id'> = {
      name: name.trim(),
      school: school.trim(),
      grade,
      gender,
    }

    try {
      if (mode === 'edit' && studentId) {
        await updateStudent(studentId, payload)
        updateStudentInStore({ id: studentId, ...payload } as Student)
      } else {
        const created = await createStudent(payload)
        addStudentToStore(created)
      }
      Taro.navigateBack()
    } catch (err: any) {
      Taro.showToast({ title: err.message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const onDelete = () => {
    const targetStudent = students.find(s => s.id === studentId)
    const targetName = targetStudent?.name || '该学生'

    Taro.showModal({
      title: '',
      content: `确定删除【${targetName}】的所有课表信息？\n该操作不可恢复，请审慎确认。`,
      confirmText: '确认删除',
      confirmColor: '#FF5252',
      cancelText: '取消',
      cancelColor: '#999999',
      success: async (res) => {
        if (res.confirm) {
          Taro.showLoading({ title: '删除中...' })
          try {
            await deleteStudent(studentId)
            removeStudentFromStore(studentId)
            Taro.navigateBack()
          } catch (err: any) {
            Taro.showToast({ title: err.message || '删除失败', icon: 'none' })
          } finally {
            Taro.hideLoading()
          }
        }
      }
    })
  }

  return (
    <View className='form-page'>
      <ScrollView scrollY className='form-body'>
        <View className='form-group-title'>昵称或姓名</View>
        <View className='form-card'>
          <Input 
            className='name-input' 
            placeholder='请输入学生姓名' 
            placeholderClass='input-placeholder'
            value={name} 
            onInput={(e) => setName(e.detail.value)} 
            maxlength={20} 
          />
        </View>

        <View className='form-group-title mt-40'>就读信息</View>
        <View className='form-card'>
          <View className='form-row border-bottom'>
            <Text className='row-label'>学龄段</Text>
            <Picker mode='selector' range={GRADE_OPTIONS} value={gradeIndex} onChange={onGradeChange}>
              <View className='row-value-wrap'>
                <Text className={`row-value ${grade ? '' : 'placeholder'}`}>
                  {grade || '请选择'}
                </Text>
                <Text className='row-arrow'>›</Text>
              </View>
            </Picker>
          </View>
          <View className='form-row'>
            <Text className='row-label'>学校</Text>
            <View className='row-value-wrap' style={{ flex: 1 }}>
              <Input 
                className='school-input' 
                placeholder='请完善' 
                placeholderClass='input-placeholder'
                value={school} 
                onInput={(e) => setSchool(e.detail.value)} 
                maxlength={30} 
              />
              <Text className='row-arrow'>›</Text>
            </View>
          </View>
        </View>

        <View className='form-group-title mt-40'>性别</View>
        <View className='gender-row'>
          <View className='gender-option' onClick={() => setGender(1)}>
            <View className={`radio-circle ${gender === 1 ? 'active' : ''}`}>
              {gender === 1 && <Text className='radio-inner'>✓</Text>}
            </View>
            <Text className='gender-text'>男</Text>
          </View>
          <View className='gender-option' onClick={() => setGender(2)}>
            <View className={`radio-circle ${gender === 2 ? 'active' : ''}`}>
              {gender === 2 && <Text className='radio-inner'>✓</Text>}
            </View>
            <Text className='gender-text'>女</Text>
          </View>
        </View>
      </ScrollView>

      <View className='form-footer'>
        <Button className='btn-save' onClick={onSave} loading={loading} disabled={loading}>保存</Button>
        {mode === 'edit' && students.length > 1 && (
          <View className='btn-delete' onClick={onDelete}>删除</View>
        )}
      </View>
    </View>
  )
}

