import { cloud } from './cloud';
import type { Student } from '../types/index';

type BackendStudent = {
  _id?: string;
  name: string;
  avatar_url?: string;
  school_name?: string;
  grade?: string;
  gender?: number;
};

function toFrontendStudent(data: BackendStudent): Student {
  return {
    id: data._id || '',
    name: data.name || '',
    avatar: data.avatar_url || '',
    school: data.school_name || '',
    grade: data.grade || '',
    gender: data.gender || 0,
  };
}

function toBackendPayload(data: Partial<Omit<Student, 'id'>>) {
  return {
    name: data.name,
    gender: data.gender,
    avatar_url: data.avatar,
    school_name: data.school,
    grade: data.grade,
  };
}

export async function listStudents(): Promise<Student[]> {
  const list = await cloud.call<BackendStudent[]>('student', { action: 'list', payload: {} });
  return (list || []).map(toFrontendStudent);
}

export async function createStudent(data: Omit<Student, 'id'>): Promise<Student> {
  const created = await cloud.call<BackendStudent>('student', {
    action: 'create',
    payload: toBackendPayload(data),
  });
  return toFrontendStudent(created);
}

export async function getStudent(studentId: string): Promise<Student> {
  const student = await cloud.call<BackendStudent>('student', { action: 'get', payload: { studentId } });
  return toFrontendStudent(student);
}

export async function updateStudent(studentId: string, data: Partial<Student>): Promise<void> {
  return cloud.call<void>('student', {
    action: 'update',
    payload: { studentId, ...toBackendPayload(data) },
  });
}

export async function deleteStudent(studentId: string): Promise<void> {
  return cloud.call<void>('student', { action: 'delete', payload: { studentId } });
}
