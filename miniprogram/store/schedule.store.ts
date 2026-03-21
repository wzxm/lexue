import type { Schedule, Course, ScheduleGrid } from '../types/index';
import { PERIOD_COUNT, WEEKDAY_COUNT } from '../constants/periods';
import { saveSchedule, loadSchedule } from '../utils/storage';

type Listener = () => void;

class ScheduleStore {
  private _schedules: Schedule[] = [];
  private _currentSchedule: Schedule | null = null;
  private _weekOffset: number = 0; // 相对当前周的偏移
  private _listeners: Listener[] = [];

  get schedules(): Schedule[] {
    return this._schedules;
  }

  get currentSchedule(): Schedule | null {
    return this._currentSchedule;
  }

  get weekOffset(): number {
    return this._weekOffset;
  }

  /** 将当前课表课程转成二维网格 grid[period-1][weekday-1] */
  get grid(): ScheduleGrid {
    const grid: ScheduleGrid = Array.from({ length: PERIOD_COUNT }, () =>
      new Array(WEEKDAY_COUNT).fill(null)
    );
    if (!this._currentSchedule) return grid;

    for (const course of this._currentSchedule.courses) {
      const weekdayIdx = course.weekday - 1;
      const periodIdx = course.period - 1;
      if (periodIdx >= 0 && periodIdx < PERIOD_COUNT && weekdayIdx >= 0 && weekdayIdx < WEEKDAY_COUNT) {
        // 单双周过滤
        if (course.weekType === 'all') {
          grid[periodIdx][weekdayIdx] = course;
        } else {
          const isOddWeek = (Math.abs(this._weekOffset) % 2) === 0; // 偏移0=本周，假设本周是奇数周
          if ((course.weekType === 'odd' && isOddWeek) || (course.weekType === 'even' && !isOddWeek)) {
            grid[periodIdx][weekdayIdx] = course;
          }
        }
      }
    }
    return grid;
  }

  subscribe(listener: Listener): () => void {
    this._listeners.push(listener);
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener: Listener): void {
    this._listeners = this._listeners.filter(l => l !== listener);
  }

  private notify(): void {
    this._listeners.forEach(l => l());
  }

  setSchedules(schedules: Schedule[]): void {
    this._schedules = schedules;
    this.notify();
  }

  addSchedule(schedule: Schedule): void {
    this._schedules = [...this._schedules, schedule];
    this.notify();
  }

  setCurrentSchedule(schedule: Schedule): void {
    this._currentSchedule = schedule;
    saveSchedule(schedule.id, schedule);
    this.notify();
  }

  tryLoadFromCache(id: string): boolean {
    const cached = loadSchedule(id);
    if (cached) {
      this._currentSchedule = cached;
      this.notify();
      return true;
    }
    return false;
  }

  setWeekOffset(offset: number): void {
    this._weekOffset = offset;
    this.notify();
  }

  addCourse(course: Course): void {
    if (!this._currentSchedule) return;
    this._currentSchedule = {
      ...this._currentSchedule,
      courses: [...this._currentSchedule.courses, course],
    };
    saveSchedule(this._currentSchedule.id, this._currentSchedule);
    this.notify();
  }

  updateCourse(updated: Course): void {
    if (!this._currentSchedule) return;
    this._currentSchedule = {
      ...this._currentSchedule,
      courses: this._currentSchedule.courses.map(c => c.id === updated.id ? updated : c),
    };
    saveSchedule(this._currentSchedule.id, this._currentSchedule);
    this.notify();
  }

  removeCourse(courseId: string): void {
    if (!this._currentSchedule) return;
    this._currentSchedule = {
      ...this._currentSchedule,
      courses: this._currentSchedule.courses.filter(c => c.id !== courseId),
    };
    saveSchedule(this._currentSchedule.id, this._currentSchedule);
    this.notify();
  }
}

export const scheduleStore = new ScheduleStore();
