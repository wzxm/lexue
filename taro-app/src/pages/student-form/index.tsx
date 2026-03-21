import { View, Text, Input, Picker, Button, ScrollView, Textarea } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { createStudent, updateStudent } from '../../api/student.api'
import { useStudentStore } from '../../store/student.store'
import type { Student } from '../../types/index'
import './index.scss'

const GRADE_OPTIONS = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三',
  '高一', '高二', '高三',
]

export default function StudentFormPage() {
  const router = useRouter()
  const mode = (router.params.mode || 'add') as 'add' | 'edit'
  const studentId = router.params.studentId || ''

  const students = useStudentStore(s => s.students)
  const addStudentToStore = useStudentStore(s => s.addStudent)
  const updateStudentInStore = useStudentStore(s => s.updateStudent)

  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [grade, setGrade] = useState('一年级')
  const [classNum, setClassNum] = useState('')
  const [enrollYear, setEnrollYear] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [note, setNote] = useState('')
  const [gradeIndex, setGradeIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && studentId) {
      const student = students.find(s => s.id === studentId)
      if (student) {
        setName(student.name)
        setSchool(student.school)
        setGrade(student.grade)
        setClassNum(student.classNum)
        setEnrollYear(student.enrollYear ? String(student.enrollYear) : '')
        setStudentNo(student.studentNo || '')
        setNote(student.note || '')
        setGradeIndex(GRADE_OPTIONS.indexOf(student.grade))
      }
    }
    Taro.setNavigationBarTitle({ title: mode === 'edit' ? '修改学生' : '添加学生' })
  }, [])

  const onGradeChange = (e: any) => {
    const idx = Number(e.detail.value)
    setGradeIndex(idx)
    setGrade(GRADE_OPTIONS[idx])
  }

  const onSave = async () => {
    if (!name.trim()) { Taro.showToast({ title: '姓名不能为空', icon: 'none' }); return }
    if (!school.trim()) { Taro.showToast({ title: '学校不能为空', icon: 'none' }); return }
    if (!classNum.trim()) { Taro.showToast({ title: '班级不能为空', icon: 'none' }); return }

    setLoading(true)
    const payload: Omit<Student, 'id'> = {
      name: name.trim(),
      school: school.trim(),
      grade,
      classNum: classNum.trim(),
      enrollYear: enrollYear ? Number(enrollYear) : undefined,
      studentNo: studentNo.trim() || undefined,
      note: note.trim() || undefined,
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

  return (
    <View className='form-page'>
      <ScrollView scrollY className='form-body'>
        <View className='avatar-section'>
          <View className='avatar-upload'>
            <View className='avatar-placeholder'>
              <Text className='avatar-camera'>📷</Text>
              <Text className='avatar-hint'>点击上传头像</Text>
            </View>
          </View>
        </View>

        <View className='form-section'>
          <View className='form-item border-bottom'>
            <Text className='form-label'>姓名 <Text className='required'>*</Text></Text>
            <Input className='form-input' placeholder='请输入学生姓名' placeholderClass='input-placeholder'
              value={name} onInput={(e) => setName(e.detail.value)} maxlength={20} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>学校 <Text className='required'>*</Text></Text>
            <Input className='form-input' placeholder='请输入所在学校' placeholderClass='input-placeholder'
              value={school} onInput={(e) => setSchool(e.detail.value)} maxlength={30} />
          </View>
        </View>

        <View className='form-section'>
          <View className='form-item border-bottom'>
            <Text className='form-label'>年级 <Text className='required'>*</Text></Text>
            <Picker mode='selector' range={GRADE_OPTIONS} value={gradeIndex} onChange={onGradeChange}>
              <View className='picker-value'>
                <Text className='picker-text'>{GRADE_OPTIONS[gradeIndex] || '请选择年级'}</Text>
                <Text className='picker-arrow'>›</Text>
              </View>
            </Picker>
          </View>
          <View className='form-item'>
            <Text className='form-label'>班级 <Text className='required'>*</Text></Text>
            <Input className='form-input' placeholder='如：3班' placeholderClass='input-placeholder'
              value={classNum} onInput={(e) => setClassNum(e.detail.value)} maxlength={10} />
          </View>
        </View>

        <View className='form-section'>
          <View className='form-item border-bottom'>
            <Text className='form-label'>入学年份</Text>
            <Input className='form-input' placeholder='选填' placeholderClass='input-placeholder'
              type='number' value={enrollYear} onInput={(e) => setEnrollYear(e.detail.value)} maxlength={4} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>学号</Text>
            <Input className='form-input' placeholder='选填' placeholderClass='input-placeholder'
              value={studentNo} onInput={(e) => setStudentNo(e.detail.value)} maxlength={20} />
          </View>
        </View>

        <View className='form-section'>
          <View className='form-item-textarea'>
            <Text className='form-label'>备注</Text>
            <Textarea className='form-textarea' placeholder='选填，添加一些备注...' placeholderClass='input-placeholder'
              value={note} onInput={(e) => setNote(e.detail.value)} maxlength={100} />
          </View>
        </View>
      </ScrollView>

      <View className='form-footer'>
        <Button className='btn-primary' onClick={onSave} loading={loading} disabled={loading}>保存</Button>
      </View>
    </View>
  )
}
