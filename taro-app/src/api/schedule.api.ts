import { cloud } from './cloud';
import type { Schedule, Period, PeriodConfig } from '../types/index';

export async function listSchedules(studentId?: string): Promise<Schedule[]> {
  const payload: Record<string, unknown> = {};
  if (studentId) payload.studentId = studentId;
  const result = await cloud.call<{ own: Schedule[]; shared: Schedule[] }>('schedule', { action: 'list', payload });
  // 云函数返回 { own, shared }，拍平成数组供前端使用
  return [...(result.own || []), ...(result.shared || [])];
}

export async function createSchedule(data: {
  studentId?: string;
  name: string;
  semester: string;
  totalWeeks?: number;
  periods?: Period[];
  periodConfig?: PeriodConfig;
}): Promise<Schedule> {
  const payload: Record<string, unknown> = {
    name: data.name,
    semester: data.semester,
  };
  if (data.studentId) payload.student_id = data.studentId;
  if (data.totalWeeks) payload.total_weeks = data.totalWeeks;
  if (data.periods) payload.periods = data.periods;
  if (data.periodConfig) {
    payload.period_config = {
      morning_count: data.periodConfig.morningCount,
      afternoon_count: data.periodConfig.afternoonCount,
      evening_count: data.periodConfig.eveningCount,
    };
  }
  return cloud.call<Schedule>('schedule', {
    action: 'create',
    payload,
  });
}

export async function getSchedule(scheduleId: string): Promise<Schedule> {
  return cloud.call<Schedule>('schedule', { action: 'get', payload: { scheduleId } });
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
