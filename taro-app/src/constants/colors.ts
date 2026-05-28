/** 课程颜色选项（与 design-artifacts/ui-mockups/03-course-form.html 一致） */
export interface CourseColor {
  hex: string;
  name: string;
}

export const COURSE_COLORS: CourseColor[] = [
  { hex: '#3b82f6', name: '蓝' },
  { hex: '#22c55e', name: '绿' },
  { hex: '#f97316', name: '橙' },
  { hex: '#0d9488', name: '青' },
  { hex: '#f43f5e', name: '玫红' },
  { hex: '#14b8a6', name: '碧' },
  { hex: '#f59e0b', name: '琥珀' },
  { hex: '#0891b2', name: '湖蓝' },
];

export const DEFAULT_COURSE_COLOR = COURSE_COLORS[0].hex;

export function isCourseColorHex(value?: string): boolean {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}
