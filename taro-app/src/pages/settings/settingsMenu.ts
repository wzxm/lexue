import type { SettingsSummary } from '../../api/auth.api'

export type MenuKey =
  | 'notify'
  | 'family'
  | 'scheduleTab'
  | 'studentManage'
  | 'student'
  | 'shareSchedule'
  | 'feedback'
  | 'recommend'

export interface MenuRow {
  key: MenuKey
  label: string
  icon: string
}

export const menuRows: MenuRow[] = [
  { key: 'family', label: '家人管理', icon: '\ue600' },
  { key: 'scheduleTab', label: '课表管理', icon: '\ue696' },
  { key: 'studentManage', label: '学生管理', icon: '\ue706' },
  { key: 'shareSchedule', label: '分享课表', icon: '\ue729' },
  { key: 'feedback', label: '联系我们', icon: '\ue759' },
]

export function menuSuffix(row: MenuRow, summary: SettingsSummary | null): string {
  if (!summary) return ''
  switch (row.key) {
    case 'notify':
      return summary.notifyAnyEnabled ? '开' : '关'
    case 'family':
      return `${summary.familyMemberCount}位`
    case 'scheduleTab':
      return `${summary.scheduleCount}张`
    case 'studentManage':
      return `${summary.studentCount}位`
    default:
      return ''
  }
}
