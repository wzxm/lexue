# 乐学课表 - 云函数 API 契约文档

## 调用约定

所有云函数通过微信 `Taro.cloud.callFunction` 调用，前端统一封装在 `taro-app/src/api/cloud.ts` 的 `cloud.call<T>(funcName, {action, payload})` 方法中。

### 请求格式

```ts
cloud.call<T>(funcName: string, params: { action: string; payload?: object })
```

### 响应格式

```js
// 成功
{ code: 0, message: 'ok', data: T }
// 业务错误
{ code: 4xxxx, message: '...', data: null }
// 系统错误
{ code: 50000, message: '...', data: null }
```

### 鉴权规则

- **openid 必须从 `cloud.getWXContext().OPENID` 获取**，严禁从 payload 取
- 权限校验在各云函数内部执行，通过 `shared/auth.js` 工具函数

---

## auth（用户认证）

### `login`
登录或注册用户，自动创建 users 记录。

**请求：** 无 payload（openid 从 WXContext 取）

**响应：**
```js
{ code: 0, data: { openid, nickname, avatar_url, created_at } }
```

---

### `getProfile`
获取当前用户信息。

**请求：** 无 payload

**响应：**
```js
{ code: 0, data: { openid, nickname, avatar_url, created_at, updated_at } }
```

---

### `updateProfile`
更新用户昵称和头像。

**请求：**
```js
payload: { nickname?: string; avatar_url?: string }
```

**响应：**
```js
{ code: 0, data: null }
```

---

## schedule（课表管理）

### `list`
列出当前用户有权访问的所有课表（owner + 共享给自己的）。

**请求：** 无 payload

**响应：**
```js
{ code: 0, data: Schedule[] }
```

---

### `create`
创建新课表。

**请求：**
```js
payload: { student_id: string; name: string; semester?: string }
```

**响应：**
```js
{ code: 0, data: { _id: string } }
```

---

### `get`
获取单个课表详情（含权限校验）。

**请求：**
```js
payload: { schedule_id: string }
```

**响应：**
```js
{ code: 0, data: Schedule }
```

---

### `update`
更新课表信息（仅 owner 可操作）。

**请求：**
```js
payload: { schedule_id: string; name?: string; semester?: string }
```

**响应：**
```js
{ code: 0, data: null }
```

---

### `delete`
删除课表及其所有课程（仅 owner 可操作）。

**请求：**
```js
payload: { schedule_id: string }
```

**响应：**
```js
{ code: 0, data: null }
```

---

### `setDefault`
设置指定课表为该学生的默认激活课表（仅 owner）。

**请求：**
```js
payload: { schedule_id: string; student_id: string }
```

**响应：**
```js
{ code: 0, data: null }
```

---

## course（课程管理）

### `list`
列出课表下的所有课程。

**请求：**
```js
payload: { schedule_id: string }
```

**响应：**
```js
{ code: 0, data: Course[] }
```

---

### `create`
创建单个课程（需 owner 或 edit 权限）。

**请求：**
```js
payload: {
  schedule_id: string;
  student_id: string;
  name: string;
  day_of_week: number;   // 1-7
  period: number;         // 1起
  start_time?: string;   // HH:mm
  end_time?: string;
  teacher?: string;
  room?: string;
  color?: string;         // hex
}
```

**响应：**
```js
{ code: 0, data: { _id: string } }
```

---

### `update`
更新课程（需 owner 或 edit 权限）。

**请求：**
```js
payload: { course_id: string; [fields to update] }
```

**响应：**
```js
{ code: 0, data: null }
```

---

### `delete`
删除课程（需 owner 或 edit 权限）。

**请求：**
```js
payload: { course_id: string }
```

**响应：**
```js
{ code: 0, data: null }
```

---

### `batchCreate`
批量创建课程（导入场景）。

**请求：**
```js
payload: { courses: CourseInput[] }
```

**响应：**
```js
{ code: 0, data: { created: number } }
```

---

## student（学生管理）

### `list`
列出当前用户创建的所有学生。

**请求：** 无 payload

**响应：**
```js
{ code: 0, data: Student[] }
```

---

### `create`
创建学生。

**请求：**
```js
payload: { name: string; grade?: string; avatar?: string }
```

**响应：**
```js
{ code: 0, data: { _id: string } }
```

