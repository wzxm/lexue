import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import { useState, useEffect, useMemo, useRef } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { createCourse, updateCourse, deleteCourse, listCourses } from '../../api/course.api'
import { useScheduleStore } from '../../store/schedule.store'
import { useStudentStore } from '../../store/student.store'
import type { WeekDay, PeriodIndex, Course } from '../../types/index'
import { resolveCourseId } from '../../utils/courseId'
import CourseNameSheet from './components/CourseNameSheet'
import PeriodGridSheet, { type SlotSelection } from './components/PeriodGridSheet'
import WeekPickerSheet from './components/WeekPickerSheet'
import type { GradeLevel } from '../../constants/course-presets'
import { DEFAULT_COURSE_COLOR } from '../../constants/colors'
import './index.scss'

const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']
const MAX_SECTIONS_EDIT = 2

interface Section {
  name: string
  teacher: string
  contact: string
  day_of_week: WeekDay | 0
  slot: PeriodIndex | 0
  weeks: number[]
  room: string
  /** 编辑模式下已存在的课程 id，新建课节为空 */
  courseId?: string
}

function createEmptySection(overrides?: Partial<Section>): Section {
  return {
    name: '',
    teacher: '',
    contact: '',
    day_of_week: 0,
    slot: 0,
    weeks: [],
    room: '',
    ...overrides,
  }
}

function buildAllWeeks(totalWeeks: number): number[] {
  return Array.from({ length: totalWeeks }, (_, i) => i + 1)
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

function resolveGradeLevelFromStudentGrade(grade?: string): GradeLevel {
  const text = (grade || '').trim()
  if (text.includes('小学')) return 'elementary'
  if (text.includes('初中')) return 'middle'
  if (text.includes('高中')) return 'high'
  if (text.includes('大学') || text.includes('本科') || text.includes('硕士') || text.includes('博士')) return 'college'
  return 'middle'
}

function intersectsWeeks(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0) return true
  const setB = new Set(b)
  return a.some(w => setB.has(w))
}

function courseToSection(course: Course, courseId?: string): Section {
  return {
    name: course.name,
    teacher: course.teacher || '',
    contact: course.contact || '',
    day_of_week: course.day_of_week,
    slot: course.slot,
    weeks: course.weeks || [],
    room: course.room || '',
    courseId,
  }
}

