import type { Period } from '../types/index';

// 默认8节课时间配置（小学常见作息）
export const DEFAULT_PERIODS: Period[] = [
  { index: 1, startTime: '08:00', endTime: '08:40', label: '第1节' },
  { index: 2, startTime: '08:50', endTime: '09:30', label: '第2节' },
  { index: 3, startTime: '10:00', endTime: '10:40', label: '第3节' },
  { index: 4, startTime: '10:50', endTime: '11:30', label: '第4节' },
  { index: 5, startTime: '14:00', endTime: '14:40', label: '第5节' },
  { index: 6, startTime: '14:50', endTime: '15:30', label: '第6节' },
  { index: 7, startTime: '15:40', endTime: '16:20', label: '第7节' },
  { index: 8, startTime: '16:30', endTime: '17:10', label: '第8节' },
];

export const PERIOD_COUNT = 8;
export const WEEKDAY_COUNT = 7;
