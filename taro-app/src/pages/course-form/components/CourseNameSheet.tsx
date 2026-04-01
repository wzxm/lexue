import { View, Text, Input, PageContainer, ScrollView } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { listCoursePresets, addCoursePreset, deleteCoursePreset, type CourseNamePreset } from '../../../api/course.api'
import { GRADE_PRESETS, type GradeLevel } from '../../../constants/course-presets'
import './CourseNameSheet.scss'

export interface CourseNameSheetProps {
  show: boolean
  onClose: () => void
  onSelect: (name: string) => void
  onAfterLeave?: () => void
}

export default function CourseNameSheet({ show, onClose, onSelect, onAfterLeave }: CourseNameSheetProps) {
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('middle')
  const [inputValue, setInputValue] = useState('')
  const [presets, setPresets] = useState<CourseNamePreset[]>([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  const loadPresets = useCallback(async () => {
    try {
      const list = await listCoursePresets()
      setPresets(Array.isArray(list) ? list : [])
    } catch {
      setPresets([])
    }
  }, [])

  useEffect(() => {
    if (!show) return
    setInputValue('')
    loadPresets()
  }, [show, loadPresets])

  const gradePreset = GRADE_PRESETS.find(g => g.key === gradeLevel)
  const systemCourses = gradePreset?.courses ?? []
  const systemSet = new Set(systemCourses.map(n => n.trim()))
  const userForGrade = presets.filter(p => p.gradeLevel === gradeLevel)
  const userOnly = userForGrade.filter(p => !systemSet.has(p.name.trim()))

  const pickName = (name: string) => {
    onSelect(name.trim())
    onClose()
  }

  const onSaveCustom = async () => {
    const name = inputValue.trim()
    if (!name) {
      Taro.showToast({ title: '请输入课程名称', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await addCoursePreset(name, gradeLevel)
      await loadPresets()
      pickName(name)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const onDeleteCustom = async (e: any, id: string) => {
    e.stopPropagation()
    if (!id || deletingId === id) return
    setDeletingId(id)
    try {
      await deleteCoursePreset(id)
      await loadPresets()
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '删除失败', icon: 'none' })
    } finally {
      setDeletingId('')
    }
  }

  return (
    <PageContainer
      show={show}
      position='bottom'
      round
      zIndex={1000}
      onClickOverlay={onClose}
      onAfterLeave={onAfterLeave ?? onClose}
    >
      <View className='cn-sheet'>
        <View className='cn-sheet__header'>
          <Text className='cn-sheet__close' onClick={onClose}>✕</Text>
          <Text className='cn-sheet__title'>课程名称</Text>
          <View className='cn-sheet__header-slot' />
        </View>

        <View className='cn-sheet__input-row'>
          <Text className='cn-sheet__input-icon'>✏️</Text>
          <Input
            className='cn-sheet__input'
            placeholder='请输入课程名称'
            placeholderClass='cn-sheet__input-ph'
            value={inputValue}
            maxlength={20}
            onInput={e => setInputValue(e.detail.value)}
          />
          {inputValue.length > 0 && (
            <Text className='cn-sheet__clear' onClick={() => setInputValue('')}>⊗</Text>
          )}
          <Text
            className={`cn-sheet__save ${saving ? 'cn-sheet__save--disabled' : ''}`}
            onClick={() => {
              if (saving) return
              onSaveCustom()
            }}
          >
            保存
          </Text>
        </View>

        <Text className='cn-sheet__hint'>不想打字？选择常用课程</Text>

        <View className='cn-sheet__tabs'>
          {GRADE_PRESETS.map(tab => (
            <View
              key={tab.key}
              className={`cn-sheet__tab ${gradeLevel === tab.key ? 'cn-sheet__tab--active' : ''}`}
              onClick={() => setGradeLevel(tab.key)}
            >
              <Text className='cn-sheet__tab-text'>{tab.label}</Text>
              {gradeLevel === tab.key && <View className='cn-sheet__tab-line' />}
            </View>
          ))}
        </View>

        <ScrollView scrollY className='cn-sheet__chips-scroll'>
          <View className='cn-sheet__chips'>
            {systemCourses.map(name => (
              <View
                key={`s-${name}`}
                className='cn-sheet__chip'
                onClick={() => pickName(name)}
              >
                <Text className='cn-sheet__chip-text'>{name}</Text>
              </View>
            ))}
            {userOnly.map(p => (
              <View
                key={p.id}
                className='cn-sheet__chip cn-sheet__chip--custom'
                onClick={() => pickName(p.name)}
              >
                <Text className='cn-sheet__chip-text'>{p.name}</Text>
                <View
                  className='cn-sheet__chip-delete'
                  onClick={(e) => onDeleteCustom(e, p.id)}
                >
                  <Text className='cn-sheet__chip-delete-icon'>✕</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </PageContainer>
  )
}
