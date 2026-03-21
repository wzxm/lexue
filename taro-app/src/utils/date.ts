// 日期工具函数 — 纯逻辑，零平台依赖，直接复用

/**
 * 获取当前周相对于学期开始的偏移量（从0开始）
 */
export function getCurrentWeekOffset(semesterStartDate?: string): number {
  const start = semesterStartDate ? new Date(semesterStartDate) : getThisMonthFirstMonday();
  const now = new Date();
  const startMonday = getMondayOfWeek(start);
  const nowMonday = getMondayOfWeek(now);
  const diffMs = nowMonday.getTime() - startMonday.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

/** 获取本月第一个周一，作为默认学期开始 */
function getThisMonthFirstMonday(): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  while (d.getDay() !== 1) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** 获取指定日期所在周的周一 */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 根据偏移量获取该周周一到周日的日期数组
 * @returns 7个日期字符串 YYYY-MM-DD，index 0 = 周一
 */
export function getWeekDates(offset: number): string[] {
  const monday = getMondayOfWeek(new Date());
  monday.setDate(monday.getDate() + offset * 7);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    dates.push(formatDate(d, 'YYYY-MM-DD'));
  }
  return dates;
}

/** 日期格式化 */
export function formatDate(date: Date, format: string): string {
  const map: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'),
    HH: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'),
    ss: String(date.getSeconds()).padStart(2, '0'),
  };
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, key => map[key]);
}

/** 是否今天 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/** 获取周几字符串 */
export function getWeekdayLabel(weekday: number): string {
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return labels[weekday - 1] || '';
}

/** 格式化成 M/D 短日期 */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
