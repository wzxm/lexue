/**
 * 数据库封装工具
 * 封装微信云开发 cloud.database() 常用操作
 * 别在业务代码里直接写一堆 db.collection().doc()，恶心死了
 */

const cloud = require('wx-server-sdk');

/**
 * 获取数据库实例（懒加载）
 */
let _db = null;
function getDB() {
  if (!_db) {
    _db = cloud.database();
  }
  return _db;
}

/**
 * 获取集合引用
 * @param {string} name 集合名称
 */
function col(name) {
  return getDB().collection(name);
}

/**
 * 查询单条记录
 * @param {string} collectionName 集合名称
 * @param {string} docId 文档ID
 * @returns {Promise<object|null>}
 */
async function getOne(collectionName, docId) {
  try {
    const { data } = await col(collectionName).doc(docId).get();
    return data;
  } catch (e) {
    // 记录不存在时云开发会抛异常，统一返回 null
    if (e.errCode === -1 || e.message?.includes('not found')) {
      return null;
    }
    throw e;
  }
}

/**
 * 按条件查询单条记录
 * @param {string} collectionName 集合名称
 * @param {object} where 查询条件
 * @returns {Promise<object|null>}
 */
async function findOne(collectionName, where) {
  const { data } = await col(collectionName).where(where).limit(1).get();
  return data.length > 0 ? data[0] : null;
}

/**
 * 批量查询记录
 * @param {string} collectionName 集合名称
 * @param {object} where 查询条件
 * @param {object} [options] 可选配置：{ orderBy, limit, skip }
 * @returns {Promise<Array>}
 */
async function getList(collectionName, where = {}, options = {}) {
  let query = col(collectionName).where(where);
  if (options.orderBy) {
    const { field, direction = 'asc' } = options.orderBy;
    query = query.orderBy(field, direction);
  }
  if (options.skip) {
    query = query.skip(options.skip);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }
  const { data } = await query.get();
  return data;
}

/**
 * 创建文档
 * @param {string} collectionName 集合名称
 * @param {object} data 文档数据（会自动加 createTime/updateTime）
 * @returns {Promise<{ _id: string }>}
 */
async function create(collectionName, data) {
  const now = new Date();
  const doc = { ...data, createTime: now, updateTime: now };
  const { _id } = await col(collectionName).add({ data: doc });
  return { _id };
}

/**
 * 更新文档（合并更新，不是替换）
 * @param {string} collectionName 集合名称
 * @param {string} docId 文档ID
 * @param {object} data 要更新的字段
 * @returns {Promise<void>}
 */
async function update(collectionName, docId, data) {
  const doc = { ...data, updateTime: new Date() };
  await col(collectionName).doc(docId).update({ data: doc });
}

/**
 * 按条件批量更新
 * @param {string} collectionName 集合名称
 * @param {object} where 查询条件
 * @param {object} data 要更新的字段
 * @returns {Promise<{ updated: number }>}
 */
async function updateWhere(collectionName, where, data) {
  const doc = { ...data, updateTime: new Date() };
  const result = await col(collectionName).where(where).update({ data: doc });
  return { updated: result.stats.updated };
}

/**
 * 删除文档
 * @param {string} collectionName 集合名称
 * @param {string} docId 文档ID
 * @returns {Promise<void>}
 */
async function remove(collectionName, docId) {
  await col(collectionName).doc(docId).remove();
}

/**
 * 按条件批量删除
 * @param {string} collectionName 集合名称
 * @param {object} where 查询条件
 * @returns {Promise<{ deleted: number }>}
 */
async function removeWhere(collectionName, where) {
  const result = await col(collectionName).where(where).remove();
  return { deleted: result.stats.deleted };
}

/**
 * 统计记录数
 * @param {string} collectionName 集合名称
 * @param {object} where 查询条件
 * @returns {Promise<number>}
 */
async function count(collectionName, where = {}) {
  const { total } = await col(collectionName).where(where).count();
  return total;
}

/**
 * 暴露数据库查询命令，用于构造复杂条件
 */
function getCommand() {
  return getDB().command;
}

module.exports = {
  getDB,
  col,
  getOne,
  findOne,
  getList,
  create,
  update,
  updateWhere,
  remove,
  removeWhere,
  count,
  getCommand,
};
