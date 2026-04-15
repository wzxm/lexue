import type { Course } from '../types/index'

/** 云库课程文档可能仅有 _id；与 course 云函数 list 的 id 映射对齐 */
export function resolveCourseId(course: Course & { _id?: string }): string {
  const raw = course.id ?? course._id
  return raw != null ? String(raw) : ''
}
