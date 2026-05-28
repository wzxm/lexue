/**
 * 课程颜色 hex 预设（与 taro-app/src/constants/colors.ts 保持一致）
 */
const COURSE_COLOR_HEX_LIST = [
  '#3b82f6',
  '#22c55e',
  '#f97316',
  '#0d9488',
  '#f43f5e',
  '#14b8a6',
  '#f59e0b',
  '#0891b2',
];

const DEFAULT_COURSE_COLOR = '#3b82f6';

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function normalizeHex(color) {
  return String(color || '').trim().toLowerCase();
}

/**
 * 校验并返回小写 hex
 * @param {*} color
 * @param {string} [fieldName]
 * @returns {string}
 */
function validateCourseColor(color, fieldName = 'color') {
  const { enumValue, maxLength } = require('./validator');
  if (color === undefined || color === null || color === '') {
    const { fail, ERRORS } = require('./errors');
    throw fail(ERRORS.PARAM_ERROR, `缺少必填字段: ${fieldName}`);
  }
  const raw = String(color).trim();
  maxLength(raw, 20, fieldName);
  if (!HEX_PATTERN.test(raw)) {
    const { fail, ERRORS } = require('./errors');
    throw fail(ERRORS.PARAM_ERROR, `${fieldName}必须是 #RRGGBB 格式的 hex 色值`);
  }
  const normalized = raw.toLowerCase();
  enumValue(normalized, COURSE_COLOR_HEX_LIST, fieldName);
  return normalized;
}

/** 非写路径兜底：仅接受合法预设 hex，否则返回默认色 */
function resolveCourseColor(color) {
  const normalized = normalizeHex(color);
  if (COURSE_COLOR_HEX_LIST.includes(normalized)) return normalized;
  return DEFAULT_COURSE_COLOR;
}

module.exports = {
  COURSE_COLOR_HEX_LIST,
  DEFAULT_COURSE_COLOR,
  validateCourseColor,
  resolveCourseColor,
};
