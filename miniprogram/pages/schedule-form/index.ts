import { createSchedule } from '../../api/schedule.api';
import { studentStore } from '../../store/student.store';
import { scheduleStore } from '../../store/schedule.store';
import { ROUTES } from '../../constants/routes';
import type { Student, Schedule, Period, PeriodIndex } from '../../types/index';

// ——— 学期选项 ———
const SEMESTER_OPTIONS = [
  { label: '2024~2025 上学期', value: '2024-2025-1' },
  { label: '2024~2025 下学期', value: '2024-2025-2' },
  { label: '2025~2026 上学期', value: '2025-2026-1' },
  { label: '2025~2026 下学期', value: '2025-2026-2' },
  { label: '2026~2027 上学期', value: '2026-2027-1' },
  { label: '2026~2027 下学期', value: '2026-2027-2' },
];

// ——— 各时段基础时间配置（设计图里的默认值）———
const MORNING_SLOTS = [
  { startTime: '08:10', endTime: '08:55' },
  { startTime: '09:05', endTime: '09:50' },
  { startTime: '10:10', endTime: '10:55' },
  { startTime: '11:05', endTime: '11:50' },
  { startTime: '12:00', endTime: '12:45' },
  { startTime: '13:00', endTime: '13:45' },
];
const AFTERNOON_SLOTS = [
  { startTime: '14:30', endTime: '15:15' },
  { startTime: '15:25', endTime: '16:10' },
  { startTime: '16:20', endTime: '17:05' },
  { startTime: '17:15', endTime: '18:00' },
  { startTime: '18:10', endTime: '18:55' },
  { startTime: '19:00', endTime: '19:45' },
];
const EVENING_SLOTS = [
  { startTime: '19:00', endTime: '19:45' },
  { startTime: '19:55', endTime: '20:40' },
  { startTime: '20:50', endTime: '21:35' },
  { startTime: '21:45', endTime: '22:30' },
];

const MAX_MORNING = MORNING_SLOTS.length;
const MAX_AFTERNOON = AFTERNOON_SLOTS.length;
const MAX_EVENING = EVENING_SLOTS.length;
const MIN_PERIOD = 1;

interface PageData {
  semesterOptions: typeof SEMESTER_OPTIONS;
  semesterLabels: string[];
  semesterIndex: number;
  totalWeeks: number;
  students: Student[];
  studentLabels: string[];
  studentIndex: number;
  morningCount: number;
  afternoonCount: number;
  eveningCount: number;
  morningPeriods: Array<{ index: number; startTime: string; endTime: string; label: string }>;
  afternoonPeriods: Array<{ index: number; startTime: string; endTime: string; label: string }>;
  eveningPeriods: Array<{ index: number; startTime: string; endTime: string; label: string }>;
  loading: boolean;
  step: 1 | 2;
  currentScheduleId: string | null;
}

