import { View, Text, Button, Image } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { recognizeScheduleImage } from '../../api/ai.api'
import { batchImportCoursesWithOverwrite } from '../../api/course.api'
import { getSchedule } from '../../api/schedule.api'
import { useScheduleStore, buildGrid } from '../../store/schedule.store'
import { useAuthStore } from '../../store/auth.store'
import { ROUTES } from '../../constants/routes'
import { DEFAULT_PERIODS } from '../../constants/periods'
import { DEFAULT_COURSE_COLOR, COURSE_COLORS } from '../../constants/colors'
import { getCurrentWeekOffset, getWeekDates, formatDate } from '../../utils/date'
import { chooseMediaSource } from '../../utils/media'
import { buildAllWeeks, buildOffWeekSlotKeys, findCoursesAtSlot, formatWeeksSummary } from '../../utils/weeks'
import ScheduleGrid from '../schedule/components/ScheduleGrid'
import CourseEditModal from './components/CourseEditModal'
import type { Course, Schedule } from '../../types/index'
import '../schedule/index.scss'
import './index.scss'

function getDatePathParts(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return { year, month, day }
}

function getCourseColor(name: string, index: number) {
  const seed = Array.from(name || '').reduce((sum, char) => sum + char.charCodeAt(0), index)
  return COURSE_COLORS[seed % COURSE_COLORS.length]?.hex || DEFAULT_COURSE_COLOR
}

