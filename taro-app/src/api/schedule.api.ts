import { cloud } from './cloud';
import type { Schedule, Period, PeriodConfig } from '../types/index';

type BackendSchedule = Schedule & {
  createTime?: string | number | Date;
  updateTime?: string | number | Date;
}

function normalizeTimestamp(value?: string | number | Date): number {
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function toFrontendSchedule(data: BackendSchedule): Schedule {
  return {
    ...data,
    createdAt: data.createdAt || normalizeTimestamp(data.createTime),
    updatedAt: data.updatedAt || normalizeTimestamp(data.updateTime),
  }
}

export async function listSchedules(studentId?: string): Promise<Schedule[]> {
  const payload: Record<string, unknown> = {};
  if (studentId) payload.studentId = studentId;
  const result = await cloud.call<{ own: BackendSchedule[]; shared: BackendSchedule[] }>('schedule', { action: 'list', payload });
  // 云函数返回 { own, shared }，拍平成数组供前端使用
  return [...(result.own || []), ...(result.shared || [])].map(toFrontendSchedule);
}

export async function createSchedule(data: {
  studentId?: string;
  name: string;
  semester: string;
  totalWeeks?: number;
  startDate?: string;
  periods?: Period[];
  periodConfig?: PeriodConfig;
}): Promise<Schedule> {
  const payload: Record<string, unknown> = {
    name: data.name,
    semester: data.semester,
  };
  if (data.studentId) payload.student_id = data.studentId;
  if (data.totalWeeks) payload.total_weeks = data.totalWeeks;
  if (data.startDate) payload.start_date = data.startDate;
  if (data.periods) payload.periods = data.periods;
  if (data.periodConfig) {
    payload.period_config = {
      morning_count: data.periodConfig.morningCount,
      afternoon_count: data.periodConfig.afternoonCount,
      evening_count: data.periodConfig.eveningCount,
    };
  }
  const schedule = await cloud.call<BackendSchedule>('schedule', {
    action: 'create',
    payload,
  });
  return toFrontendSchedule(schedule);
}

export async function getSchedule(scheduleId: string): Promise<Schedule> {
  const schedule = await cloud.call<BackendSchedule>('schedule', { action: 'get', payload: { scheduleId } });
  return toFrontendSchedule(schedule);
}

export async function updateSchedule(scheduleId: string, data: Partial<Schedule>): Promise<void> {
  return cloud.call<void>('schedule', { action: 'update', payload: { scheduleId, ...data } });
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  return cloud.call<void>('schedule', { action: 'delete', payload: { scheduleId } });
}

export async function setDefaultSchedule(scheduleId: string): Promise<void> {
  return cloud.call<void>('schedule', { action: 'setDefault', payload: { scheduleId } });
}

export async function refreshInviteCode(scheduleId: string): Promise<{ invite_code: string }> {
  return cloud.call<{ invite_code: string }>('schedule', { action: 'refreshInviteCode', payload: { scheduleId } });
}