Page<PageData, Record<string, never>>({
  data: {
    semesterOptions: SEMESTER_OPTIONS,
    semesterLabels: SEMESTER_OPTIONS.map(o => o.label),
    semesterIndex: 3, // 默认 2025~2026 下学期
    totalWeeks: 20,
    students: [],
    studentLabels: [],
    studentIndex: 0,
    morningCount: 4,
    afternoonCount: 4,
    eveningCount: 3,
    morningPeriods: [],
    afternoonPeriods: [],
    eveningPeriods: [],
    loading: false,
    step: 1,
    currentScheduleId: null,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '新建课表' });
    const students = studentStore.students;
    const currentStudent = studentStore.currentStudent;
    const studentIndex = currentStudent ? students.findIndex(s => s.id === currentStudent.id) : 0;

    this.setData({
      students,
      studentLabels: students.map(s => s.name),
      studentIndex: Math.max(0, studentIndex),
    });
    this._updatePeriods();
  },

  // ——— 学期 picker ———
  onSemesterChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ semesterIndex: Number(e.detail.value) });
  },

  // ——— 学期周数 stepper ———
  onTotalWeeksMinus() {
    const v = this.data.totalWeeks;
    if (v <= 1) return;
    this.setData({ totalWeeks: v - 1 });
  },
  onTotalWeeksPlus() {
    const v = this.data.totalWeeks;
    if (v >= 52) return;
    this.setData({ totalWeeks: v + 1 });
  },

  // ——— 归属学生 picker ———
  onStudentChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ studentIndex: Number(e.detail.value) });
  },

  // ——— 节数 stepper ———
  onMorningMinus() {
    const v = this.data.morningCount;
    if (v <= MIN_PERIOD) return;
    this.setData({ morningCount: v - 1 }, () => this._updatePeriods());
  },
  onMorningPlus() {
    const v = this.data.morningCount;
    if (v >= MAX_MORNING) return;
    this.setData({ morningCount: v + 1 }, () => this._updatePeriods());
  },
  onAfternoonMinus() {
    const v = this.data.afternoonCount;
    if (v <= MIN_PERIOD) return;
    this.setData({ afternoonCount: v - 1 }, () => this._updatePeriods());
  },
  onAfternoonPlus() {
    const v = this.data.afternoonCount;
    if (v >= MAX_AFTERNOON) return;
    this.setData({ afternoonCount: v + 1 }, () => this._updatePeriods());
  },
  onEveningMinus() {
    const v = this.data.eveningCount;
    if (v <= 0) return;
    this.setData({ eveningCount: v - 1 }, () => this._updatePeriods());
  },
  onEveningPlus() {
    const v = this.data.eveningCount;
    if (v >= MAX_EVENING) return;
    this.setData({ eveningCount: v + 1 }, () => this._updatePeriods());
  },

  /** 根据各段节数计算 period 显示列表 */
  _updatePeriods() {
    const { morningCount, afternoonCount, eveningCount } = this.data;
    let idx = 1;
    const morningPeriods = MORNING_SLOTS.slice(0, morningCount).map(s => ({
      index: idx++, startTime: s.startTime, endTime: s.endTime, label: `第${idx - 1}节`,
    }));
    const afternoonPeriods = AFTERNOON_SLOTS.slice(0, afternoonCount).map(s => ({
      index: idx++, startTime: s.startTime, endTime: s.endTime, label: `第${idx - 1}节`,
    }));
    const eveningPeriods = EVENING_SLOTS.slice(0, eveningCount).map(s => ({
      index: idx++, startTime: s.startTime, endTime: s.endTime, label: `第${idx - 1}节`,
    }));
    this.setData({ morningPeriods, afternoonPeriods, eveningPeriods });
  },

  /** 把界面配置的时间段合并成 Period[] */
  _buildPeriods(): Period[] {
    const { morningPeriods, afternoonPeriods, eveningPeriods } = this.data;
    return [...morningPeriods, ...afternoonPeriods, ...eveningPeriods].map(p => ({
      index: p.index as PeriodIndex,
      startTime: p.startTime,
      endTime: p.endTime,
      label: p.label,
    }));
  },

  async onSave() {
    const { semesterIndex, semesterOptions, studentIndex, students } = this.data;

    // ——— 本地校验 ———
    if (students.length === 0) {
      wx.showToast({ title: '请先添加学生', icon: 'none' });
      return;
    }
    const student = students[studentIndex];
    if (!student) {
      wx.showToast({ title: '请选择归属学生', icon: 'none' });
      return;
    }
    const semester = semesterOptions[semesterIndex];
    if (!semester) {
      wx.showToast({ title: '请选择学年', icon: 'none' });
      return;
    }

    const name = `${semester.label}课表`;

    this.setData({ loading: true });
    wx.showLoading({ title: '创建中', mask: true });
    try {
      const raw = await createSchedule({
        studentId: student.id,
        name,
        semester: semester.value,
      });

      // 云函数返回 snake_case 字段，手动映射到 Schedule 类型
      // TODO: 理想情况应在 api 层统一做映射，这里是临时 workaround
      const r = raw as unknown as Record<string, unknown>;
      const schedule: Schedule = {
        id: (r._id || r.id || '') as string,
        studentId: (r.student_id || student.id) as string,
        name: (r.name || name) as string,
        semester: (r.semester || semester.value) as string,
        periods: this._buildPeriods(),
        courses: [],
        isDefault: (r.is_default ?? false) as boolean,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      scheduleStore.addSchedule(schedule);
      scheduleStore.setCurrentSchedule(schedule);

      wx.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => {
        this.setData({ step: 2, currentScheduleId: schedule.id });
      }, 500);
    } catch (err) {
      wx.showToast({ title: (err as Error).message || '创建失败', icon: 'none', duration: 3000 });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  onTapOcr() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
  onTapExcel() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
  onTapCopy() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },
  onTapManual() {
    const sid = this.data.currentScheduleId;
    if (!sid) return;
    wx.redirectTo({ url: `${ROUTES.COURSE_FORM}?mode=add&scheduleId=${sid}` });
  },
  onAddLater() {
    wx.navigateBack();
  },
});
