import { cloud } from './cloud';
import type { Student } from '../types/index';

export async function listStudents(): Promise<Student[]> {
  return cloud.call<Student[]>('student', { action: 'list', payload: {} });
}

export async function createStudent(data: Omit<Student, 'id'>): Promise<Student> {
  return cloud.call<Student>('student', { action: 'create', payload: data });
}

export async function getStudent(studentId: string): Promise<Student> {
  return cloud.call<Student>('student', { action: 'get', payload: { studentId } });
}

export async function updateStudent(studentId: string, data: Partial<Student>): Promise<void> {
  return cloud.call<void>('student', { action: 'update', payload: { studentId, ...data } });
}

export async function deleteStudent(studentId: string): Promise<void> {
  return cloud.call<void>('student', { action: 'delete', payload: { studentId } });
}
