import { View, Text, Picker, Button } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { createSchedule } from '../../api/schedule.api'
import { useStudentStore } from '../../store/student.store'
import { useScheduleStore } from '../../store/schedule.store'
import { ROUTES } from '../../constants/routes'
import type { Schedule, Period, PeriodIndex } from '../../types/index'
import './index.scss'

const SEMESTER_OPTIONS = [
  { label: '2024~2025 上学期', value: '2024-2025-1' },
  { label: '2024~2025 下学期', value: '2024-2025-2' },
  { label: '2025~2026 上学期', value: '2025-2026-1' },
  { label: '2025~2026 下学期', value: '2025-2026-2' },
  { label: '2026~2027 上学期', value: '2026-2027-1' },
  { label: '2026~2027 下学期', value: '2026-2027-2' },
]
const SEMESTER_LABELS = SEMESTER_OPTIONS.map(o => o.label)

const MORNING_SLOTS = [
  { startTime: '08:10', endTime: '08:55' }, { startTime: '09:05', endTime: '09:50' },
  { startTime: '10:10', endTime: '10:55' }, { startTime: '11:05', endTime: '11:50' },
  { startTime: '12:00', endTime: '12:45' }, { startTime: '13:00', endTime: '13:45' },
]
const AFTERNOON_SLOTS = [
  { startTime: '14:30', endTime: '15:15' }, { startTime: '15:25', endTime: '16:10' },
  { startTime: '16:20', endTime: '17:05' }, { startTime: '17:15', endTime: '18:00' },
  { startTime: '18:10', endTime: '18:55' }, { startTime: '19:00', endTime: '19:45' },
]
const EVENING_SLOTS = [
  { startTime: '19:00', endTime: '19:45' }, { startTime: '19:55', endTime: '20:40' },
  { startTime: '20:50', endTime: '21:35' }, { startTime: '21:45', endTime: '22:30' },
]

