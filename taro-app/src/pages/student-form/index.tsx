import { View, Text, Input, Picker, Button, ScrollView, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { createStudent, updateStudent, deleteStudent } from '../../api/student.api'
import { useStudentStore } from '../../store/student.store'
import { useAuthStore } from '../../store/auth.store'
import type { Student } from '../../types/index'
import { chooseMediaSource } from '../../utils/media'
import './index.scss'

const GRADE_OPTIONS = [
  '小学，一年级', '小学，二年级', '小学，三年级', '小学，四年级', '小学，五年级', '小学，六年级',
  '初中，一年级', '初中，二年级', '初中，三年级',
  '高中，一年级', '高中，二年级', '高中，三年级',
  '大学，本科一年级', '大学，本科二年级', '大学，本科三年级', '大学，本科四年级',
  '大学，硕士一年级', '大学，硕士二年级', '大学，博士一年级', '大学，博士二年级', '大学，博士三年级',
]
const MAX_AVATAR_SIZE = 2 * 1024 * 1024

export default function StudentFormPage() {
  const router = useRouter()
  const mode = (router.params.mode || 'add') as 'add' | 'edit'
  const studentId = router.params.studentId || ''

  const students = useStudentStore(s => s.students)
  const userInfo = useAuthStore(s => s.userInfo)
  const addStudentToStore = useStudentStore(s => s.addStudent)
  const updateStudentInStore = useStudentStore(s => s.updateStudent)
  const removeStudentFromStore = useStudentStore(s => s.removeStudent)

  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [className, setClassName] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [grade, setGrade] = useState('小学，一年级')
  const [gender, setGender] = useState<number>(1) // 1=男, 2=女
  const [gradeIndex, setGradeIndex] = useState(0)
  const [avatar, setAvatar] = useState('')
  const [loading, setLoading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const targetStudent = students.find(s => s.id === studentId)

  useEffect(() => {
    if (mode === 'edit' && studentId) {
      const student = students.find(s => s.id === studentId)
      if (student) {
        setName(student.name)
        setSchool(student.school || '')
        setClassName(student.className || '')
        setStudentNo(student.studentNo || '')
        setGrade(student.grade || '小学，一年级')
        setGender(student.gender || 1)
        setAvatar(student.avatar || '')

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
      className: className.trim(),
      studentNo: studentNo.trim(),
      grade,
      gender,
      avatar,
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

  const getAvatarInitial = () => {
    if (name === '默认学生') return '默'
    return name?.trim()?.charAt(0) || '学'
  }

  const onChooseAvatar = async () => {
    if (avatarUploading) return
    try {
      const sourceType = await chooseMediaSource()
      if (!sourceType) return
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: [sourceType],
      })
      const filePath = res.tempFiles?.[0]?.tempFilePath
      const fileSize = res.tempFiles?.[0]?.size || 0
      if (!filePath) return
      if (fileSize > MAX_AVATAR_SIZE) {
        Taro.showToast({ title: '头像不能超过2MB', icon: 'none' })
        return
      }

      setAvatarUploading(true)
      Taro.showLoading({ title: '上传中...' })
      const ext = filePath.split('.').pop() || 'jpg'
      const openIdPrefix = userInfo?.openId?.slice(0, 8) || 'guest'
      const cloudPath = `student-avatar/${openIdPrefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`
      const uploadRes = await Taro.cloud.uploadFile({
        cloudPath,
        filePath,
      })
      setAvatar(uploadRes.fileID)
      Taro.showToast({ title: '头像已更新', icon: 'success' })
    } catch (err: any) {
      if (err?.errMsg?.includes('cancel')) return
      Taro.showToast({ title: err?.message || '上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setAvatarUploading(false)
    }
  }

  const onDelete = () => {
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
        <View className='avatar-section' onClick={onChooseAvatar}>
          <View className='avatar-wrap'>
            <View className='avatar-circle'>
              {avatar ? (
                <Image className='avatar-preview' src={avatar} mode='aspectFill' />
              ) : (
                <View className='avatar-preview avatar-preview--text'>{getAvatarInitial()}</View>
              )}
            </View>
            <View className='camera-badge'>
              <View className='camera-badge-icon' />
            </View>
          </View>
          <Text className='avatar-hint'>点击设置头像</Text>
        </View>

        <View className='form-card'>
          <View className='form-row border-bottom'>
            <Text className='row-label'>姓名</Text>
            <Input
              className='row-input'
              placeholder='输入学生姓名'
              placeholderClass='input-placeholder'
              value={name}
              onInput={(e) => setName(e.detail.value)}
              maxlength={20}
            />
          </View>

          <View className='form-row border-bottom gender-row-wrap'>
            <Text className='row-label'>性别</Text>
            <View className='gender-seg' role='radiogroup' aria-label='性别'>
              <View
                className={`seg-btn ${gender === 1 ? 'active' : ''}`}
                role='radio'
                aria-checked={gender === 1}
                onClick={() => setGender(1)}
              >
                男
              </View>
              <View
                className={`seg-btn ${gender === 2 ? 'active' : ''}`}
                role='radio'
                aria-checked={gender === 2}
                onClick={() => setGender(2)}
              >
                女
              </View>
            </View>
          </View>

          <View className='form-row border-bottom'>
            <Text className='row-label'>学校</Text>
            <Input
              className='row-input'
              placeholder='输入学校名称'
              placeholderClass='input-placeholder'
              value={school}
              onInput={(e) => setSchool(e.detail.value)}
              maxlength={30}
            />
          </View>

          <View className='form-row border-bottom'>
            <Text className='row-label'>班级（选填）</Text>
            <Input
              className='row-input'
              placeholder='输入班级'
              placeholderClass='input-placeholder'
              value={className}
              onInput={(e) => setClassName(e.detail.value)}
              maxlength={30}
            />
          </View>

          <View className='form-row border-bottom'>
            <Text className='row-label'>学号（选填）</Text>
            <Input
              className='row-input'
              placeholder='输入学号'
              placeholderClass='input-placeholder'
              value={studentNo}
              onInput={(e) => setStudentNo(e.detail.value)}
              maxlength={30}
            />
          </View>

          <View className='form-row'>
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
        </View>
      </ScrollView>

      <View className='form-footer'>
        {mode === 'edit' && (targetStudent?.isShared || students.filter((item) => !item.isShared).length > 1) && targetStudent?.source !== 'init' ? (
          <View className='footer-action-row'>
            <View className='btn-delete-inline' onClick={onDelete}>删除</View>
            <Button className='btn-save btn-save-inline' onClick={onSave} loading={loading} disabled={loading}>
              {loading ? '' : '保存'}
            </Button>
          </View>
        ) : (
          <Button className='btn-save' onClick={onSave} loading={loading} disabled={loading}>
            {loading ? '' : '保存'}
          </Button>
        )}
      </View>
    </View>
  )
}
