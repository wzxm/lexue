import { create } from 'zustand'
import type { Student } from '../types/index'
import { saveStudents, loadStudents, saveCurrentStudentId, loadCurrentStudentId } from '../utils/storage'

interface StudentState {
  students: Student[]
  currentStudent: Student | null

  setStudents: (students: Student[]) => void
  setCurrentStudent: (student: Student) => void
  addStudent: (student: Student) => void
  updateStudent: (updated: Student) => void
  removeStudent: (id: string) => void
}

export const useStudentStore = create<StudentState>((set, get) => {
  // 初始化时从缓存恢复
  const cached = loadStudents()
  const currentId = loadCurrentStudentId()
  const currentStudent = currentId ? cached.find(s => s.id === currentId) || null : null

  return {
    students: cached,
    currentStudent,

    setStudents: (students) => {
      saveStudents(students)
      const { currentStudent } = get()
      let newCurrent = currentStudent
      if (!newCurrent && students.length > 0) {
        newCurrent = students[0]
        saveCurrentStudentId(students[0].id)
      }
      set({ students, currentStudent: newCurrent })
    },

    setCurrentStudent: (student) => {
      saveCurrentStudentId(student.id)
      set({ currentStudent: student })
    },

    addStudent: (student) => {
      const { students, currentStudent } = get()
      const newStudents = [...students, student]
      saveStudents(newStudents)
      if (!currentStudent) {
        saveCurrentStudentId(student.id)
        set({ students: newStudents, currentStudent: student })
      } else {
        set({ students: newStudents })
      }
    },

    updateStudent: (updated) => {
      const { students, currentStudent } = get()
      const newStudents = students.map(s => s.id === updated.id ? updated : s)
      saveStudents(newStudents)
      set({
        students: newStudents,
        currentStudent: currentStudent?.id === updated.id ? updated : currentStudent,
      })
    },

    removeStudent: (id) => {
      const { students, currentStudent } = get()
      const newStudents = students.filter(s => s.id !== id)
      saveStudents(newStudents)
      let newCurrent = currentStudent
      if (currentStudent?.id === id) {
        newCurrent = newStudents[0] || null
        if (newCurrent) saveCurrentStudentId(newCurrent.id)
      }
      set({ students: newStudents, currentStudent: newCurrent })
    },
  }
})
