import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import { useState, useEffect, useMemo, useRef } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { createCourse, updateCourse, listCourses } from '../../api/course.api'
import { useScheduleStore } from '../../store/schedule.store'
import type { WeekDay, PeriodIndex, Course } from '../../types/index'
import { resolveCourseId } from '../../utils/courseId'
import CourseNameSheet from './components/CourseNameSheet'
import PeriodGridSheet, { type SlotSelection } from './components/PeriodGridSheet'
import WeekPickerSheet from './components/WeekPickerSheet'
import './index.scss'

const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']
const DEFAULT_COURSE_COLOR = 'red'

interface Section {
  day_of_week: WeekDay | 0
  slot: PeriodIndex | 0
  weeks: number[]
  room: string
}

function formatWeeksSummary(weeks: number[], totalWeeks: number): string {
  if (weeks.length === 0 || weeks.length === totalWeeks) return '每周'
  const allOdd = Array.from({ length: totalWeeks }, (_, i) => i + 1).filter(w => w % 2 === 1)
  const allEven = Array.from({ length: totalWeeks }, (_, i) => i + 1).filter(w => w % 2 === 0)
  if (weeks.length === allOdd.length && allOdd.every(w => weeks.includes(w))) return '单周'
  if (weeks.length === allEven.length && allEven.every(w => weeks.includes(w))) return '双周'
  if (weeks.length <= 5) return `第${weeks.join(',')}周`
  return `${weeks.length}周`
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

  const totalWeeks = currentSchedule?.total_weeks || currentSchedule?.totalWeeks || 20
  const periodCount = currentSchedule?.periods?.length || 8

  const occupiedSlots: SlotSelection[] = useMemo(() => {
    if (!currentSchedule) return []
    return currentSchedule.courses
      .filter(c =>
        mode === 'edit'
          ? resolveCourseId(c) !== String(routeCourseId)
          : true
      )
      .map(c => ({ day_of_week: c.day_of_week, slot: c.slot }))
  }, [currentSchedule, mode, routeCourseId])

  const [name, setName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [contact, setContact] = useState('')
  const [sections, setSections] = useState<Section[]>(() => {
    if (routeWeekday && routePeriod) {
      return [{
        day_of_week: Number(routeWeekday) as WeekDay,
        slot: Number(routePeriod) as PeriodIndex,
        weeks: [],
        room: '',
      }]
    }
    return [{ day_of_week: 0, slot: 0, weeks: [], room: '' }]
  })
  const [scheduleId, setScheduleId] = useState(routeScheduleId)
  const [loading, setLoading] = useState(false)
  // 微信 page-container 全局只能存在一个实例，用双状态管理：
  // shownSheet  = 当前 show=true 的弹窗（驱动进/出场动画）
  // mountedSheet = 当前挂载在 DOM 里的弹窗（onAfterLeave 后置 null 卸载）
  type SheetState =
    | { type: 'name' }
    | { type: 'period' }
    | { type: 'week'; index: number }

  const [shownSheet, setShownSheet] = useState<SheetState | null>(null)
  const [mountedSheet, setMountedSheet] = useState<SheetState | null>(null)

  const openSheet = (sheet: SheetState) => {
    setMountedSheet(sheet)
    setShownSheet(sheet)
  }
  const closeSheet = () => setShownSheet(null)
  const unmountSheet = () => setMountedSheet(null)

  /** 编辑页：仅在首次拿到课程数据时回填，避免 [] 依赖导致挂载时 store 尚未就绪而无法回显 */
  const editHydratedCourseIdRef = useRef<string | null>(null)

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: mode === 'edit' ? '修改课程' : '添加课程' })
  }, [mode])

  useEffect(() => {
    if (mode !== 'edit' || !routeCourseId) {
      editHydratedCourseIdRef.current = null
      return
    }

    const matchRoute = (c: Course & { _id?: string }) =>
      resolveCourseId(c) === String(routeCourseId)

    const tryApply = (course: Course) => {
      if (editHydratedCourseIdRef.current === routeCourseId) return
      editHydratedCourseIdRef.current = routeCourseId

      setName(course.name)
      setTeacher(course.teacher || '')
      setContact(course.contact || '')
      setSections([{
        day_of_week: course.day_of_week,
        slot: course.slot,
        weeks: course.weeks || [],
        room: course.room || '',
      }])
      setScheduleId(course.schedule_id)
    }

    const fromStore = currentSchedule?.courses.find(matchRoute)
    if (fromStore) {
      tryApply(fromStore)
      return
    }

    const sid = routeScheduleId || currentSchedule?.id
    if (!sid) return

    let cancelled = false
    listCourses(sid)
      .then(courses => {
        if (cancelled) return
        const c = courses.find(x => matchRoute(x))
        if (c) tryApply(c)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [mode, routeCourseId, currentSchedule, routeScheduleId])

  const updateSection = (index: number, patch: Partial<Section>) => {
    setSections(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const removeSection = (index: number) => {
    setSections(prev => prev.filter((_, i) => i !== index))
  }

  // 多选确认：按已有 slot 保留周数/教室数据，新 slot 创建空课节
  const handlePeriodGridConfirm = (selections: SlotSelection[]) => {
    setSections(prev => {
      const keepMap = new Map<string, Section>()
      for (const s of prev) {
        if (s.slot > 0) keepMap.set(`${s.day_of_week}-${s.slot}`, s)
      }
      if (selections.length === 0) {
        return [{ day_of_week: 0, slot: 0, weeks: [], room: '' }]
      }
      return selections.map(sel => {
        const key = `${sel.day_of_week}-${sel.slot}`
        return keepMap.get(key) ?? { day_of_week: sel.day_of_week, slot: sel.slot, weeks: [], room: '' }
      })
    })
    closeSheet()
  }

  const addSection = () => {
    setSections(prev => [...prev, { day_of_week: 0, slot: 0, weeks: [], room: '' }])
  }

  // 已选课节的 slot（传给选格器用于高亮展示）
  const selectedSlots: SlotSelection[] = sections
    .filter(s => s.slot > 0)
    .map(s => ({ day_of_week: s.day_of_week as WeekDay, slot: s.slot as PeriodIndex }))

  // 保留方法名，兼容热更新期间对旧渲染闭包的引用。
  const getOccupiedForSection = (_index?: number): SlotSelection[] => occupiedSlots

  const formatSectionSlot = (s: Section): string => {
    if (!s.slot || !s.day_of_week) return ''
    return `周${WEEKDAY_SHORT[s.day_of_week - 1]} 第${s.slot}节`
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
    if (sections.length === 0) {
      Taro.showToast({ title: '请至少添加一个课节', icon: 'none' })
      return
    }
    const unset = sections.find(s => !s.slot || !s.day_of_week)
    if (unset) {
      Taro.showToast({ title: '请为每个课节选择节数', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      if (mode === 'edit' && routeCourseId) {
        const s = sections[0]
        const existing = currentSchedule?.courses.find(
          c => resolveCourseId(c) === String(routeCourseId)
        )
        const base: Partial<Course> = {
          name: name.trim(),
          day_of_week: s.day_of_week as WeekDay,
          slot: s.slot as PeriodIndex,
          teacher: teacher.trim(),
          room: s.room.trim(),
          color: existing?.color ?? DEFAULT_COURSE_COLOR,
          weeks: s.weeks,
          remark: '',
          ...(contact.trim() ? { contact: contact.trim() } : {}),
        }
        await updateCourse(routeCourseId, base)
        if (existing) {
          updateCourseInStore({ ...existing, ...base } as Course)
        }
      } else {
        for (const s of sections) {
          const payload: Omit<Course, 'id'> = {
            schedule_id: scheduleId,
            name: name.trim(),
            day_of_week: s.day_of_week as WeekDay,
            slot: s.slot as PeriodIndex,
            teacher: teacher.trim(),
            room: s.room.trim(),
            color: DEFAULT_COURSE_COLOR,
            weeks: s.weeks,
            remark: '',
            ...(contact.trim() ? { contact: contact.trim() } : {}),
          }
          const created = await createCourse(payload)
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
        {/* 基本信息 */}
        <View className='form-card'>
          <View className='form-item border-bottom' onClick={() => openSheet({ type: 'name' })}>
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

        {/* 课节列表 */}
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
              <View
                className='form-item border-bottom'
                onClick={() => openSheet({ type: 'period' })}
              >
                <Text className='form-label'>节数</Text>
                <View className='form-arrow'>
                  <Text className={section.slot ? 'form-value' : 'form-placeholder'}>
                    {formatSectionSlot(section) || '请选择'}
                  </Text>
                  <Text className='arrow'>›</Text>
                </View>
              </View>
              <View
                className='form-item border-bottom'
                onClick={() => openSheet({ type: 'week', index })}
              >
                <Text className='form-label'>周数</Text>
                <View className='form-arrow'>
                  <Text className='form-value'>
                    {formatWeeksSummary(section.weeks, totalWeeks)}
                  </Text>
                  <Text className='arrow'>›</Text>
                </View>
              </View>
              <View className='form-item'>
                <Text className='form-label'>教室</Text>
                <Input
                  className='form-input'
                  placeholder='选填'
                  placeholderClass='form-input-ph'
                  value={section.room}
                  maxlength={20}
                  onInput={e => updateSection(index, { room: e.detail.value })}
                />
              </View>
            </View>
          </View>
        ))}

        {/* 增加课节按钮 */}
        {mode === 'add' && (
          <View className='add-section' onClick={addSection}>
            <Text className='add-section-text'>+增加课节</Text>
          </View>
        )}

        {/* 底部留白，防止内容被 fixed footer 遮挡 */}
        <View className='scroll-bottom-spacer' />
      </ScrollView>

      <View className='footer'>
        <Button className='save-btn' onClick={onSave} loading={loading} disabled={loading}>
          {loading ? '' : '保存'}
        </Button>
      </View>

      {mountedSheet?.type === 'name' && (
        <CourseNameSheet
          show={shownSheet?.type === 'name'}
          onClose={closeSheet}
          onAfterLeave={unmountSheet}
          onSelect={n => {
            setName(n)
            closeSheet()
          }}
        />
      )}

      {mountedSheet?.type === 'period' && (
        <PeriodGridSheet
          show={shownSheet?.type === 'period'}
          periodCount={periodCount}
          selected={selectedSlots}
          occupied={getOccupiedForSection()}
          onClose={closeSheet}
          onAfterLeave={unmountSheet}
          onConfirm={handlePeriodGridConfirm}
        />
      )}

      {mountedSheet?.type === 'week' && (
        <WeekPickerSheet
          show={shownSheet?.type === 'week'}
          totalWeeks={totalWeeks}
          selectedWeeks={sections[(mountedSheet as { type: 'week'; index: number }).index]?.weeks || []}
          onCancel={closeSheet}
          onAfterLeave={unmountSheet}
          onConfirm={weeks => {
            updateSection((mountedSheet as { type: 'week'; index: number }).index, { weeks })
            closeSheet()
          }}
        />
      )}
    </View>
  )
}
