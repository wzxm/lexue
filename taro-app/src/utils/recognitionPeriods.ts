import type { BackendPeriodConfig, Period, Schedule } from '../types/index'

const CLASS_PERIOD_LABEL = /第\s*(?:\d+|[一二三四五六七八九十]+)\s*节|上午\s*\d+|下午\s*\d+|晚上\s*\d+/
const READING_PERIOD_LABEL = /^(早读|晨读|午读|晚读)$/
const ACTIVITY_PERIOD_LABEL = /^(大课间.*|课间操|广播操|眼保健操|眼操|午休|午餐|早餐|晚餐|升旗|早操|听广播|课后|托管|体育锻炼|放学|课间|课后素质班|素质班|延时服务|延时托管|午间休息|课间休息|课后托管)$/
const TIME_TOKEN = '(?:[01]?\\d|2[0-3])[:.：点时][0-5]\\d(?:分)?|(?:[01]\\d|2[0-3])[0-5]\\d'
const TIME_RANGE_RE = new RegExp(`(${TIME_TOKEN})\\s*[-—–－～~至到]+\\s*(${TIME_TOKEN})`)

function normalizeTimeSource(value: unknown) {
  return String(value || '')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .trim()
}

function normalizeTimeText(value: unknown) {
  const raw = normalizeTimeSource(value)
    .replace(/[：.]/, ':')
    .replace(/[点时]/, ':')
    .replace(/分/g, '')
    .trim()
  let match = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!match && /^\d{3,4}$/.test(raw)) {
    const padded = raw.padStart(4, '0')
    match = [raw, padded.slice(0, 2), padded.slice(2)]
  }
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return ''
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function extractTimeRange(value: unknown) {
  const text = normalizeTimeSource(value)
  if (!text) return null
  const match = text.match(TIME_RANGE_RE)
  if (!match) return null
  const startTime = normalizeTimeText(match[1])
  const endTime = normalizeTimeText(match[2])
  if (startTime && endTime && startTime < endTime) return { startTime, endTime }
  return null
}

function extractPeriodTimes(period: Record<string, unknown>) {
  const startTime = normalizeTimeText(period.startTime || period.start_time)
  const endTime = normalizeTimeText(period.endTime || period.end_time)
  if (startTime && endTime && startTime < endTime) return { startTime, endTime }

  const blobs = [
    period.startTime,
    period.start_time,
    period.endTime,
    period.end_time,
    period.time,
    period.times,
    period.label,
    period.name,
  ]
  for (const blob of blobs) {
    const range = extractTimeRange(blob)
    if (range) return range
  }
  return { startTime: '', endTime: '' }
}

function durationMinutes(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  return endHour * 60 + endMinute - (startHour * 60 + startMinute)
}

function isActivityPeriod(period: { type?: unknown; label?: string; startTime?: string; endTime?: string }) {
  if (period.type === 'activity') return true
  const label = String(period.label || '').replace(/\s/g, '')
  if (CLASS_PERIOD_LABEL.test(label)) return false
  if (READING_PERIOD_LABEL.test(label)) {
    if (!period.startTime || !period.endTime) return true
    return durationMinutes(period.startTime, period.endTime) <= 15
  }
  if (ACTIVITY_PERIOD_LABEL.test(label) || /课后素质|延时服务|眼保健|大课间|午间休息|课后托管/.test(label)) return true
  if (period.startTime && period.endTime) {
    const duration = durationMinutes(period.startTime, period.endTime)
    if (duration > 0 && duration <= 15 && !CLASS_PERIOD_LABEL.test(label)) return true
  }
  return false
}

export function normalizeRecognitionPeriods(raw: unknown, maxCourseSlot = 0): Period[] {
  if (!Array.isArray(raw) || raw.length === 0) return []

  const parsed = raw
    .filter((period): period is Record<string, unknown> => !!period && typeof period === 'object')
    .map((period, index) => {
      const rawIndex = Number(period.index)
      const times = extractPeriodTimes(period)
      return {
        index: Number.isInteger(rawIndex) && rawIndex > 0 ? rawIndex : index + 1,
        startTime: times.startTime,
        endTime: times.endTime,
        label: typeof period.label === 'string' ? period.label.trim() : '',
        type: period.type,
      }
    })
    .filter((period) => period.startTime && period.endTime && period.startTime < period.endTime)
    .filter((period) => !isActivityPeriod(period))
    .sort((a, b) => a.index - b.index || a.startTime.localeCompare(b.startTime))

  const compact = parsed
    .filter((period, index) => {
      const prev = parsed[index - 1]
      const next = parsed[index + 1]
      if (!prev || !next || CLASS_PERIOD_LABEL.test(period.label)) return true
      const duration = durationMinutes(period.startTime, period.endTime)
      return !(duration > 0 && duration <= 40 && prev.endTime === period.startTime && period.endTime === next.startTime)
    })
    .slice(0, 12)
    .map((period, index) => ({
      index: (index + 1) as Period['index'],
      startTime: period.startTime,
      endTime: period.endTime,
      label: (period.label && !isActivityPeriod(period)
        ? period.label
        : `第${index + 1}节`).slice(0, 20),
    }))

  if (compact.length < 2 || compact.length < maxCourseSlot) return []
  if (compact.some((period, index) => index > 0 && compact[index - 1].endTime > period.startTime)) return []
  return compact
}

export function recognitionPeriodConfig(
  total: number,
  schedule: Schedule | null,
  periods?: Period[],
): BackendPeriodConfig {
  if (periods && periods.length === total) {
    const afternoonStart = periods.findIndex((period, index) => (
      index > 0 && periods[index - 1].endTime < '13:00' && period.startTime >= '13:00'
    ))
    if (afternoonStart >= 1) {
      const eveningStart = periods.findIndex((period, index) => (
        index >= afternoonStart && period.startTime >= '18:00'
      ))
      const morningCount = afternoonStart
      const afternoonCount = (eveningStart >= 0 ? eveningStart : total) - morningCount
      const eveningCount = total - morningCount - afternoonCount
      if (morningCount >= 1 && morningCount <= 6
        && afternoonCount >= 1 && afternoonCount <= 6
        && eveningCount >= 0 && eveningCount <= 4) {
        return {
          morning_count: morningCount,
          afternoon_count: afternoonCount,
          evening_count: eveningCount,
        }
      }
    }
  }

  const old = schedule?.period_config
  const morning = old?.morning_count ?? schedule?.periodConfig?.morningCount ?? 4
  const afternoon = old?.afternoon_count ?? schedule?.periodConfig?.afternoonCount ?? 4
  // Preserve existing group boundaries as closely as the server limits allow.
  const morningCount = Math.max(1, Math.min(6, morning, total - 1))
  const afternoonCount = Math.max(1, Math.min(6, total - morningCount,
    Math.max(afternoon, total - morningCount - 4)))
  return {
    morning_count: morningCount,
    afternoon_count: afternoonCount,
    evening_count: total - morningCount - afternoonCount,
  }
}
