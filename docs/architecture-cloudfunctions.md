# 乐学课表 - 云函数架构文档（cloudfunctions）

## 执行摘要

`cloudfunctions` 是乐学课表的后端，运行在微信云开发 Serverless 平台上。共9个云函数，使用 Node.js 开发，通过 `shared/` 公共模块共享数据库访问、鉴权、错误处理等逻辑。所有业务数据存储在微信云数据库（NoSQL）。

---

## 技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 运行时 | Node.js | 18+ | 云函数执行环境 |
| 云开发 SDK | wx-server-sdk | latest | 数据库/存储/消息访问 |
| 语言 | JavaScript | ES2020+ | 业务逻辑 |
| 包管理 | npm | - | 各云函数独立依赖 |

---

## 云函数列表

| 云函数 | actions | 说明 |
|--------|---------|------|
| `auth` | login, getProfile, updateProfile | 用户认证 |
| `schedule` | list, create, get, update, delete, setDefault | 课表管理 |
| `course` | list, create, update, delete, batchCreate | 课程管理 |
| `student` | list, create, get, update, delete | 学生管理 |
| `family` | listMembers, updatePermission, removeMember, leave | 家庭成员 |
| `share` | generateCode, verifyCode, acceptCode, generateInvite, verifyInvite, acceptInvite | 分享口令 |
| `notify` | getSettings, updateSettings, recordSubscribe | 消息通知设置 |
| `reminder` | （定时触发，无 action 路由） | 发送上课提醒 |
| `init-db` | （一次性运行） | 数据库初始化 |

---

## 云函数入口约定

所有业务云函数（除 reminder 和 init-db）遵循统一的请求路由模式：

```js
// cloudfunctions/xxx/index.js
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID    // ⚠️ 必须从此处取，禁止从 event 取
  const { action, payload = {} } = event

  switch (action) {
    case 'list':   return await list(openid, payload)
    case 'create': return await create(openid, payload)
    // ...
    default:       return fail(ERRORS.INVALID_ACTION)
  }
}
```

---

## 公共模块（shared/）

### shared/db.js - 数据库 CRUD 封装

```js
getOne(collection, id)                    // 按 _id 查单条
findOne(collection, query)                // 按条件查单条
find(collection, query, options)          // 查多条
create(collection, data)                  // 创建，自动填充 created_at/updated_at
update(collection, id, data)              // 更新，自动更新 updated_at
remove(collection, id)                    // 删除
```

### shared/auth.js - 鉴权工具

```js
getOpenId(context)                        // 从 WXContext 获取 openid
requireOwner(openid, resource)            // 验证必须为资源 owner
requireMember(openid, scheduleId)         // 验证必须是成员（owner/edit/view）
requireEdit(openid, scheduleId)           // 验证必须有编辑权限（owner/edit）
```

### shared/errors.js - 统一错误码

```js
const ERRORS = {
  INVALID_PARAMS: 40001,
  UNAUTHORIZED:   40003,
  NOT_FOUND:      40004,
  CODE_EXPIRED:   40005,
  ALREADY_MEMBER: 40006,
  SYSTEM_ERROR:   50000,
}

success(data)           // 返回 { code: 0, message: 'ok', data }
fail(code, message?)    // 返回 { code, message, data: null }
```

### shared/logger.js - 日志工具

```js
logger.info(message, data?)
logger.warn(message, data?)
logger.error(message, error?)
```

### shared/validator.js - 参数校验

```js
required(value, name)               // 必填校验
validateEnum(value, options, name)  // 枚举值校验
validateLength(value, min, max, name) // 长度校验
```

---

## 统一响应格式

所有云函数响应遵循同一结构：

```js
// 成功
{ code: 0, message: 'ok', data: T }

// 业务错误（4xxxx）
{ code: 40003, message: '无操作权限', data: null }

// 系统错误
{ code: 50000, message: '服务器内部错误', data: null }
```

---

## 权限校验模式

```
1. 从 cloud.getWXContext().OPENID 获取调用方 openid
2. 根据业务逻辑判断所需权限级别
3. 调用 shared/auth.js 工具验证权限
4. 权限不足时直接返回 fail(ERRORS.UNAUTHORIZED)
```

**权限层级：**
- `owner`：课表创建者，拥有全部权限
- `edit`：共享成员，`shared_with[].permission === 'edit'`，可读写课程，不可管理成员
- `view`：共享成员，`shared_with[].permission === 'view'`，只读

---

## 云数据库架构

- 8个集合：users, students, schedules, courses, families, share_codes, reminders, tools_data
- 所有 `_id` 由云数据库自动生成
- 集合字段使用 **snake_case**
- 时间字段类型为 `date`（服务端时间，`db.serverDate()`）
- 不支持原生 TTL 索引，share_codes 过期清理需定时任务

详见：[数据模型文档](./data-models.md)

---

## reminder 云函数（定时任务）

`reminder` 云函数由微信云开发定时触发器驱动：

```
定时触发（每N分钟）
    ↓
扫描 reminders 集合：status=pending & trigger_time <= 当前时间
    ↓
对每条记录：
  - 调用微信订阅消息 API 发送推送
  - 更新记录 status → sent (成功) / failed (失败)
  - 记录 sent_at
```

**注意：** 需要在微信云开发控制台为 reminder 函数配置定时触发器。

---

## 部署方式

```bash
# 根目录执行，需微信开发者工具授权
npm run deploy              # 部署所有云函数
npm run deploy:auth         # 部署单个云函数
```

部署脚本：`scripts/deploy-cloud-functions.js`

---

## 云函数配置

每个云函数目录下的 `config.json` 配置：

```json
{
  "permissions": {
    "openapi": []           // 需要调用的微信开放接口列表
  }
}
```

`reminder` 函数需在 `config.json` 中声明订阅消息发送权限（`openapi: ["subscribeMessage.send"]`）。

---

## 错误码参考

| 错误码 | 含义 |
|--------|------|
| 0 | 成功 |
| 40001 | 参数缺失或格式错误 |
| 40003 | 无权限 |
| 40004 | 资源不存在 |
| 40005 | 口令已过期或不存在 |
| 40006 | 已加入该共享课表 |
| 50000 | 服务器内部错误 |
