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
    // 大学场景优先展示高频基础课 + 可复用的“专业课”占位，减少手动输入
    courses: [
      '高等数学',
      '线性代数',
      '概率统计',
      '专业课',
      '专业课（实验）',
      '大学英语',
      '大学物理',
      '程序设计',
      '数据结构',
      '计算机基础',
      '思想政治',
      '体育',
      '军事理论'
    ]
  },
]
