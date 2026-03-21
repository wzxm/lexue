# 乐学课表 - 数据库索引配置

在微信云开发控制台或通过云函数初始化时执行以下索引创建语句。

## users

```js
// openid 唯一索引，用于登录鉴权
db.collection("users").createIndex({ openid: 1 }, { unique: true })
```

## students

```js
// 按 owner 查学生列表
db.collection("students").createIndex({ owner_openid: 1 })
```

## schedules

```js
// 按学生查课表
db.collection("schedules").createIndex({ student_id: 1 })

// 按创建者查课表
db.collection("schedules").createIndex({ owner_openid: 1 })

// 按共享成员查有权限的课表
db.collection("schedules").createIndex({ "shared_with.openid": 1 })
```

## courses

```js
// 按课表查所有课程
db.collection("courses").createIndex({ schedule_id: 1 })

// 按学生+星期查课程（首页课表渲染高频查询）
db.collection("courses").createIndex({ student_id: 1, day_of_week: 1 })
```

## families

```js
// 按 owner 查家庭成员
db.collection("families").createIndex({ owner_openid: 1 })

// 按成员查所有加入的家庭
db.collection("families").createIndex({ member_openid: 1 })
```

## share_codes

```js
// 口令唯一索引，用于扫码/输入口令查找
db.collection("share_codes").createIndex({ code: 1 }, { unique: true })

// TTL 索引，自动清理过期口令（expires_at 字段）
db.collection("share_codes").createIndex({ expires_at: 1 })
```

> **注意**：微信云数据库不支持原生 TTL 索引自动删除，需配合定时云函数清理过期数据。

## reminders

```js
// 按状态+触发时间查待发送提醒（定时任务高频查询）
db.collection("reminders").createIndex({ status: 1, trigger_time: 1 })

// 按用户+日期查某天的提醒
db.collection("reminders").createIndex({ openid: 1, date: 1 })
```

## tools_data

```js
// 按用户+工具类型查数据
db.collection("tools_data").createIndex({ openid: 1, tool_type: 1 })

// 按学生查关联的百宝箱数据
db.collection("tools_data").createIndex({ student_id: 1 })
```

---

## 索引创建云函数示例

如需通过云函数批量初始化索引，可在 `cloudfunctions/init_indexes/index.js` 中实现：

```js
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  // 注意：微信云数据库 JS SDK 不直接支持 createIndex
  // 需在云开发控制台手动建立，或通过 HTTP API 调用
  // 文档：https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-http-api/database/
  return { message: "请在云开发控制台手动创建索引" };
};
```
