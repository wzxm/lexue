import type { Course } from '../types/index'

export function buildAllWeeks(totalWeeks: number): number[] {
  return Array.from({ length: totalWeeks }, (_, i) => i + 1)
}

/** 课程是否在当前周上课（weeks 为空表示每周） */
export function courseAppliesToWeek(
  weeks: number[] | undefined,
  weekNum: number,
): boolean {
  if (!weeks || weeks.length === 0) return true
  return weeks.includes(weekNum)
}

export function formatWeeksSummary(weeks: number[], totalWeeks: number): string {
  if (weeks.length === 0 || weeks.length === totalWeeks) return '每周'
  const allOdd = buildAllWeeks(totalWeeks).filter(w => w % 2 === 1)
  const allEven = buildAllWeeks(totalWeeks).filter(w => w % 2 === 0)
  if (weeks.length === allOdd.length && allOdd.every(w => weeks.includes(w))) return '单周'
  if (weeks.length === allEven.length && allEven.every(w => weeks.includes(w))) return '双周'
  if (weeks.length <= 5) return `第${weeks.join('、')}周`
  return `${weeks.length}周`
}

/** 同天同节的所有课程（最多返回 2 条，当前周优先） */
export function findCoursesAtSlot(
  courses: Course[],
  weekday: number,
  slot: number,
  currentWeek?: number,
  max = 2,
): Course[] {
  const atSlot = courses.filter(c => c.day_of_week === weekday && c.slot === slot)
  if (atSlot.length <= max) {
    if (currentWeek === undefined) return atSlot
    return [...atSlot].sort((a, b) => {
      const aCurrent = courseAppliesToWeek(a.weeks, currentWeek) ? 0 : 1
      const bCurrent = courseAppliesToWeek(b.weeks, currentWeek) ? 0 : 1
      return aCurrent - bCurrent
    })
  }
  const sorted = currentWeek === undefined
    ? atSlot
    : [...atSlot].sort((a, b) => {
        const aCurrent = courseAppliesToWeek(a.weeks, currentWeek) ? 0 : 1
        const bCurrent = courseAppliesToWeek(b.weeks, currentWeek) ? 0 : 1
        return aCurrent - bCurrent
      })
  return sorted.slice(0, max)
}

/** 同天同节、但不在当前周上课的课程 */
export function findOffWeekCoursesAtSlot(
  courses: Course[],
  weekday: number,
  slot: number,
  currentWeek: number,
): Course[] {
  return courses.filter(c => {
    if (c.day_of_week !== weekday || c.slot !== slot) return false
    return !courseAppliesToWeek(c.weeks, currentWeek)
  })
}

/**
 * 当前周格子为空、但其他周次有课的 slot 集合。
 * key 格式：`${day_of_week}-${slot}`
 */
export function buildOffWeekSlotKeys(
  courses: Course[],
  currentWeek: number,
): Set<string> {
  const slotMap = new Map<string, Course[]>()
  for (const c of courses) {
    const key = `${c.day_of_week}-${c.slot}`
    const list = slotMap.get(key)
    if (list) list.push(c)
    else slotMap.set(key, [c])
  }

  const keys = new Set<string>()
  for (const [key, slotCourses] of slotMap) {
    const hasCurrentWeek = slotCourses.some(c => courseAppliesToWeek(c.weeks, currentWeek))
    const hasOtherWeek = slotCourses.some(c => !courseAppliesToWeek(c.weeks, currentWeek))
    if (!hasCurrentWeek && hasOtherWeek) {
      keys.add(key)
    }
  }
  return keys
}
