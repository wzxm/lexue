import { Course, Period } from '../../types/index';

// 将课程列表转换为二维网格 grid[periodIdx][weekdayIdx]
function buildGrid(courses: Course[], periodCount: number): (Course | null)[][] {
  const grid: (Course | null)[][] = [];
  for (let p = 0; p < periodCount; p++) {
    grid[p] = new Array(7).fill(null);
  }
  courses.forEach(course => {
    const pIdx = course.period - 1;
    const wIdx = course.weekday - 1;
    if (pIdx >= 0 && pIdx < periodCount && wIdx >= 0 && wIdx < 7) {
      grid[pIdx][wIdx] = course;
    }
  });
  return grid;
}

// 获取今天是星期几（1=周一...7=周日）
function getTodayWeekday(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

Component({
  properties: {
    courses: { type: Array, value: [] as Course[] },
    weekDates: { type: Array, value: [] as string[] },
    periods: { type: Array, value: [] as Period[] },
  },

  data: {
    grid: [] as (Course | null)[][],
    todayWeekday: 1,
    weekHeaders: [] as { label: string; date: string; isToday: boolean }[],
  },

  observers: {
    'courses, weekDates, periods'() {
      this._buildView();
    }
  },

  lifetimes: {
    attached() {
      this.setData({ todayWeekday: getTodayWeekday() });
      this._buildView();
    }
  },

  methods: {
    _buildView() {
      const { courses, weekDates, periods } = this.properties as {
        courses: Course[];
        weekDates: string[];
        periods: Period[];
      };
      const grid = buildGrid(courses, periods.length || 8);
      const today = new Date().toISOString().slice(0, 10);
      const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];
      const weekHeaders = (weekDates as string[]).map((d, i) => {
        const parts = d.split('-');
        return {
          label: `周${weekLabels[i]}`,
          date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
          isToday: d === today,
        };
      });
      // 为 wxml 渲染准备带 index 的数据
      const gridRows = (periods as Period[]).map((period, pIdx) => ({
        period,
        cells: grid[pIdx] ? grid[pIdx].map((course, wIdx) => ({
          course,
          weekday: wIdx + 1,
          periodIdx: pIdx + 1,
          isToday: (wIdx + 1) === getTodayWeekday(),
        })) : [],
      }));
      this.setData({ grid, weekHeaders, gridRows } as any);
    },

    onTapCell(e: any) {
      const { course, weekday, periodIdx, isToday } = e.currentTarget.dataset;
      if (course) {
        this.triggerEvent('tapCourse', course);
      } else {
        this.triggerEvent('tapEmpty', { weekday, period: periodIdx });
      }
    }
  }
});
