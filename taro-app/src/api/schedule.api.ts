import { cloud } from './cloud';
import type { Schedule, Period } from '../types/index';

export async function listSchedules(studentId?: string): Promise<Schedule[]> {
  const payload: Record<string, unknown> = {};
  if (studentId) payload.studentId = studentId;
  return cloud.call<Schedule[]>('schedule', { action: 'list', payload });
}

export async function createSchedule(data: {
  studentId: string;
  name: string;
  semester: string;
  periods?: Period[];
}): Promise<Schedule> {
  return cloud.call<Schedule>('schedule', {
    action: 'create',
    payload: {
      student_id: data.studentId,
      name: data.name,
      semester: data.semester,
    },
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
