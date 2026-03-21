// 课程颜色选项（10种）
// 语文红、数学蓝、英语绿、体育橙等常见学科色
export interface CourseColor {
  id: string;
  name: string;
  bg: string;
  text: string;
}

export const COURSE_COLORS: CourseColor[] = [
  { id: 'red',    name: '语文红', bg: '#FFEBEE', text: '#E53935' },
  { id: 'blue',   name: '数学蓝', bg: '#E3F2FD', text: '#1E88E5' },
  { id: 'green',  name: '英语绿', bg: '#E8F5E9', text: '#43A047' },
  { id: 'orange', name: '体育橙', bg: '#FFF3E0', text: '#FB8C00' },
  { id: 'purple', name: '音乐紫', bg: '#F3E5F5', text: '#8E24AA' },
  { id: 'teal',   name: '美术青', bg: '#E0F2F1', text: '#00897B' },
  { id: 'pink',   name: '科学粉', bg: '#FCE4EC', text: '#D81B60' },
  { id: 'indigo', name: '道德靛', bg: '#E8EAF6', text: '#3949AB' },
  { id: 'amber',  name: '历史黄', bg: '#FFF8E1', text: '#FFB300' },
  { id: 'cyan',   name: '地理蓝', bg: '#E0F7FA', text: '#0097A7' },
];

export const DEFAULT_COLOR = COURSE_COLORS[0];

export function getColorById(id: string): CourseColor {
  return COURSE_COLORS.find(c => c.id === id) || DEFAULT_COLOR;
}
