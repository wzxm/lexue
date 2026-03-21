/**
 * 统一错误码定义
 * 所有云函数使用此处定义的错误码返回，别tm乱造错误码
 */

const ERRORS = {
  SUCCESS:        { code: 0,     message: 'ok' },
  UNAUTHORIZED:   { code: 40001, message: 'UNAUTHORIZED' },
  FORBIDDEN:      { code: 40003, message: 'NO_PERMISSION' },
  NOT_FOUND:      { code: 40004, message: 'NOT_FOUND' },
  PARAM_ERROR:    { code: 40000, message: 'PARAM_ERROR' },
  LIMIT_EXCEEDED: { code: 40009, message: 'LIMIT_EXCEEDED' },
  INTERNAL_ERROR: { code: 50000, message: 'INTERNAL_ERROR' },
};

/**
 * 构造成功响应
 * @param {*} data 响应数据
 * @returns {{ code, message, data }}
 */
function success(data = null) {
  return { code: 0, message: 'ok', data };
}

/**
 * 构造错误响应
 * @param {object} error ERRORS 中的某个错误
 * @param {string} [detail] 额外的错误说明
 * @returns {{ code, message, data }}
 */
function fail(error, detail = null) {
  return {
    code: error.code,
    message: detail ? `${error.message}: ${detail}` : error.message,
    data: null,
  };
}

module.exports = { ERRORS, success, fail };
