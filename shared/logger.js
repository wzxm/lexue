/**
 * 结构化日志工具
 * 别用 console.log('啊出错了')，老王看了要骂人
 * 用结构化日志才能在云开发控制台里好好排查问题
 */

/**
 * 输出 INFO 级别日志
 * @param {string} functionName 云函数名称
 * @param {string} action 当前执行的动作
 * @param {object} [data] 附加数据
 */
function info(functionName, action, data = null) {
  console.log(JSON.stringify({
    level: 'INFO',
    function: functionName,
    action,
    data,
    time: new Date().toISOString(),
  }));
}

/**
 * 输出 WARN 级别日志
 * @param {string} functionName 云函数名称
 * @param {string} action 当前执行的动作
 * @param {object} [data] 附加数据
 */
function warn(functionName, action, data = null) {
  console.warn(JSON.stringify({
    level: 'WARN',
    function: functionName,
    action,
    data,
    time: new Date().toISOString(),
  }));
}

/**
 * 输出 ERROR 级别日志
 * @param {string} functionName 云函数名称
 * @param {string} action 当前执行的动作
 * @param {Error|object} error 错误对象
 */
function error(functionName, action, err) {
  console.error(JSON.stringify({
    level: 'ERROR',
    function: functionName,
    action,
    error: err instanceof Error ? {
      message: err.message,
      stack: err.stack,
    } : err,
    time: new Date().toISOString(),
  }));
}

module.exports = { info, warn, error };