function sectionSlotKey(s: Pick<Section, 'day_of_week' | 'slot'>): string {
  return `${s.day_of_week}-${s.slot}`
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
  const removeCourseFromStore = useScheduleStore(s => s.removeCourse)
  const students = useStudentStore(s => s.students)
  const currentStudent = useStudentStore(s => s.currentStudent)

  const isEditingExisting = mode === 'edit' && Boolean(routeCourseId)
  const isEditUi = mode === 'edit'

  const totalWeeks = currentSchedule?.total_weeks || currentSchedule?.totalWeeks || 20
  const periodCount = currentSchedule?.periods?.length || 8

  const defaultCourseGradeLevel = useMemo<GradeLevel>(() => {
    const sid = currentSchedule?.student_id
    const scheduleStudent = sid ? students.find(s => s.id === sid) : null
    const grade = scheduleStudent?.grade || currentStudent?.grade
    return resolveGradeLevelFromStudentGrade(grade)
  }, [currentSchedule, students, currentStudent])

  const [sections, setSections] = useState<Section[]>(() => {
    if (routeWeekday && routePeriod) {
      return [createEmptySection({
        day_of_week: Number(routeWeekday) as WeekDay,
        slot: Number(routePeriod) as PeriodIndex,
      })]
    }
    return [createEmptySection()]
  })
  const [scheduleId, setScheduleId] = useState(routeScheduleId)
  const [loading, setLoading] = useState(false)
  // 微信 page-container 全局只能存在一个实例，用双状态管理：
  // shownSheet  = 当前 show=true 的弹窗（驱动进/出场动画）
  // mountedSheet = 当前挂载在 DOM 里的弹窗（onAfterLeave 后置 null 卸载）
  type SheetState =
    | { type: 'name'; index: number }
    | { type: 'period'; index: number }
    | { type: 'week'; index: number }

  const [shownSheet, setShownSheet] = useState<SheetState | null>(null)
  const [mountedSheet, setMountedSheet] = useState<SheetState | null>(null)
  const scrollTopRef = useRef(0)

  const occupiedSlots: SlotSelection[] = useMemo(() => {
    if (!currentSchedule) return []
    const editingIds = new Set(
      sections.map(s => s.courseId).filter(Boolean) as string[],
    )
    return (currentSchedule.courses || [])
      .filter(c => !editingIds.has(resolveCourseId(c)))
      .map(c => ({ day_of_week: c.day_of_week, slot: c.slot }))
  }, [currentSchedule, sections])

  const openSheet = (sheet: SheetState) => {
    if (isEditUi && sheet.type === 'period') return
    setMountedSheet(sheet)
    setShownSheet(sheet)
  }
  const closeSheet = () => setShownSheet(null)
  const unmountSheet = () => setMountedSheet(null)

  /** 编辑页：仅在首次拿到课程数据时回填，避免 [] 依赖导致挂载时 store 尚未就绪而无法回显 */
  const editHydratedCourseIdRef = useRef<string | null>(null)
  const originalEditCourseIdsRef = useRef<string[]>([])

  useEffect(() => {
    const allWeeks = buildAllWeeks(totalWeeks)
    setSections(prev => prev.map(section =>
      section.weeks.length === 0 ? { ...section, weeks: allWeeks } : section,
    ))
  }, [totalWeeks])

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: mode === 'edit' ? '修改课程' : '添加课程' })
  }, [mode])

  useEffect(() => {
    if (mode !== 'edit' || !routeCourseId) {
      editHydratedCourseIdRef.current = null
      originalEditCourseIdsRef.current = []
      return
    }

    const matchRoute = (c: Course & { _id?: string }) =>
      resolveCourseId(c) === String(routeCourseId)

    const tryApply = (course: Course, allCourses: Course[] = currentSchedule?.courses || []) => {
      if (editHydratedCourseIdRef.current === routeCourseId) return
      editHydratedCourseIdRef.current = routeCourseId

      const cid = resolveCourseId(course) || routeCourseId
      const primary = courseToSection(course, cid)
      const courseWeeks = course.weeks?.length ? course.weeks : buildAllWeeks(totalWeeks)
      const companion = allCourses.find(c => {
        const otherId = resolveCourseId(c)
        if (!otherId || otherId === cid) return false
        if (c.day_of_week !== course.day_of_week || c.slot !== course.slot) return false
        const cWeeks = c.weeks?.length ? c.weeks : buildAllWeeks(totalWeeks)
        return !intersectsWeeks(courseWeeks, cWeeks)
      })

      const nextSections = companion
        ? [primary, courseToSection(companion, resolveCourseId(companion))].slice(0, MAX_SECTIONS_EDIT)
        : [primary]
      originalEditCourseIdsRef.current = nextSections
        .map(s => s.courseId)
        .filter((id): id is string => Boolean(id))
      setSections(nextSections)
      setScheduleId(course.schedule_id)
    }

    const fromStore = currentSchedule?.courses.find(matchRoute)
    if (fromStore) {
      tryApply(fromStore, currentSchedule?.courses || [])
      return
    }

    const sid = routeScheduleId || currentSchedule?.id
    if (!sid) return

    let cancelled = false
    listCourses(sid)
      .then(courses => {
        if (cancelled) return
        const c = courses.find(x => matchRoute(x))
        if (c) tryApply(c, courses)
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

  // 按课节单独选格：允许不同课节选择同一天同一节（单双周互补）
  const handlePeriodGridConfirm = (selections: SlotSelection[]) => {
    if (mountedSheet?.type !== 'period') return
    const index = mountedSheet.index
    const pick = selections[0]
    if (!pick) {
      updateSection(index, { day_of_week: 0, slot: 0 })
    } else if (isEditUi && sections.length > 1) {
      setSections(prev => prev.map(s => ({
        ...s,
        day_of_week: pick.day_of_week,
        slot: pick.slot,
      })))
    } else {
      updateSection(index, { day_of_week: pick.day_of_week, slot: pick.slot })
    }
    closeSheet()
  }

  const addSection = () => {
    if (isEditUi && sections.length >= MAX_SECTIONS_EDIT) return
    setSections(prev => {
      const last = prev[prev.length - 1]
      return [...prev, createEmptySection({
        name: last?.name ?? '',
        teacher: last?.teacher ?? '',
        contact: last?.contact ?? '',
        day_of_week: last?.day_of_week ?? 0,
        slot: last?.slot ?? 0,
        weeks: buildAllWeeks(totalWeeks),
      })]
    })
  }

  const formatSectionSlot = (s: Section): string => {
    if (!s.slot || !s.day_of_week) return ''
    return `周${WEEKDAY_SHORT[s.day_of_week - 1]} 第${s.slot}节`
  }

  const onSave = async () => {
    if (!scheduleId) {
      Taro.showToast({ title: '课表数据异常，请返回重试', icon: 'none' })
      return
    }
    if (sections.length === 0) {
      Taro.showToast({ title: '请至少添加一个课节', icon: 'none' })
      return
    }
    const emptyNameIndex = sections.findIndex(s => !s.name.trim())
    if (emptyNameIndex >= 0) {
      Taro.showToast({ title: `请填写课节${emptyNameIndex + 1}的课程名称`, icon: 'none' })
      return
    }
    const unset = sections.find(s => !s.slot || !s.day_of_week)
    if (unset) {
      Taro.showToast({ title: '请为每个课节选择节数', icon: 'none' })
      return
    }

    const normalizedSections = sections.map(s => ({
      ...s,
      weeks: s.weeks.length > 0 ? s.weeks : buildAllWeeks(totalWeeks),
    }))

    if (isEditUi && normalizedSections.length > 1) {
      const baseKey = sectionSlotKey(normalizedSections[0])
      const slotMismatch = normalizedSections.find(s => sectionSlotKey(s) !== baseKey)
      if (slotMismatch) {
        Taro.showToast({ title: '多个课节须选择相同节数', icon: 'none' })
        return
      }
      for (let i = 0; i < normalizedSections.length; i++) {
        for (let j = i + 1; j < normalizedSections.length; j++) {
          if (intersectsWeeks(normalizedSections[i].weeks, normalizedSections[j].weeks)) {
            Taro.showToast({ title: `课节${i + 1}与课节${j + 1}周次冲突`, icon: 'none' })
            return
          }
        }
      }
    } else if (normalizedSections.length > 1) {
      for (let i = 0; i < normalizedSections.length; i++) {
        const left = normalizedSections[i]
        for (let j = i + 1; j < normalizedSections.length; j++) {
          const right = normalizedSections[j]
          if (
            left.day_of_week === right.day_of_week &&
            left.slot === right.slot &&
            intersectsWeeks(left.weeks, right.weeks)
          ) {
            Taro.showToast({ title: `课节${i + 1}与课节${j + 1}时间冲突`, icon: 'none' })
            return
          }
        }
      }
    }

    const editingIds = new Set(
      normalizedSections.map(s => s.courseId).filter(Boolean) as string[],
    )
    const existingCourses = (currentSchedule?.courses || []).filter(
      c => !editingIds.has(resolveCourseId(c)),
    )
    for (let i = 0; i < normalizedSections.length; i++) {
      const section = normalizedSections[i]
      const clash = existingCourses.find(c => {
        if (c.day_of_week !== section.day_of_week || c.slot !== section.slot) return false
        const existingWeeks = c.weeks && c.weeks.length > 0 ? c.weeks : buildAllWeeks(totalWeeks)
        return intersectsWeeks(section.weeks, existingWeeks)
      })
      if (clash) {
        Taro.showToast({ title: `课节${i + 1}与现有课程时间冲突`, icon: 'none' })
        return
      }
    }

    setLoading(true)
    try {
      const normalizeWeeks = (weeks: number[]) =>
        weeks.length > 0 ? weeks : buildAllWeeks(totalWeeks)

      if (isEditingExisting) {
        const keptIds = new Set(
          normalizedSections.map(s => s.courseId).filter(Boolean) as string[],
        )
        const removedIds = originalEditCourseIdsRef.current.filter(id => !keptIds.has(id))
        for (const id of removedIds) {
          await deleteCourse(id)
          removeCourseFromStore(id)
        }

        const existingById = new Map(
          (currentSchedule?.courses || []).map(c => [resolveCourseId(c), c]),
        )
        for (const s of normalizedSections) {
          const payload: Partial<Course> = {
            name: s.name.trim(),
            day_of_week: s.day_of_week as WeekDay,
            slot: s.slot as PeriodIndex,
            teacher: s.teacher.trim(),
            room: s.room.trim(),
            color: DEFAULT_COURSE_COLOR,
            weeks: normalizeWeeks(s.weeks),
            remark: '',
            contact: s.contact.trim(),
          }
          if (s.courseId) {
            await updateCourse(s.courseId, payload)
            const existing = existingById.get(s.courseId)
            if (existing) {
              updateCourseInStore({ ...existing, ...payload } as Course)
            }
          } else {
            const createPayload: Omit<Course, 'id'> = {
              schedule_id: scheduleId,
              ...payload,
              name: payload.name!,
              day_of_week: payload.day_of_week!,
              slot: payload.slot!,
              color: payload.color!,
              weeks: payload.weeks!,
            }
            const created = await createCourse(createPayload)
            addCourseToStore(created)
          }
        }
      } else {
        for (const s of normalizedSections) {
          const payload: Omit<Course, 'id'> = {
            schedule_id: scheduleId,
            name: s.name.trim(),
            day_of_week: s.day_of_week as WeekDay,
            slot: s.slot as PeriodIndex,
            teacher: s.teacher.trim(),
            room: s.room.trim(),
            color: DEFAULT_COURSE_COLOR,
            weeks: normalizeWeeks(s.weeks),
            remark: '',
            contact: s.contact.trim(),
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
      <ScrollView
        scrollY
        enhanced
        showScrollbar={false}
        className='page-scroll'
        scrollTop={scrollTopRef.current}
        scrollWithAnimation={false}
        onScroll={e => {
          scrollTopRef.current = e.detail.scrollTop
        }}
      >
        {/* 课节列表 */}
        {sections.map((section, index) => (
          <View className='form-card' key={index}>
            <View className='session-title'>
              <Text className='session-badge'>课节 {index + 1}</Text>
              {sections.length > 1 && (mode === 'add' || index > 0) && (
                <Text className='session-delete' onClick={() => removeSection(index)}>
                  删除
                </Text>
              )}
            </View>
            <View className='form-row' onClick={() => openSheet({ type: 'name', index })}>
              <Text className='form-label'>名称</Text>
              <View className='form-arrow'>
                <Text className={section.name ? 'form-value' : 'form-placeholder'}>
                  {section.name || '填写课程名称'}
                </Text>
                <View className='form-arrow-icon' />
              </View>
            </View>
            <View className='form-row'>
              <Text className='form-label'>老师</Text>
              <Input
                className='form-input'
                placeholder='选填'
                placeholderClass='form-input-ph'
                value={section.teacher}
                maxlength={20}
                onInput={e => updateSection(index, { teacher: e.detail.value })}
              />
            </View>
            <View className='form-row'>
              <Text className='form-label'>联系方式</Text>
              <Input
                className='form-input'
                placeholder='选填'
                placeholderClass='form-input-ph'
                value={section.contact}
                maxlength={40}
                onInput={e => updateSection(index, { contact: e.detail.value })}
              />
            </View>
            {isEditUi ? (
              <View className='form-row'>
                <Text className='form-label'>节数</Text>
                <Text className='form-value'>{formatSectionSlot(section) || '—'}</Text>
              </View>
            ) : (
              <View className='form-row' onClick={() => openSheet({ type: 'period', index })}>
                <Text className='form-label'>节数</Text>
                <View className='form-arrow'>
                  <Text className={section.slot ? 'form-value' : 'form-placeholder'}>
                    {formatSectionSlot(section) || '请选择'}
                  </Text>
                  <View className='form-arrow-icon' />
                </View>
              </View>
            )}
            <View className='form-row' onClick={() => openSheet({ type: 'week', index })}>
              <Text className='form-label'>周数</Text>
              <View className='form-arrow'>
                <Text className='form-value'>
                  {formatWeeksSummary(section.weeks, totalWeeks)}
                </Text>
                <View className='form-arrow-icon' />
              </View>
            </View>
            <View className='form-row'>
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
        ))}

        {/* 增加课节 */}
        {(mode === 'add' || (isEditUi && sections.length < MAX_SECTIONS_EDIT)) && (
          <View className='add-section' onClick={addSection}>
            <View className='add-section-icon' />
            <Text className='add-section-text'>增加课节</Text>
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
          defaultGradeLevel={defaultCourseGradeLevel}
          onClose={closeSheet}
          onAfterLeave={unmountSheet}
          onSelect={n => {
            updateSection(mountedSheet.index, { name: n })
            closeSheet()
          }}
        />
      )}

      {mountedSheet?.type === 'period' && !isEditUi && (
        <PeriodGridSheet
          show={shownSheet?.type === 'period'}
          periodCount={periodCount}
          singleSelect
          selected={
            sections[mountedSheet.index]?.slot > 0
              ? [{
                  day_of_week: sections[mountedSheet.index].day_of_week as WeekDay,
                  slot: sections[mountedSheet.index].slot as PeriodIndex,
                }]
              : []
          }
          occupied={occupiedSlots}
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
