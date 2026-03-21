import type { Student } from '../types/index';
import { saveStudents, loadStudents, saveCurrentStudentId, loadCurrentStudentId } from '../utils/storage';

type Listener = () => void;

class StudentStore {
  private _students: Student[] = [];
  private _currentStudent: Student | null = null;
  private _listeners: Listener[] = [];

  constructor() {
    this._students = loadStudents();
    const currentId = loadCurrentStudentId();
    if (currentId) {
      this._currentStudent = this._students.find(s => s.id === currentId) || null;
    }
  }

  get students(): Student[] {
    return this._students;
  }

  get currentStudent(): Student | null {
    return this._currentStudent;
  }

  subscribe(listener: Listener): () => void {
    this._listeners.push(listener);
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener: Listener): void {
    this._listeners = this._listeners.filter(l => l !== listener);
  }

  private notify(): void {
    this._listeners.forEach(l => l());
  }

  setStudents(students: Student[]): void {
    this._students = students;
    saveStudents(students);
    if (!this._currentStudent && students.length > 0) {
      this._currentStudent = students[0];
      saveCurrentStudentId(students[0].id);
    }
    this.notify();
  }

  setCurrentStudent(student: Student): void {
    this._currentStudent = student;
    saveCurrentStudentId(student.id);
    this.notify();
  }

  addStudent(student: Student): void {
    this._students = [...this._students, student];
    saveStudents(this._students);
    if (!this._currentStudent) {
      this._currentStudent = student;
      saveCurrentStudentId(student.id);
    }
    this.notify();
  }

  updateStudent(updated: Student): void {
    this._students = this._students.map(s => s.id === updated.id ? updated : s);
    saveStudents(this._students);
    if (this._currentStudent?.id === updated.id) {
      this._currentStudent = updated;
    }
    this.notify();
  }

  removeStudent(id: string): void {
    this._students = this._students.filter(s => s.id !== id);
    saveStudents(this._students);
    if (this._currentStudent?.id === id) {
      this._currentStudent = this._students[0] || null;
      if (this._currentStudent) saveCurrentStudentId(this._currentStudent.id);
    }
    this.notify();
  }
}

export const studentStore = new StudentStore();
