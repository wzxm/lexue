import { createStudent, updateStudent } from '../../api/student.api';
import { studentStore } from '../../store/student.store';
import type { Student } from '../../types/index';

const GRADE_OPTIONS = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三',
  '高一', '高二', '高三',
];

Page({
  data: {
    mode: 'add' as 'add' | 'edit',
    studentId: '',
    name: '',
    school: '',
    grade: '一年级',
    classNum: '',
    enrollYear: '',
    studentNo: '',
    note: '',
    gradeIndex: 0,
    gradeOptions: GRADE_OPTIONS,
    loading: false,
  },

  onLoad(options: Record<string, string>) {
    const { mode, studentId } = options;
    this.setData({ mode: (mode || 'add') as 'add' | 'edit', studentId });

    if (mode === 'edit' && studentId) {
      const student = studentStore.students.find(s => s.id === studentId);
      if (student) {
        this.setData({
          name: student.name,
          school: student.school,
          grade: student.grade,
          classNum: student.classNum,
          enrollYear: student.enrollYear ? String(student.enrollYear) : '',
          studentNo: student.studentNo || '',
          note: student.note || '',
          gradeIndex: GRADE_OPTIONS.indexOf(student.grade),
        });
      }
    }

    wx.setNavigationBarTitle({ title: mode === 'edit' ? '修改学生' : '添加学生' });
  },

  onInput(e: WechatMiniprogram.Input & { currentTarget: { dataset: { field: string } } }) {
    const field = (e.currentTarget as any).dataset.field as string;
    this.setData({ [field]: e.detail.value } as any);
  },

  onGradeChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({ gradeIndex: idx, grade: GRADE_OPTIONS[idx] });
  },

  async onSave() {
    const { name, school, grade, classNum, enrollYear, studentNo, note, mode, studentId } = this.data;

    if (!name.trim()) { wx.showToast({ title: '姓名不能为空', icon: 'none' }); return; }
    if (!school.trim()) { wx.showToast({ title: '学校不能为空', icon: 'none' }); return; }
    if (!classNum.trim()) { wx.showToast({ title: '班级不能为空', icon: 'none' }); return; }

    this.setData({ loading: true });
    const payload: Omit<Student, 'id'> = {
      name: name.trim(),
      school: school.trim(),
      grade,
      classNum: classNum.trim(),
      enrollYear: enrollYear ? Number(enrollYear) : undefined,
      studentNo: studentNo.trim() || undefined,
      note: note.trim() || undefined,
    };

    try {
      if (mode === 'edit' && studentId) {
        const updated = await updateStudent(studentId, payload);
        studentStore.updateStudent(updated);
      } else {
        const created = await createStudent(payload);
        studentStore.addStudent(created);
      }
      wx.navigateBack();
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