---

### `get`
获取单个学生详情。

**请求：**
```js
payload: { student_id: string }
```

**响应：**
```js
{ code: 0, data: Student }
```

---

### `update`
更新学生信息（仅 owner）。

**请求：**
```js
payload: { student_id: string; name?: string; grade?: string; avatar?: string }
```

**响应：**
```js
{ code: 0, data: null }
```

---

### `delete`
删除学生及其关联数据（仅 owner）。

**请求：**
```js
payload: { student_id: string }
```

**响应：**
```js
{ code: 0, data: null }
```

---

## family（家庭成员管理）

### `listMembers`
列出课表的所有共享成员（需 owner 权限）。

**请求：**
```js
payload: { schedule_id: string }
```

**响应：**
```js
{ code: 0, data: FamilyMember[] }
```

---

### `updatePermission`
修改成员权限（仅 owner）。

**请求：**
```js
payload: { schedule_id: string; member_openid: string; permission: 'edit' | 'view' }
```

**响应：**
```js
{ code: 0, data: null }
```

---

### `removeMember`
移除成员（仅 owner）。

**请求：**
```js
payload: { schedule_id: string; member_openid: string }
```

**响应：**
```js
{ code: 0, data: null }
```

---

### `leave`
成员主动退出共享课表。

**请求：**
```js
payload: { schedule_id: string }
```

**响应：**
```js
{ code: 0, data: null }
```

---

## share（分享口令）

### `generateCode`
生成6位分享口令（有效期24小时）。

**请求：**
```js
payload: { schedule_id: string; student_id: string; permission: 'edit' | 'view' }
```

**响应：**
```js
{ code: 0, data: { code: string; expires_at: string } }
```

---

### `verifyCode`
验证口令有效性（不加入，仅查询）。

**请求：**
```js
payload: { code: string }
```

**响应：**
```js
{ code: 0, data: { schedule_name: string; student_name: string; permission: string } }
```

---

### `acceptCode`
接受口令，加入共享课表。

**请求：**
```js
payload: { code: string }
```

**响应：**
```js
{ code: 0, data: { schedule_id: string } }
```

---

### `generateInvite`
生成邀请链接（替代口令，适用于微信分享卡片）。

**请求：**
```js
payload: { schedule_id: string; student_id: string; permission: 'edit' | 'view' }
```

**响应：**
```js
{ code: 0, data: { invite_token: string; expires_at: string } }
```

---

### `verifyInvite`
验证邀请 token。

**请求：**
```js
payload: { invite_token: string }
```

**响应：**
```js
{ code: 0, data: { schedule_name: string; student_name: string; permission: string } }
```

---

### `acceptInvite`
接受邀请，加入共享课表。

**请求：**
```js
payload: { invite_token: string }
```

**响应：**
```js
{ code: 0, data: { schedule_id: string } }
```

---

## notify（通知设置）

### `getSettings`
获取当前用户的提醒设置。

**请求：** 无 payload

**响应：**
```js
{ code: 0, data: { remind_before_minutes: number; enabled: boolean } }
```

---

### `updateSettings`
更新提醒设置。

**请求：**
```js
payload: { remind_before_minutes?: number; enabled?: boolean }
```

**响应：**
```js
{ code: 0, data: null }
```

---

### `recordSubscribe`
记录用户订阅消息授权状态。

**请求：**
```js
payload: { template_id: string; status: 'accept' | 'reject' | 'ban' }
```

**响应：**
```js
{ code: 0, data: null }
```

---

## reminder（定时提醒，无 action 路由）

`reminder` 云函数由微信云开发**定时触发器**调用，不接受前端直接调用。

**功能：** 定时扫描 `reminders` 集合中 `status=pending` 且 `trigger_time <= 当前时间` 的记录，通过微信订阅消息 API 发送上课提醒，并更新记录状态为 `sent` 或 `failed`。

---

## 错误码参考

| 错误码 | 含义 |
|--------|------|
| 0 | 成功 |
| 40001 | 参数缺失或格式错误 |
| 40003 | 无权限（非 owner 或成员） |
| 40004 | 资源不存在 |
| 40005 | 口令已过期或不存在 |
| 40006 | 已加入该共享课表 |
| 50000 | 服务器内部错误 |
