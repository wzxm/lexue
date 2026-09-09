import type { BackendPeriodConfig, Period, Schedule } from '../types/index'

export function normalizeRecognitionPeriods(raw: unknown, maxCourseSlot = 0): Period[] {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 12) return []
  const periods = raw.filter(p => p && Number.isInteger(p.index) &&
    typeof p.startTime === 'string' && typeof p.endTime === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(p.startTime) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(p.endTime) && p.startTime < p.endTime
  ).map(p => ({
    index: p.index,
    startTime: p.startTime,
    endTime: p.endTime,
    label: typeof p.label === 'string' && p.label.trim() ? p.label.trim() : `第${p.index}节`,
  })).sort((a, b) => a.index - b.index)
  // Never turn a partial recognition into a shorter timetable.
  if (periods.length !== raw.length || periods.length < maxCourseSlot ||
    periods.some((p, i) => p.index !== i + 1 || (i > 0 && periods[i - 1].endTime > p.startTime))) return []
  return periods
}

export function recognitionPeriodConfig(total: number, schedule: Schedule | null): BackendPeriodConfig {
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
