import { create } from 'zustand'
import type { Schedule, Course, ScheduleGrid } from '../types/index'
import { PERIOD_COUNT, WEEKDAY_COUNT } from '../constants/periods'
import { saveSchedule, loadSchedule } from '../utils/storage'

interface ScheduleState {
  schedules: Schedule[]
  currentSchedule: Schedule | null
  weekOffset: number

  setSchedules: (schedules: Schedule[]) => void
  addSchedule: (schedule: Schedule) => void
  setCurrentSchedule: (schedule: Schedule | null) => void
  tryLoadFromCache: (id: string) => boolean
  setWeekOffset: (offset: number) => void
  addCourse: (course: Course) => void
  updateCourse: (updated: Course) => void
  removeCourse: (courseId: string) => void
}

/** 计算课表二维网格 grid[period-1][weekday-1] */
export function buildGrid(schedule: Schedule | null, weekOffset: number): ScheduleGrid {
  const grid: ScheduleGrid = Array.from({ length: PERIOD_COUNT }, () =>
    new Array(WEEKDAY_COUNT).fill(null)
  )
  if (!schedule) return grid

  const courses = Array.isArray(schedule.courses) ? schedule.courses : []
  const currentWeek = Math.abs(weekOffset) + 1
  for (const course of courses) {
    const weekdayIdx = course.day_of_week - 1
    const periodIdx = course.slot - 1
    if (periodIdx >= 0 && periodIdx < PERIOD_COUNT && weekdayIdx >= 0 && weekdayIdx < WEEKDAY_COUNT) {
      if (!course.weeks || course.weeks.length === 0) {
        grid[periodIdx][weekdayIdx] = course
      } else if (course.weeks.includes(currentWeek)) {
        grid[periodIdx][weekdayIdx] = course
      }
    }
  }
  return grid
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  currentSchedule: null,
  weekOffset: 0,

  setSchedules: (schedules) => set({ schedules }),

  addSchedule: (schedule) => set((s) => ({ schedules: [...s.schedules, schedule] })),

  setCurrentSchedule: (schedule) => {
    if (schedule) {
      saveSchedule(schedule.id, schedule)
    }
    set({ currentSchedule: schedule })
  },

  tryLoadFromCache: (id) => {
    const cached = loadSchedule(id)
    if (cached) {
      set({ currentSchedule: cached })
      return true
    }
    return false
  },

  setWeekOffset: (offset) => set({ weekOffset: offset }),

  addCourse: (course) => {
    const { currentSchedule } = get()
    if (!currentSchedule) return
    const updated = {
      ...currentSchedule,
      courses: [...currentSchedule.courses, course],
    }
    saveSchedule(updated.id, updated)
    set({ currentSchedule: updated })
  },

  updateCourse: (updated) => {
    const { currentSchedule } = get()
    if (!currentSchedule) return
    const newSchedule = {
      ...currentSchedule,
      courses: currentSchedule.courses.map(c => c.id === updated.id ? updated : c),
    }
    saveSchedule(newSchedule.id, newSchedule)
    set({ currentSchedule: newSchedule })
  },

  removeCourse: (courseId) => {
    const { currentSchedule } = get()
    if (!currentSchedule) return
    const newSchedule = {
      ...currentSchedule,
      courses: currentSchedule.courses.filter(c => c.id !== courseId),
    }
    saveSchedule(newSchedule.id, newSchedule)
    set({ currentSchedule: newSchedule })
  },
}))