export default function ScheduleAiPage() {
  const router = useRouter()
  const scheduleId = router.params.scheduleId || ''
  const currentSchedule = useScheduleStore(s => s.currentSchedule)
  const setCurrentSchedule = useScheduleStore(s => s.setCurrentSchedule)
  const userInfo = useAuthStore(s => s.userInfo)

  const [fileId, setFileId] = useState('')
  const [loading, setLoading] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [aiConfidence, setAiConfidence] = useState<'high' | 'medium' | 'low' | ''>('')
  const [reviewItems, setReviewItems] = useState<string[]>([])
  const [draftCourses, setDraftCourses] = useState<Omit<Course, 'id'>[]>([])
  const [previewFilePath, setPreviewFilePath] = useState('')
  const [previewImageVisible, setPreviewImageVisible] = useState(false)
  const [previewWeekOffset, setPreviewWeekOffset] = useState(0)
  const [step, setStep] = useState<'pick' | 'preview'>('pick')
  const [editingCourse, setEditingCourse] = useState<{course: Omit<Course, 'id'>, index: number} | null>(null)

  const uncertainCount = useMemo(
    () => draftCourses.filter(c => c.remark?.includes('[待确认]')).length,
    [draftCourses]
  )

  const schedule = useMemo(() => {
    if (currentSchedule?.id === scheduleId) return currentSchedule
    return null
  }, [currentSchedule, scheduleId])

  const totalWeeks = schedule?.total_weeks || schedule?.totalWeeks || 20
  const periods = schedule?.periods?.length ? schedule.periods : DEFAULT_PERIODS
  const hideWeekend = userInfo?.settings?.hide_weekend ?? false
  const normalizedDraftCourses = useMemo(() => {
    const weeksFallback = buildAllWeeks(totalWeeks)
    return (draftCourses || []).map(course => ({
      ...course,
      weeks: Array.isArray(course.weeks) && course.weeks.length > 0 ? course.weeks : weeksFallback,
    }))
  }, [draftCourses, totalWeeks])

  const previewCourses = useMemo<Course[]>(
    () => normalizedDraftCourses.map((course, index) => ({
      ...course,
      id: `preview-${index}`,
    })),
    [normalizedDraftCourses]
  )

  const previewSchedule = useMemo<Schedule | null>(() => {
    if (!schedule) return null
    return {
      ...schedule,
      courses: previewCourses,
    }
  }, [schedule, previewCourses])

  useEffect(() => {
    if (!schedule) return
    const startDate = schedule.start_date || schedule.startDate
    const total = schedule.total_weeks || schedule.totalWeeks || 20
    const offset = startDate ? getCurrentWeekOffset(startDate) : 0
    setPreviewWeekOffset(Math.max(0, Math.min(offset, total - 1)))
  }, [schedule?.id, schedule?.start_date, schedule?.startDate, schedule?.total_weeks, schedule?.totalWeeks])

  const previewWeekDates = useMemo(
    () => getWeekDates(previewWeekOffset, schedule?.start_date || schedule?.startDate),
    [previewWeekOffset, schedule?.start_date, schedule?.startDate]
  )

  const previewToday = useMemo(() => formatDate(new Date(), 'YYYY-MM-DD'), [])
  const previewGrid = useMemo(
    () => buildGrid(previewSchedule, previewWeekOffset),
    [previewSchedule, previewWeekOffset]
  )
  const previewWeekNum = previewWeekOffset + 1
  const offWeekSlotKeys = useMemo(
    () => buildOffWeekSlotKeys(previewCourses, previewWeekNum),
    [previewCourses, previewWeekNum]
  )

  const openDraftCourse = (course: Course) => {
    const index = previewCourses.findIndex(item => item.id === course.id)
    if (index < 0) return
    const draft = draftCourses[index]
    if (draft) setEditingCourse({ course: draft, index })
  }

  const handlePreviewSlotTap = async (weekday: number, period: number) => {
    const slotCourses = findCoursesAtSlot(previewCourses, weekday, period, previewWeekNum, 2)
    if (slotCourses.length === 0) return
    if (slotCourses.length === 1) {
      openDraftCourse(slotCourses[0])
      return
    }
    try {
      const { tapIndex } = await Taro.showActionSheet({
        itemList: slotCourses.map((item) => {
          const label = formatWeeksSummary(item.weeks || [], totalWeeks)
          return `${item.name}（${label}）`
        }),
      })
      const target = slotCourses[tapIndex]
      if (target) openDraftCourse(target)
    } catch {
      // 用户取消
    }
  }

  const unmountedRef = useRef(false)
  useEffect(() => {
    return () => { unmountedRef.current = true }
  }, [])

  const jumpToSchedule = () => {
    Taro.switchTab({ url: ROUTES.SCHEDULE }).catch(() => {
      Taro.navigateBack({ delta: 1 })
    })
  }

  // 页面 mount 时一次性做权限 & 数据检查，不随响应式状态重复触发路由
  useEffect(() => {
    Taro.setNavigationBarTitle({ title: 'AI识别课表' })
    if (!useAuthStore.getState().isLoggedIn) {
      Taro.navigateTo({ url: ROUTES.LOGIN })
      return
    }
    if (!scheduleId) {
      Taro.showToast({ title: '课表ID缺失', icon: 'none' })
      Taro.navigateBack()
      return
    }
    const { currentSchedule: cur } = useScheduleStore.getState()
    if (cur?.id !== scheduleId) {
      void getSchedule(scheduleId)
        .then((full) => {
          if (!unmountedRef.current) setCurrentSchedule(full)
        })
        .catch((err: any) => {
          if (unmountedRef.current) return
          Taro.showToast({ title: err?.message || '课表加载失败', icon: 'none' })
          Taro.navigateBack()
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePickImage = async () => {
    if (recognizing || loading) return
    try {
      const sourceType = await chooseMediaSource()
      if (!sourceType) return
      const media = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: [sourceType],
      })
      const file = media.tempFiles?.[0]
      const filePath = file?.tempFilePath
      if (!filePath) return
      const lowerPath = filePath.toLowerCase()
      const mimeType = lowerPath.endsWith('.png')
        ? 'image/png'
        : lowerPath.endsWith('.gif')
          ? 'image/gif'
          : lowerPath.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg'

      setLoading(true)
      Taro.showLoading({ title: '上传中', mask: true })

      const ext = (filePath.split('.').pop() || 'jpg').toLowerCase()
      const { year, month, day } = getDatePathParts()
      const cloudPath = `schedule-ai/${year}-${month}-${day}/${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`
      const uploadRes = await Taro.cloud.uploadFile({
        cloudPath,
        filePath,
      })

      setFileId(uploadRes.fileID)
      setPreviewFilePath(filePath)
      Taro.hideLoading()
      await handleRecognize(uploadRes.fileID, mimeType)
    } catch (err: any) {
      Taro.hideLoading()
      if (err?.errMsg?.includes('cancel')) return
      Taro.showToast({ title: err?.message || '上传失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleRecognize = async (targetFileId = fileId, mimeType = 'image/jpeg') => {
    if (!scheduleId || !targetFileId) return
    setRecognizing(true)
    try {
      Taro.showLoading({ title: 'AI识别中', mask: true })
      const result = await recognizeScheduleImage({
          scheduleId,
          fileId: targetFileId,
          mimeType,
        })

      const schedulePeriods = schedule?.periods?.length || 0
      const maxWeeks = totalWeeks
      const normalized = (result.courses || [])
        .map((course, index) => {
          const weeks = Array.isArray(course.weeks) && course.weeks.length > 0
            ? course.weeks
            : buildAllWeeks(maxWeeks)
          return {
            ...course,
            name: String(course.name || '').trim(),
            teacher: String(course.teacher || '').trim(),
            room: String(course.room || '').trim(),
            contact: String(course.contact || '').trim(),
            remark: String(course.remark || '').trim(),
            color: getCourseColor(course.name, index),
            weeks,
          }
        })
        .filter(course => course.name && course.day_of_week >= 1 && course.day_of_week <= 7 && course.slot >= 1 && course.slot <= Math.max(1, schedulePeriods || 12))

      setWarnings(result.warnings || [])
      setAiConfidence(result.confidence || '')
      setReviewItems((result.reviewItems || []).map(item => item.message).filter(Boolean))
      setDraftCourses(normalized)
      setPreviewImageVisible(false)
      setStep('preview')
    } catch (err: any) {
      // showToast 与 showLoading 共用同一原生层，必须先 hideLoading 再提示；
      // 云函数 fail() 会拼出 "INTERNAL_ERROR: xxx"，过长时 toast 会直接不显示。
      Taro.hideLoading()
      const raw = String(err?.message || '').trim()
      const message = raw.replace(/^[A-Z_]+:\s*/, '') || '识别失败，请稍后重试或换一张更清晰的图片'
      Taro.showModal({
        title: '识别失败',
        content: message,
        showCancel: false,
        confirmText: '知道了',
      })
    } finally {
      Taro.hideLoading()
      setRecognizing(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!scheduleId) return
    if (!normalizedDraftCourses.length) {
      Taro.showToast({ title: '没有可导入的课程', icon: 'none' })
      return
    }
    try {
      Taro.showLoading({ title: '导入中', mask: true })
      await batchImportCoursesWithOverwrite(scheduleId, normalizedDraftCourses)
      const full = await getSchedule(scheduleId)
      setCurrentSchedule(full)
      Taro.hideLoading()
      Taro.showModal({
        title: '导入成功',
        content: '课程导入成功，若大模型识别有误，您可点击具体课程进行修改。',
        showCancel: false,
        confirmText: '知道了',
        success: () => {
          jumpToSchedule()
        },
      })
    } catch (err: any) {
      Taro.hideLoading()
      Taro.showToast({ title: err?.message || '导入失败', icon: 'none' })
    }
  }

  return (
    <View className='schedule-ai-page'>
      <View className='hero'>
        <Text className='eyebrow'>AI识别</Text>
        <Text className='title'>拍照识别课程表</Text>
        <Text className='desc'>上传照片，AI自动整理可导入的课程。</Text>
      </View>

      {step === 'pick' && (
        <View className='card'>
          <Button className='primary-btn' onClick={handlePickImage} disabled={loading || recognizing}>
            {loading || recognizing ? '处理中...' : '拍照 / 相册识别课表'}
          </Button>
          <Text className='tip'>支持相册图片和现场拍照。建议选择清晰、正向、包含完整星期和节次的课表图。</Text>
        </View>
      )}

      {step === 'preview' && (
        <>
          {previewFilePath ? (
            <View className='preview-block'>
              <Text className='section-title'>原图预览</Text>
              <View className='preview-image-wrap' onClick={() => setPreviewImageVisible(true)}>
                <Image className='preview-image' src={previewFilePath} mode='aspectFit' />
                <View className='preview-image-mask'>
                  <Text className='preview-image-mask-text'>点击放大</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View className={`card preview-card${hideWeekend ? ' preview-card--hide-weekend' : ''}`}>
            <View className='preview-header'>
              <View className='list-header'>
                <Text className='section-title'>课表预览</Text>
                <Text className='count'>
                  第 {previewWeekOffset + 1} 周 · {normalizedDraftCourses.length} 条
                </Text>
              </View>
              {uncertainCount > 0 || aiConfidence === 'low' || reviewItems.length > 0 ? (
                <Text className='preview-hint preview-hint--warn'>
                  共识别 {normalizedDraftCourses.length} 门课程{uncertainCount > 0 ? `，其中 ${uncertainCount} 门待确认` : ''}{aiConfidence === 'low' ? '，整体置信度较低' : ''}，建议点击检查
                </Text>
              ) : (
                <Text className='preview-hint'>
                  共识别 {normalizedDraftCourses.length} 门课程{aiConfidence === 'high' ? '，识别置信度较高' : ''}
                </Text>
              )}
            </View>
            {previewSchedule ? (
              <ScheduleGrid
                weekNum={previewWeekNum}
                weekDates={previewWeekDates}
                today={previewToday}
                periods={periods}
                grid={previewGrid}
                totalWeeks={totalWeeks}
                startDate={schedule?.start_date || schedule?.startDate}
                setWeekOffset={setPreviewWeekOffset}
                onTapCourse={(course) => handlePreviewSlotTap(course.day_of_week, course.slot)}
                onTapEmpty={(weekday, period) => { void handlePreviewSlotTap(weekday, period) }}
                offWeekSlotKeys={offWeekSlotKeys}
                interactive
                allowWeekPicker
                highlightToday={false}
                hideWeekend={hideWeekend}
                highlightUncertain
              />
            ) : (
              <Text className='tip'>当前课表信息未加载完成，稍后再试。</Text>
            )}
          </View>

          {(warnings.length > 0 || reviewItems.length > 0) && (
            <View className='card warning-card'>
              <Text className='section-title'>识别提示</Text>
              {reviewItems.map((item, index) => (
                <Text key={`review-${item}-${index}`} className='warning-line warning-line--review'>{item}</Text>
              ))}
              {warnings.map((warning, index) => (
                <Text key={`${warning}-${index}`} className='warning-line'>{warning}</Text>
              ))}
            </View>
          )}

          <Text className='edit-tip'>点击课程可编辑或删除</Text>

          <View className='footer'>
            <Button className='ghost-btn' onClick={() => setStep('pick')}>重新选择</Button>
            <Button className='primary-btn' onClick={handleConfirmImport} disabled={draftCourses.length === 0}>
              确认导入
            </Button>
          </View>

          <CourseEditModal
            visible={!!editingCourse}
            course={editingCourse?.course || null}
            courseIndex={editingCourse?.index ?? -1}
            periods={schedule?.periods?.length || 8}
            totalWeeks={totalWeeks}
            onSave={(index, updated) => {
              const newCourses = [...draftCourses]
              newCourses[index] = updated
              setDraftCourses(newCourses)
              setEditingCourse(null)
            }}
            onDelete={(index) => {
              setDraftCourses(draftCourses.filter((_, i) => i !== index))
              setEditingCourse(null)
            }}
            onClose={() => setEditingCourse(null)}
          />

          {previewImageVisible && (
            <View className='image-modal' onClick={() => setPreviewImageVisible(false)}>
              <View className='image-modal-inner' onClick={(e) => e.stopPropagation()}>
                <Image className='image-modal-img' src={previewFilePath} mode='aspectFit' />
                <Text className='image-modal-tip'>点击空白处关闭</Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  )
}
