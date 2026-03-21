import { createCourse, updateCourse } from '../../api/course.api';
import { scheduleStore } from '../../store/schedule.store';
import { COURSE_COLORS } from '../../constants/colors';
import { DEFAULT_PERIODS } from '../../constants/periods';
import type { WeekDay, PeriodIndex, WeekType } from '../../types/index';

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEK_TYPE_OPTIONS = [
  { label: '每周', value: 'all' },
  { label: '单周', value: 'odd' },
  { label: '双周', value: 'even' },
];

Page({
  data: {
    mode: 'add' as 'add' | 'edit',
    scheduleId: '',
    courseId: '',
    // 表单字段
    name: '',
    weekday: 1 as WeekDay,
    period: 1 as PeriodIndex,
    teacher: '',
    classroom: '',
    color: 'red',
    weekType: 'all' as WeekType,
    note: '',
    // picker 数据源
    weekdayIndex: 0,
    periodIndex: 0,
    weekTypeIndex: 0,
    colors: COURSE_COLORS,
    weekdayLabels: WEEKDAY_LABELS,
    periodLabels: DEFAULT_PERIODS.map(p => `第${p.index}节 ${p.startTime}`),
    weekTypeOptions: WEEK_TYPE_OPTIONS,
    loading: false,
  },

  onLoad(options: Record<string, string>) {
    const { mode, weekday, period, scheduleId, courseId } = options;
    this.setData({ mode: (mode || 'add') as 'add' | 'edit', scheduleId, courseId });

    if (mode === 'edit' && courseId) {
      // 从 store 找到课程回填
      const schedule = scheduleStore.currentSchedule;
      const course = schedule?.courses.find(c => c.id === courseId);
      if (course) {
        this.setData({
          name: course.name,
          weekday: course.weekday,
          period: course.period,
          teacher: course.teacher || '',
          classroom: course.classroom || '',
          color: course.color,
          weekType: course.weekType,
          note: course.note || '',
          weekdayIndex: course.weekday - 1,
          periodIndex: course.period - 1,
          weekTypeIndex: WEEK_TYPE_OPTIONS.findIndex(o => o.value === course.weekType),
          scheduleId: course.scheduleId,
        });
      }
    } else {
      if (weekday) this.setData({ weekday: Number(weekday) as WeekDay, weekdayIndex: Number(weekday) - 1 });
      if (period) this.setData({ period: Number(period) as PeriodIndex, periodIndex: Number(period) - 1 });
    }

    wx.setNavigationBarTitle({ title: mode === 'edit' ? '修改课程' : '创建课表' });
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value });
  },

  onTeacherInput(e: WechatMiniprogram.Input) {
    this.setData({ teacher: e.detail.value });
  },

  onClassroomInput(e: WechatMiniprogram.Input) {
    this.setData({ classroom: e.detail.value });
  },

  onNoteInput(e: WechatMiniprogram.Input) {
    this.setData({ note: e.detail.value.slice(0, 50) });
  },

  onWeekdayChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({ weekdayIndex: idx, weekday: (idx + 1) as WeekDay });
  },

  onPeriodChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({ periodIndex: idx, period: (idx + 1) as PeriodIndex });
  },

  onWeekTypeChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({ weekTypeIndex: idx, weekType: WEEK_TYPE_OPTIONS[idx].value as WeekType });
  },

  onColorSelect(e: WechatMiniprogram.TouchEvent) {
    this.setData({ color: e.currentTarget.dataset.id as string });
  },

  async onSave() {
    const { name, weekday, period, teacher, classroom, color, weekType, note, scheduleId, mode, courseId } = this.data;

    if (!name.trim()) {
      wx.showToast({ title: '课程名称不能为空', icon: 'none' });
      return;
    }
    if (!scheduleId) {
      wx.showToast({ title: '课表数据异常，请返回重试', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      if (mode === 'edit' && courseId) {
        const updated = await updateCourse(courseId, { name, weekday, period, teacher, classroom, color, weekType, note });
        scheduleStore.updateCourse(updated);
      } else {
        const created = await createCourse({ scheduleId, name, weekday, period, teacher, classroom, color, weekType, note });
        scheduleStore.addCourse(created);
      }
      wx.navigateBack();
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
