import { cloud } from './cloud';
import type { Course } from '../types/index';
import type { GradeLevel } from '../constants/course-presets';

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

export interface CourseNamePreset {
  id: string
  name: string
  gradeLevel: GradeLevel
}

export async function listCoursePresets(): Promise<CourseNamePreset[]> {
  const res = await cloud.call<{ presets: Array<{ id: string; name: string; grade_level: string }> }>('course', { action: 'listPresets', payload: {} })
  return (res.presets ?? []).map(p => ({ id: p.id, name: p.name, gradeLevel: p.grade_level as GradeLevel }))
}

export async function addCoursePreset(name: string, gradeLevel: GradeLevel): Promise<CourseNamePreset> {
  const res = await cloud.call<{ id: string; name: string; grade_level: string }>('course', { action: 'addPreset', payload: { name, grade_level: gradeLevel } })
  return { id: res.id, name: res.name, gradeLevel: res.grade_level as GradeLevel }
}

export async function deleteCoursePreset(presetId: string): Promise<void> {
  await cloud.call<void>('course', { action: 'deletePreset', payload: { presetId } })
}
