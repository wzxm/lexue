import type { Schedule, Student } from '../types'

export interface GroupedSchedules {
  studentName: string
  school: string
  grade: string
  items: Schedule[]
}

/** 按学生聚合课表列表，用于「切换课表」抽屉展示 */
export function groupSchedulesByStudent (
  schedules: Schedule[],
  students: Student[]
): GroupedSchedules[] {
  const map = new Map<string, GroupedSchedules>()
  for (const s of schedules) {
    const key = s.studentId || s.student_id || 'default'
    if (!map.has(key)) {
      const st = students.find(x => x.id === key)
      map.set(key, {
        studentName: st?.name || '未命名学生',
        school: st?.school || '',
        grade: st?.grade || '',
        items: []
      })
    }
    map.get(key)!.items.push(s)
  }
  return Array.from(map.values())
}
