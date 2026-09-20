/** 课表周末显示：开关打开=显示周六日，关闭=隐藏周六日 */

export const WEEKEND_SWITCH_COPY = {
  on: {
    title: '显示周末课程',
    desc: '开启后，周视图将显示周六、周日课程',
  },
  off: {
    title: '隐藏周末课程',
    desc: '关闭后，周视图将隐藏周六、周日课程',
  },
} as const

export function isWeekendVisible(hideWeekend?: boolean): boolean {
  return hideWeekend !== true
}
