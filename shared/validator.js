/**
 * 参数校验工具
 * 别让那些缺参数的请求跑进来搞乱数据库
 */

const { ERRORS, fail } = require('./errors');

/**
 * 校验必填字段
 * @param {object} params 参数对象
 * @param {string[]} fields 必填字段列表
 * @throws 如果缺少必填字段则抛出错误响应
 *
 * @example
 * require(payload, ['name', 'grade', 'class_name'])
 */
function require(params, fields) {
  if (!params || typeof params !== 'object') {
    throw fail(ERRORS.PARAM_ERROR, '缺少请求参数');
  }
  const missing = fields.filter(f => {
    const val = params[f];
    // 空字符串、null、undefined 都算缺失
    return val === undefined || val === null || val === '';
  });
  if (missing.length > 0) {
    throw fail(ERRORS.PARAM_ERROR, `缺少必填字段: ${missing.join(', ')}`);
  }
}

/**
 * 字符串长度校验
 * @param {string} str 字符串
 * @param {number} max 最大长度
 * @param {string} [fieldName] 字段名（用于错误提示）
 * @throws 如果超出长度限制则抛出错误响应
 */
function maxLength(str, max, fieldName = '字段') {
  if (typeof str === 'string' && str.length > max) {
    throw fail(ERRORS.PARAM_ERROR, `${fieldName}长度不能超过 ${max} 个字符`);
  }
}

/**
 * 枚举值校验
 * @param {*} value 要校验的值
 * @param {Array} allowed 允许的值列表
 * @param {string} [fieldName] 字段名（用于错误提示）
 * @throws 如果不在枚举范围内则抛出错误响应
 */
function enumValue(value, allowed, fieldName = '字段') {
  if (!allowed.includes(value)) {
    throw fail(ERRORS.PARAM_ERROR, `${fieldName}必须是以下值之一: ${allowed.join(', ')}`);
  }
}

/**
 * 数字范围校验
 * @param {number} value 要校验的数字
 * @param {number} min 最小值（含）
 * @param {number} max 最大值（含）
 * @param {string} [fieldName] 字段名
 */
function range(value, min, max, fieldName = '字段') {
  if (typeof value !== 'number' || value < min || value > max) {
    throw fail(ERRORS.PARAM_ERROR, `${fieldName}必须在 ${min} 到 ${max} 之间`);
  }
}

module.exports = { require, maxLength, enumValue, range };
