import { View, Text, Input, Picker, Button, ScrollView, Textarea } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { createCourse, updateCourse } from '../../api/course.api'
import { useScheduleStore } from '../../store/schedule.store'
import { COURSE_COLORS } from '../../constants/colors'
import { DEFAULT_PERIODS } from '../../constants/periods'
import type { WeekDay, PeriodIndex, WeekType } from '../../types/index'
import './index.scss'

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEK_TYPE_OPTIONS = [
  { label: '每周', value: 'all' },
  { label: '单周', value: 'odd' },
  { label: '双周', value: 'even' },
]
const PERIOD_LABELS = DEFAULT_PERIODS.map(p => `第${p.index}节 ${p.startTime}`)

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
  const [weekday, setWeekday] = useState<WeekDay>(1)
  const [period, setPeriod] = useState<PeriodIndex>(1)
  const [teacher, setTeacher] = useState('')
  const [classroom, setClassroom] = useState('')
  const [color, setColor] = useState('red')
  const [weekType, setWeekType] = useState<WeekType>('all')
  const [note, setNote] = useState('')
  const [weekdayIndex, setWeekdayIndex] = useState(0)
  const [periodIndex, setPeriodIndex] = useState(0)
  const [weekTypeIndex, setWeekTypeIndex] = useState(0)
  const [scheduleId, setScheduleId] = useState(routeScheduleId)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && routeCourseId) {
      const course = currentSchedule?.courses.find(c => c.id === routeCourseId)
      if (course) {
        setName(course.name)
        setWeekday(course.weekday)
        setPeriod(course.period)
        setTeacher(course.teacher || '')
        setClassroom(course.classroom || '')
        setColor(course.color)
        setWeekType(course.weekType)
        setNote(course.note || '')
        setWeekdayIndex(course.weekday - 1)
        setPeriodIndex(course.period - 1)
        setWeekTypeIndex(WEEK_TYPE_OPTIONS.findIndex(o => o.value === course.weekType))
        setScheduleId(course.scheduleId)
      }
    } else {
      if (routeWeekday) {
        const wd = Number(routeWeekday) as WeekDay
        setWeekday(wd)
        setWeekdayIndex(wd - 1)
      }
      if (routePeriod) {
        const p = Number(routePeriod) as PeriodIndex
        setPeriod(p)
        setPeriodIndex(p - 1)
      }
    }
    Taro.setNavigationBarTitle({ title: mode === 'edit' ? '修改课程' : '创建课表' })
  }, [])

  const onSave = async () => {
    if (!name.trim()) {
      Taro.showToast({ title: '课程名称不能为空', icon: 'none' })
      return
    }
    if (!scheduleId) {
      Taro.showToast({ title: '课表数据异常，请返回重试', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      if (mode === 'edit' && routeCourseId) {
        await updateCourse(routeCourseId, { name, weekday, period, teacher, classroom, color, weekType, note })
        updateCourseInStore({ id: routeCourseId, scheduleId, name, weekday, period, teacher, classroom, color, weekType, note })
      } else {
        const created = await createCourse({ scheduleId, name, weekday, period, teacher, classroom, color, weekType, note })
        addCourseToStore(created)
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
        <View className='hero-card'>
          <View className='hero-badge'>创建课表</View>
          <Text className='hero-title'>先录入第一节课</Text>
          <Text className='hero-desc'>填完这张卡片，就能把课表正式建起来；后续课程可以继续补充。</Text>
        </View>

        <View className='section-card'>
          <View className='section-head'>
            <Text className='section-title'>基础信息</Text>
            <Text className='section-tip'>必填</Text>
          </View>
          <View className='field-row field-row--column border-bottom'>
            <View className='field-label-wrap'>
              <Text className='field-label'>课程名称</Text>
              <Text className='field-required'>*</Text>
            </View>
            <Input className='field-input field-input--left' placeholder='例如：语文、数学、钢琴'
              placeholderClass='field-placeholder' value={name} onInput={(e) => setName(e.detail.value)} maxlength={20} />
          </View>
          <View className='field-row border-bottom'>
            <View className='field-label-wrap'>
              <Text className='field-label'>上课时间</Text>
              <Text className='field-required'>*</Text>
            </View>
            <View className='field-inline-pickers'>
              <Picker mode='selector' range={WEEKDAY_LABELS} value={weekdayIndex}
                onChange={(e) => { const idx = Number(e.detail.value); setWeekdayIndex(idx); setWeekday((idx + 1) as WeekDay) }}>
                <View className='picker-chip'>
                  <Text className='picker-chip-text'>{WEEKDAY_LABELS[weekdayIndex]}</Text>
                  <Text className='picker-chip-arrow'>▾</Text>
                </View>
              </Picker>
              <Picker mode='selector' range={PERIOD_LABELS} value={periodIndex}
                onChange={(e) => { const idx = Number(e.detail.value); setPeriodIndex(idx); setPeriod((idx + 1) as PeriodIndex) }}>
                <View className='picker-chip picker-chip--ghost'>
                  <Text className='picker-chip-text'>{PERIOD_LABELS[periodIndex]}</Text>
                  <Text className='picker-chip-arrow'>▾</Text>
                </View>
              </Picker>
            </View>
          </View>
          <View className='field-row'>
            <Text className='field-label'>单双周</Text>
            <Picker mode='selector' range={WEEK_TYPE_OPTIONS} rangeKey='label' value={weekTypeIndex}
              onChange={(e) => { const idx = Number(e.detail.value); setWeekTypeIndex(idx); setWeekType(WEEK_TYPE_OPTIONS[idx].value as WeekType) }}>
              <View className='picker-value'>
                <Text className='picker-value-text'>{WEEK_TYPE_OPTIONS[weekTypeIndex].label}</Text>
                <Text className='picker-value-arrow'>›</Text>
              </View>
            </Picker>
          </View>
        </View>

        <View className='section-card'>
          <View className='section-head'>
            <Text className='section-title'>补充信息</Text>
            <Text className='section-tip'>选填</Text>
          </View>
          <View className='field-row border-bottom'>
            <Text className='field-label'>任课老师</Text>
            <Input className='field-input' placeholder='填写老师姓名' placeholderClass='field-placeholder'
              value={teacher} onInput={(e) => setTeacher(e.detail.value)} maxlength={20} />
          </View>
          <View className='field-row border-bottom'>
            <Text className='field-label'>上课地点</Text>
            <Input className='field-input' placeholder='填写教室 / 培训地点' placeholderClass='field-placeholder'
              value={classroom} onInput={(e) => setClassroom(e.detail.value)} maxlength={20} />
          </View>
          <View className='field-area'>
            <View className='field-area-head'>
              <Text className='field-label'>备注</Text>
              <Text className='field-count'>{note.length}/50</Text>
            </View>
            <Textarea className='field-textarea' placeholder='例如：记得带画笔、穿校服' placeholderClass='field-placeholder'
              value={note} onInput={(e) => setNote(e.detail.value.slice(0, 50))} maxlength={50} />
          </View>
        </View>

        <View className='section-card'>
          <View className='section-head'>
            <Text className='section-title'>课程颜色</Text>
            <Text className='section-tip'>方便区分</Text>
          </View>
          <View className='color-grid'>
            {COURSE_COLORS.map((c) => (
              <View key={c.id}
                className={`color-item ${color === c.id ? 'color-item--active' : ''}`}
                onClick={() => setColor(c.id)}>
                <View className='color-dot' style={{ background: c.bg }} />
                {color === c.id && <Text className='color-check'>✓</Text>}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className='footer'>
        <Button className='submit-btn' onClick={onSave} loading={loading} disabled={loading}>
          {mode === 'edit' ? '保存修改' : '完成创建'}
        </Button>
      </View>
    </View>
  )
}
