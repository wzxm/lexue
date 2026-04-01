import { View, Text, Input, Picker, Button, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { createCourse, updateCourse } from '../../api/course.api'
import { useScheduleStore } from '../../store/schedule.store'
import type { WeekDay, PeriodIndex, WeekType, Course } from '../../types/index'
import { DEFAULT_PERIODS } from '../../constants/periods'
import CourseNameSheet from './components/CourseNameSheet'
import './index.scss'

const WEEK_TYPE_OPTIONS = [
  { label: '每周', value: 'all' as WeekType },
  { label: '单周', value: 'odd' as WeekType },
  { label: '双周', value: 'even' as WeekType },
]
const PERIOD_LABELS = DEFAULT_PERIODS.map(p => `第${p.index}节 ${p.startTime}`)
const DEFAULT_COURSE_COLOR = 'red'

interface Section {
  period: PeriodIndex | null
  periodIndex: number
  weekday: WeekDay
  weekType: WeekType
  weekTypeIndex: number
  classroom: string
}

export default function CourseFormPage() {
  const router = useRouter()
  const mode = (router.params.mode || 'add') as 'add' | 'edit'
  const routeScheduleId = router.params.scheduleId || ''
  const routeCourseId = router.params.courseId || ''
  const routeWeekday = router.params.weekday
  const routePeriod = router.params.period

  const currentSchedule = useScheduleStore(s => s.currentSchedule)
  const addCourseToStore = useScheduleStore(s => s.addCourse)
  const updateCourseInStore = useScheduleStore(s => s.updateCourse)

  const [name, setName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [contact, setContact] = useState('')
  const [sections, setSections] = useState<Section[]>([
    {
      period: routePeriod ? (Number(routePeriod) as PeriodIndex) : null,
      periodIndex: routePeriod ? Number(routePeriod) - 1 : 0,
      weekday: routeWeekday ? (Number(routeWeekday) as WeekDay) : 1,
      weekType: 'all',
      weekTypeIndex: 0,
      classroom: '',
    },
  ])
  const [scheduleId, setScheduleId] = useState(routeScheduleId)
  const [loading, setLoading] = useState(false)
  const [showNameSheet, setShowNameSheet] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && routeCourseId) {
      const course = currentSchedule?.courses.find(c => c.id === routeCourseId)
      if (course) {
        setName(course.name)
        setTeacher(course.teacher || '')
        setContact(course.contact || '')
        const wti = Math.max(0, WEEK_TYPE_OPTIONS.findIndex(o => o.value === course.weekType))
        setSections([
          {
            period: course.period,
            periodIndex: course.period - 1,
            weekday: course.weekday,
            weekType: course.weekType,
            weekTypeIndex: wti,
            classroom: course.classroom || '',
          },
        ])
        setScheduleId(course.scheduleId)
      }
      Taro.setNavigationBarTitle({ title: '修改课程' })
    } else {
      Taro.setNavigationBarTitle({ title: '添加课程' })
    }
  }, [])

  const updateSection = (index: number, patch: Partial<Section>) => {
    setSections(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const addSection = () => {
    const w = sections[0]?.weekday ?? 1
    setSections(prev => [
      ...prev,
      {
        period: null,
        periodIndex: 0,
        weekday: w,
        weekType: 'all',
        weekTypeIndex: 0,
        classroom: '',
      },
    ])
  }

  const removeSection = (index: number) => {
    setSections(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const onSave = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: '课程名称不能为空', icon: 'none' })
      return
    }
    if (!scheduleId) {
      Taro.showToast({ title: '课表数据异常，请返回重试', icon: 'none' })
      return
    }
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i]
      if (s.period == null) {
        Taro.showToast({ title: `请选择课节 ${i + 1} 的节数`, icon: 'none' })
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'edit' && routeCourseId) {
        const s = sections[0]
        const existing = currentSchedule?.courses.find(c => c.id === routeCourseId)
        const base = {
          name: name.trim(),
          weekday: s.weekday,
          period: s.period!,
          teacher: teacher.trim(),
          classroom: s.classroom.trim(),
          color: existing?.color ?? DEFAULT_COURSE_COLOR,
          weekType: s.weekType,
          note: '',
          ...(contact.trim() ? { contact: contact.trim() } : {}),
        }
        await updateCourse(routeCourseId, base as Partial<Course>)
        if (existing) {
          updateCourseInStore({
            ...existing,
            ...base,
          } as Course)
        }
      } else {
        for (const s of sections) {
          const payload = {
            scheduleId,
            name: name.trim(),
            weekday: s.weekday,
            period: s.period!,
            teacher: teacher.trim(),
            classroom: s.classroom.trim(),
            color: DEFAULT_COURSE_COLOR,
            weekType: s.weekType,
            note: '',
            ...(contact.trim() ? { contact: contact.trim() } : {}),
          }
          const created = await createCourse(payload as Omit<Course, 'id'>)
          addCourseToStore(created)
        }
      }
      Taro.navigateBack()
    } catch (err: any) {
      Taro.showToast({ title: err.message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='page'>
      <ScrollView scrollY className='page-scroll'>
        <View className='form-card'>
          <View className='form-item border-bottom' onClick={() => setShowNameSheet(true)}>
            <Text className='form-label'>名称</Text>
            <Text className={name ? 'form-value' : 'form-placeholder'}>
              {name || '填写课程名称'}
            </Text>
          </View>
          <View className='form-item border-bottom'>
            <Text className='form-label'>老师</Text>
            <Input
              className='form-input'
              placeholder='选填'
              placeholderClass='form-input-ph'
              value={teacher}
              maxlength={20}
              onInput={e => setTeacher(e.detail.value)}
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>联系方式</Text>
            <Input
              className='form-input'
              placeholder='选填'
              placeholderClass='form-input-ph'
              value={contact}
              maxlength={40}
              onInput={e => setContact(e.detail.value)}
            />
          </View>
        </View>

        {sections.map((section, index) => (
          <View key={index}>
            <View className='section-header'>
              <Text className='section-label'>课节 {index + 1}</Text>
              {sections.length > 1 && (
                <Text className='section-delete' onClick={() => removeSection(index)}>
                  删除
                </Text>
              )}
            </View>
            <View className='form-card'>
              <Picker
                mode='selector'
                range={PERIOD_LABELS}
                value={section.periodIndex}
                onChange={e => {
                  const idx = Number(e.detail.value)
                  updateSection(index, {
                    periodIndex: idx,
                    period: (idx + 1) as PeriodIndex,
                  })
                }}
              >
                <View className='form-item border-bottom'>
                  <Text className='form-label'>节数</Text>
                  <View className='form-arrow'>
                    <Text
                      className={section.period != null ? 'form-value' : 'form-placeholder'}
                    >
                      {section.period != null ? PERIOD_LABELS[section.periodIndex] : '请选择'}
                    </Text>
                    <Text className='arrow'>›</Text>
                  </View>
                </View>
              </Picker>
              <Picker
                mode='selector'
                range={WEEK_TYPE_OPTIONS.map(o => o.label)}
                value={section.weekTypeIndex}
                onChange={e => {
                  const idx = Number(e.detail.value)
                  updateSection(index, {
                    weekTypeIndex: idx,
                    weekType: WEEK_TYPE_OPTIONS[idx].value,
                  })
                }}
              >
                <View className='form-item border-bottom'>
                  <Text className='form-label'>周数</Text>
                  <View className='form-arrow'>
                    <Text className='form-value'>
                      {WEEK_TYPE_OPTIONS[section.weekTypeIndex]?.label ?? '请选择'}
                    </Text>
                    <Text className='arrow'>›</Text>
                  </View>
                </View>
              </Picker>
              <View className='form-item'>
                <Text className='form-label'>教室</Text>
                <Input
                  className='form-input'
                  placeholder='选填'
                  placeholderClass='form-input-ph'
                  value={section.classroom}
                  maxlength={20}
                  onInput={e => updateSection(index, { classroom: e.detail.value })}
                />
              </View>
            </View>
          </View>
        ))}

        {mode === 'add' && (
          <View className='add-section' onClick={addSection}>
            <Text className='add-section-text'>+增加课节</Text>
          </View>
        )}
      </ScrollView>

      <View className='footer'>
        <Button className='save-btn' onClick={onSave} loading={loading} disabled={loading}>
          保存
        </Button>
      </View>

      <CourseNameSheet
        show={showNameSheet}
        onClose={() => setShowNameSheet(false)}
        onSelect={n => {
          setName(n)
          setShowNameSheet(false)
        }}
      />
    </View>
  )
}