export default function ScheduleFormPage() {
  const students = useStudentStore(s => s.students)
  const currentStudent = useStudentStore(s => s.currentStudent)
  const addSchedule = useScheduleStore(s => s.addSchedule)
  const setCurrentSchedule = useScheduleStore(s => s.setCurrentSchedule)

  const [semesterIndex, setSemesterIndex] = useState(3)
  const [totalWeeks, setTotalWeeks] = useState(20)
  const [studentIndex, setStudentIndex] = useState(0)
  const [morningCount, setMorningCount] = useState(4)
  const [afternoonCount, setAfternoonCount] = useState(4)
  const [eveningCount, setEveningCount] = useState(3)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [currentScheduleId, setCurrentScheduleId] = useState<string | null>(null)

  const studentLabels = students.map(s => s.name)

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '新建课表' })
    if (currentStudent) {
      const idx = students.findIndex(s => s.id === currentStudent.id)
      if (idx >= 0) setStudentIndex(idx)
    }
  }, [])

  const buildPeriodList = useCallback((slots: { startTime: string; endTime: string }[], count: number, startIdx: number) => {
    return slots.slice(0, count).map((s, i) => ({
      index: startIdx + i, startTime: s.startTime, endTime: s.endTime, label: `第${startIdx + i}节`,
    }))
  }, [])

  const morningPeriods = buildPeriodList(MORNING_SLOTS, morningCount, 1)
  const afternoonPeriods = buildPeriodList(AFTERNOON_SLOTS, afternoonCount, morningCount + 1)
  const eveningPeriods = buildPeriodList(EVENING_SLOTS, eveningCount, morningCount + afternoonCount + 1)

  const buildPeriods = (): Period[] => {
    return [...morningPeriods, ...afternoonPeriods, ...eveningPeriods].map(p => ({
      index: p.index as PeriodIndex, startTime: p.startTime, endTime: p.endTime, label: p.label,
    }))
  }

  const onSave = async () => {
    if (students.length === 0) { Taro.showToast({ title: '请先添加学生', icon: 'none' }); return }
    const student = students[studentIndex]
    if (!student) { Taro.showToast({ title: '请选择归属学生', icon: 'none' }); return }
    const semester = SEMESTER_OPTIONS[semesterIndex]

    setLoading(true)
    Taro.showLoading({ title: '创建中', mask: true })
    try {
      const raw = await createSchedule({ studentId: student.id, name: `${semester.label}课表`, semester: semester.value })
      const r = raw as unknown as Record<string, unknown>
      const schedule: Schedule = {
        id: (r._id || r.id || '') as string,
        studentId: (r.student_id || student.id) as string,
        name: (r.name || `${semester.label}课表`) as string,
        semester: (r.semester || semester.value) as string,
        periods: buildPeriods(),
        courses: [],
        isDefault: (r.is_default ?? false) as boolean,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      addSchedule(schedule)
      setCurrentSchedule(schedule)
      Taro.showToast({ title: '创建成功', icon: 'success' })
      setTimeout(() => { setStep(2); setCurrentScheduleId(schedule.id) }, 500)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '创建失败', icon: 'none', duration: 3000 })
    } finally {
      Taro.hideLoading()
      setLoading(false)
    }
  }

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  return (
    <View className='sf-page'>
      <View className='steps'>
        <View className={`step ${step === 1 ? 'step--active' : 'step--done'}`}>
          <View className='step-icon'>📅</View>
          <Text className='step-label'>创建课表</Text>
        </View>
        <View className='step-line' />
        <View className={`step ${step === 2 ? 'step--active' : 'step--inactive'}`}>
          <View className={`step-icon ${step !== 2 ? 'step-icon--inactive' : ''}`}>📋</View>
          <Text className={`step-label ${step !== 2 ? 'step-label--inactive' : ''}`}>添加课程</Text>
        </View>
      </View>

      {step === 1 && (
        <>
          <View className='section'>
            <Picker mode='selector' range={SEMESTER_LABELS} value={semesterIndex} onChange={(e) => setSemesterIndex(Number(e.detail.value))}>
              <View className='list-item'>
                <Text className='list-label'>选择学年</Text>
                <View className='list-right'>
                  <Text className='list-value'>{SEMESTER_LABELS[semesterIndex]}</Text>
                  <Text className='list-arrow'>›</Text>
                </View>
              </View>
            </Picker>
            <View className='divider' />
            <View className='list-item'>
              <Text className='list-label'>本学期周数</Text>
              <View className='stepper'>
                <View className={`stepper-btn ${totalWeeks <= 1 ? 'stepper-btn--disabled' : ''}`}
                  onClick={() => setTotalWeeks(v => clamp(v - 1, 1, 52))}><Text>－</Text></View>
                <Text className='stepper-val'>{totalWeeks}</Text>
                <View className={`stepper-btn ${totalWeeks >= 52 ? 'stepper-btn--disabled' : ''}`}
                  onClick={() => setTotalWeeks(v => clamp(v + 1, 1, 52))}><Text>＋</Text></View>
              </View>
            </View>
            <View className='divider' />
            <Picker mode='selector' range={studentLabels} value={studentIndex} onChange={(e) => setStudentIndex(Number(e.detail.value))}>
              <View className='list-item'>
                <Text className='list-label'>归属学生</Text>
                <View className='list-right'>
                  <Text className='list-value'>{studentLabels[studentIndex] || '请选择'}</Text>
                  <Text className='list-arrow'>›</Text>
                </View>
              </View>
            </Picker>
          </View>

          <Text className='section-title'>设置时间</Text>
          <View className='section'>
            {/* 上午 */}
            <View className='list-item'>
              <View className='session-tag session-tag--morning'><Text>☀</Text></View>
              <Text className='list-label'>上午课程节数</Text>
              <View className='stepper'>
                <View className={`stepper-btn ${morningCount <= 1 ? 'stepper-btn--disabled' : ''}`}
                  onClick={() => setMorningCount(v => clamp(v - 1, 1, 6))}><Text>－</Text></View>
                <Text className='stepper-val'>{morningCount}</Text>
                <View className='stepper-btn' onClick={() => setMorningCount(v => clamp(v + 1, 1, 6))}><Text>＋</Text></View>
              </View>
            </View>
            {morningPeriods.map(p => (
              <View key={p.index} className='period-row'>
                <Text className='period-label'>{p.label}</Text>
                <Text className='period-time'>{p.startTime}-{p.endTime}</Text>
                <Text className='period-arrow'>›</Text>
              </View>
            ))}
            <View className='divider' />

            {/* 下午 */}
            <View className='list-item'>
              <View className='session-tag session-tag--afternoon'><Text>🌤</Text></View>
              <Text className='list-label'>下午课程节数</Text>
              <View className='stepper'>
                <View className={`stepper-btn ${afternoonCount <= 1 ? 'stepper-btn--disabled' : ''}`}
                  onClick={() => setAfternoonCount(v => clamp(v - 1, 1, 6))}><Text>－</Text></View>
                <Text className='stepper-val'>{afternoonCount}</Text>
                <View className='stepper-btn' onClick={() => setAfternoonCount(v => clamp(v + 1, 1, 6))}><Text>＋</Text></View>
              </View>
            </View>
            {afternoonPeriods.map(p => (
              <View key={p.index} className='period-row'>
                <Text className='period-label'>{p.label}</Text>
                <Text className='period-time'>{p.startTime}-{p.endTime}</Text>
                <Text className='period-arrow'>›</Text>
              </View>
            ))}
            <View className='divider' />

            {/* 晚上 */}
            <View className='list-item'>
              <View className='session-tag session-tag--evening'><Text>🌙</Text></View>
              <Text className='list-label'>晚上课程节数</Text>
              <View className='stepper'>
                <View className={`stepper-btn ${eveningCount <= 0 ? 'stepper-btn--disabled' : ''}`}
                  onClick={() => setEveningCount(v => clamp(v - 1, 0, 4))}><Text>－</Text></View>
                <Text className='stepper-val'>{eveningCount}</Text>
                <View className='stepper-btn' onClick={() => setEveningCount(v => clamp(v + 1, 0, 4))}><Text>＋</Text></View>
              </View>
            </View>
            {eveningPeriods.map(p => (
              <View key={p.index} className='period-row'>
                <Text className='period-label'>{p.label}</Text>
                <Text className='period-time'>{p.startTime}-{p.endTime}</Text>
                <Text className='period-arrow'>›</Text>
              </View>
            ))}
          </View>

          <View className='footer'>
            <Button className={`save-btn ${loading ? 'save-btn--loading' : ''}`} onClick={onSave} disabled={loading}>
              {loading ? '创建中...' : '保存'}
            </Button>
          </View>
        </>
      )}

      {step === 2 && (
        <>
          <Text className='step2-title'>选择添加课程方式</Text>
          <View className='section'>
            <View className='list-item' onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}>
              <Text className='list-label'>照片</Text>
              <View className='list-right'><Text className='list-value'>OCR识别</Text><Text className='list-arrow'>›</Text></View>
            </View>
            <View className='divider' />
            <View className='list-item' onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}>
              <Text className='list-label'>Excel</Text>
              <View className='list-right'><Text className='list-value'>AI识别</Text><Text className='list-arrow'>›</Text></View>
            </View>
            <View className='divider' />
            <View className='list-item' onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}>
              <Text className='list-label'>复制课表</Text>
              <View className='list-right'><Text className='list-value'>输入口令复制</Text><Text className='list-arrow'>›</Text></View>
            </View>
            <View className='divider' />
            <View className='list-item' onClick={() => {
              if (currentScheduleId) Taro.redirectTo({ url: `${ROUTES.COURSE_FORM}?mode=add&scheduleId=${currentScheduleId}` })
            }}>
              <Text className='list-label'>手动添加课程</Text>
              <View className='list-right'><Text className='list-arrow'>›</Text></View>
            </View>
          </View>
          <View className='step2-footer'>
            <Text className='add-later-text' onClick={() => Taro.navigateBack()}>稍后再添加</Text>
          </View>
        </>
      )}
    </View>
  )
}
