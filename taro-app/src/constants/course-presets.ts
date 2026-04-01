export type GradeLevel = 'elementary' | 'middle' | 'high' | 'college'

export interface GradePreset {
  key: GradeLevel
  label: string
  courses: string[]
}

export const GRADE_PRESETS: GradePreset[] = [
  {
    key: 'elementary',
    label: '小学',
    courses: ['语文', '数学', '英语', '音乐', '美术', '体育', '科学', '道德与法治', '信息技术', '劳动', '综合实践']
  },
  {
    key: 'middle',
    label: '初中',
    courses: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治', '体育与健康', '音乐', '美术', '信息技术', '综合实践']
  },
  {
    key: 'high',
    label: '高中',
    courses: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '技术', '体育与健康', '音乐', '美术']
  },
  {
    key: 'college',
    label: '大学',
    courses: ['高等数学', '大学英语', '大学物理', '线性代数', '概率统计', '计算机基础', '思想政治', '体育', '军事理论']
  },
]
