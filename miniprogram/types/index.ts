// 乐学课表 - 全局类型定义
// 约定：WeekDay 1=周一...7=周日（与后端保持一致）

export type WeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;
// 节次支持最多 12 节（覆盖高中场景）
export type PeriodIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type WeekType = 'all' | 'odd' | 'even';
// 与后端保持一致：owner 单独判断，共享权限为 'edit' | 'view'
export type FamilyRole = 'owner' | 'edit' | 'view';

export interface Period {
  index: PeriodIndex;
  startTime: string;
  endTime: string;
  label: string;
}

export interface Course {
  id: string;
  scheduleId: string;
  name: string;
  weekday: WeekDay;
  period: PeriodIndex;
  teacher?: string;
  classroom?: string;
  color: string;
  weekType: WeekType;
  note?: string;
}

export interface Schedule {
  id: string;
  studentId: string;
  name: string;
  semester: string;
  periods: Period[];
  courses: Course[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Student {
  id: string;
  name: string;
  avatar?: string;
  school: string;
  grade: string;
  classNum: string;
  enrollYear?: number;
  studentNo?: string;
  note?: string;
}

export interface FamilyMember {
  id: string;
  openId: string;
  nickname: string;
  avatar: string;
  role: FamilyRole;
  joinedAt: number;
}

export interface UserInfo {
  openId: string;
  nickname: string;
  avatarUrl: string;
  settings?: BackendSettings;
}

// 后端 users.settings 字段（snake_case，与云函数保持一致）
export interface BackendSettings {
  notify_enabled: boolean;
  notify_advance_minutes: number;
  notify_time_slots: number[]; // 哪些节次需要提醒，空数组=全部
}

// 前端展示用的设置（从 BackendSettings 转换而来）
export interface UserSettings {
  notifyEnabled: boolean;
  notifyAdvanceMinutes: number;
  notifyTimeSlots: number[];
}

// 前后端 Settings 字段转换工具
export function toBackendSettings(s: UserSettings): BackendSettings {
  return {
    notify_enabled: s.notifyEnabled,
    notify_advance_minutes: s.notifyAdvanceMinutes,
    notify_time_slots: s.notifyTimeSlots,
  };
}

export function toFrontendSettings(s: BackendSettings): UserSettings {
  return {
    notifyEnabled: s.notify_enabled ?? true,
    notifyAdvanceMinutes: s.notify_advance_minutes ?? 30,
    notifyTimeSlots: s.notify_time_slots ?? [],
  };
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// grid[period-1][weekday-1] = Course | null
export type ScheduleGrid = (Course | null)[][];
