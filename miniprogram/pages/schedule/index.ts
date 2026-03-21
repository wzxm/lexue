import { scheduleStore } from '../../store/schedule.store';
import { studentStore } from '../../store/student.store';
import { listStudents } from '../../api/student.api';
import { listSchedules, getSchedule } from '../../api/schedule.api';
import { getWeekDates, formatShortDate } from '../../utils/date';
import { ROUTES } from '../../constants/routes';
import { DEFAULT_PERIODS } from '../../constants/periods';
import type { Course, Student, Schedule, ScheduleGrid } from '../../types/index';

interface PageData {
  student: Student | null;
  schedule: Schedule | null;
  grid: ScheduleGrid;
  periods: typeof DEFAULT_PERIODS;
  weekDates: string[];
  weekOffset: number;
  weekLabel: string;
  weekNum: number;
  // 课程详情 modal
  showCourseModal: boolean;
  selectedCourse: Course | null;
  // 视图模式
  viewMode: 'week' | 'day';
  // swiper 当前 index（3个：上周/本周/下周）
  swiperIndex: number;
}

Page<PageData, Record<string, never>>({
  data: {
    student: null,
    schedule: null,
    grid: [],
    periods: DEFAULT_PERIODS,
    weekDates: [],
    weekOffset: 0,
    weekLabel: '',
    weekNum: 1,
    showCourseModal: false,
    selectedCourse: null,
    viewMode: 'week',
    swiperIndex: 1,
  },

  _unsubscribeSchedule: (() => { }) as () => void,
  _unsubscribeStudent: (() => { }) as () => void,

  onLoad() {
    this._unsubscribeSchedule = scheduleStore.subscribe(() => this._syncFromStore());
    this._unsubscribeStudent = studentStore.subscribe(() => this._syncStudent());

    // 先检查登录态，未登录直接跳登录页，不调云函数
    const { authStore } = require('../../store/auth.store');
    if (!authStore.isLoggedIn) {
      wx.reLaunch({ url: ROUTES.LOGIN });
      return;
    }

    this._loadData();
  },

  onUnload() {
    this._unsubscribeSchedule();
    this._unsubscribeStudent();
  },

  onShow() {
    // 从课程表单返回时刷新
    this._syncFromStore();
  },

  async _loadData() {
    wx.showLoading({ title: '加载中', mask: true });
    try {
      const students = await listStudents();
      studentStore.setStudents(students);

      const currentStudent = studentStore.currentStudent;
      if (!currentStudent) {
        wx.hideLoading();
        wx.showModal({
          title: '还没有学生',
          content: '先添加一个学生吧',
          confirmText: '去添加',
          showCancel: false,
          success: () => wx.navigateTo({ url: ROUTES.STUDENT_FORM }),
        });
        return;
      }

      const schedules = await listSchedules(currentStudent.id);
      scheduleStore.setSchedules(schedules);

      const defaultSchedule = schedules.find(s => s.isDefault) || schedules[0];
      if (defaultSchedule) {
        const full = await getSchedule(defaultSchedule.id);
        scheduleStore.setCurrentSchedule(full);
      }
      this._syncFromStore();
    } catch (err) {
      console.error('[schedule] _loadData error:', err);
      wx.showToast({ title: (err as Error).message || '加载失败', icon: 'none', duration: 3000 });
    } finally {
      wx.hideLoading();
    }
  },

  _syncStudent() {
    this.setData({ student: studentStore.currentStudent });
  },

  _syncFromStore() {
    const offset = scheduleStore.weekOffset;
    const dates = getWeekDates(offset);
    const weekLabel = this._buildWeekLabel(offset, dates);

    this.setData({
      student: studentStore.currentStudent,
      schedule: scheduleStore.currentSchedule,
      grid: scheduleStore.grid,
      periods: scheduleStore.currentSchedule?.periods || DEFAULT_PERIODS,
      weekDates: dates,
      weekOffset: offset,
      weekLabel,
      weekNum: Math.abs(offset) + 1,
    });
  },

  _buildWeekLabel(offset: number, dates: string[]): string {
    const weekNum = Math.abs(offset) + 1;
    const start = formatShortDate(dates[0]);
    const end = formatShortDate(dates[6]);
    return `第${weekNum}周 ${start}-${end}`;
  },

  onSwiperChange(e: WechatMiniprogram.SwiperChange) {
    const idx = e.detail.current;
    // 0=上周, 1=本周, 2=下周
    const delta = idx - 1;
    const newOffset = scheduleStore.weekOffset + delta;
    // 重置 swiper 到中间
    scheduleStore.setWeekOffset(newOffset);
    this.setData({ swiperIndex: 1 });
  },

  onPrevWeek() {
    scheduleStore.setWeekOffset(scheduleStore.weekOffset - 1);
  },

  onNextWeek() {
    scheduleStore.setWeekOffset(scheduleStore.weekOffset + 1);
  },

  onBackToday() {
    scheduleStore.setWeekOffset(0);
  },

  onTapEmpty(e: WechatMiniprogram.TouchEvent) {
    const { weekday, period } = e.currentTarget.dataset as { weekday: number; period: number };
    if (!scheduleStore.currentSchedule) {
      wx.showToast({ title: '请先创建课表', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `${ROUTES.COURSE_FORM}?mode=add&weekday=${weekday}&period=${period}&scheduleId=${scheduleStore.currentSchedule.id}`,
    });
  },

  onTapCourse(e: WechatMiniprogram.TouchEvent) {
    const course = e.currentTarget.dataset.course as Course;
    this.setData({ showCourseModal: true, selectedCourse: course });
  },

  onCloseModal() {
    this.setData({ showCourseModal: false, selectedCourse: null });
  },

  onEditCourse() {
    const course = this.data.selectedCourse;
    if (!course) return;
    this.setData({ showCourseModal: false });
    wx.navigateTo({ url: `${ROUTES.COURSE_FORM}?mode=edit&courseId=${course.id}` });
  },

  async onDeleteCourse() {
    const course = this.data.selectedCourse;
    if (!course) return;

    const { confirm } = await new Promise<WechatMiniprogram.ShowModalSuccessCallbackResult>(resolve =>
      wx.showModal({ title: '删除课程', content: `确认删除「${course.name}」？`, success: resolve })
    );
    if (!confirm) return;

    try {
      const { deleteCourse } = await import('../../api/course.api');
      await deleteCourse(course.id);
      scheduleStore.removeCourse(course.id);
      this.setData({ showCourseModal: false, selectedCourse: null });
      wx.showToast({ title: '已删除' });
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: 'none' });
    }
  },

  onAddCourse() {
    if (!scheduleStore.currentSchedule) {
      // 空状态：跳去创建课表，别傻乎乎地 toast "请先创建课表"
      wx.navigateTo({ url: ROUTES.SCHEDULE_FORM });
      return;
    }
    wx.navigateTo({ url: `${ROUTES.COURSE_FORM}?mode=add&scheduleId=${scheduleStore.currentSchedule.id}` });
  },

  onSwitchStudent() {
    // TODO: 弹出学生选择
  },

  isToday(dateStr: string): boolean {
    if (!dateStr) return false;
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today;
  },

  onViewModeChange(e: WechatMiniprogram.TouchEvent) {
    const { mode } = e.currentTarget.dataset as { mode: 'week' | 'day' };
    this.setData({ viewMode: mode });
  },
});
