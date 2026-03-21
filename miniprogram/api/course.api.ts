import { cloud } from './cloud';
import type { Course } from '../types/index';

export interface BatchCreateResult {
  created: number;
  ids: string[];
}

export async function listCourses(scheduleId: string): Promise<Course[]> {
  return cloud.call<Course[]>('course', { action: 'list', payload: { scheduleId } });
}

export async function createCourse(data: Omit<Course, 'id'>): Promise<Course> {
  return cloud.call<Course>('course', { action: 'create', payload: data });
}

export async function updateCourse(courseId: string, data: Partial<Course>): Promise<void> {
  return cloud.call<void>('course', { action: 'update', payload: { courseId, ...data } });
}

export async function deleteCourse(courseId: string): Promise<void> {
  return cloud.call<void>('course', { action: 'delete', payload: { courseId } });
}

export async function batchCreateCourses(scheduleId: string, courses: Omit<Course, 'id'>[]): Promise<BatchCreateResult> {
  return cloud.call<BatchCreateResult>('course', { action: 'batchCreate', payload: { scheduleId, courses } });
}
