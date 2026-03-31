# 乐学课表 - 数据模型文档

## 数据库平台

- **平台**：微信云数据库（NoSQL，MongoDB 兼容接口）
- **云环境 ID**：`cloud1-1g0kf2p8b07af20f`
- **数据库权限**：所有读写均通过云函数，数据库设为"仅创建者可读写"安全模式

## 集合总览

| 集合名 | 说明 | 关键关系 |
|--------|------|----------|
| `users` | 用户信息 | openid 唯一 |
| `students` | 学生信息 | → users（owner_openid） |
| `schedules` | 课表 | → students（student_id），含共享成员数组 |
| `courses` | 课程 | → schedules（schedule_id），→ students（student_id） |
| `families` | 家庭关系 | → users（owner_openid, member_openid），→ students |
| `share_codes` | 分享口令 | → schedules（schedule_id），→ students |
| `reminders` | 提醒记录 | → users（openid），→ courses（course_id） |
| `tools_data` | 百宝箱数据 | → users（openid），→ students（可选） |

---

## users（用户）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 是 | 云数据库自动生成 |
| `openid` | string | 是 | 微信用户唯一标识（唯一索引） |
| `nickname` | string | 否 | 用户昵称 |
| `avatar_url` | string | 否 | 头像 URL |
| `created_at` | date | 是 | 注册时间 |
| `updated_at` | date | 是 | 最后更新时间 |

**索引：**
```js
{ openid: 1 }  // unique
```

---

## students（学生）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 是 | 自动生成 |
| `owner_openid` | string | 是 | 创建者的 openid |
| `name` | string | 是 | 学生姓名 |
| `grade` | string | 否 | 年级（如：三年级、初一） |
| `avatar` | string | 否 | emoji 或 URL |
| `created_at` | date | 是 | 创建时间 |
| `updated_at` | date | 是 | 最后更新时间 |

**索引：**
```js
{ owner_openid: 1 }
```

---

## schedules（课表）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 是 | 自动生成 |
| `owner_openid` | string | 是 | 创建者 openid |
| `student_id` | string | 是 | 关联学生 ID |
| `name` | string | 是 | 课表名称（如：2024春季学期） |
| `semester` | string | 否 | 学期标识 |
| `is_active` | boolean | 是 | 是否为当前启用课表，默认 false |
| `shared_with` | array | 否 | 共享成员列表 |
| `shared_with[].openid` | string | 是 | 成员 openid |
| `shared_with[].nickname` | string | 否 | 成员昵称 |
| `shared_with[].permission` | string | 是 | 权限：`'edit'` 或 `'view'` |
| `shared_with[].joined_at` | date | 是 | 加入时间 |
| `created_at` | date | 是 | 创建时间 |
| `updated_at` | date | 是 | 最后更新时间 |

> **注意**：共享权限字段值是 `'edit'`（不是 `'editor'`）

**索引：**
```js
{ student_id: 1 }
{ owner_openid: 1 }
{ "shared_with.openid": 1 }
```

---

## courses（课程）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 是 | 自动生成 |
| `schedule_id` | string | 是 | 关联课表 ID |
| `student_id` | string | 是 | 关联学生 ID |
| `owner_openid` | string | 是 | 创建者 openid |
| `name` | string | 是 | 课程名称 |
| `day_of_week` | number | 是 | 星期几（1=周一，7=周日） |
| `period` | number | 是 | 第几节课（1起） |
| `start_time` | string | 否 | 上课时间（HH:mm） |
| `end_time` | string | 否 | 下课时间（HH:mm） |
| `teacher` | string | 否 | 教师姓名 |
| `room` | string | 否 | 教室/地点 |
| `color` | string | 否 | 课程颜色（hex 色值） |
| `created_at` | date | 是 | 创建时间 |
| `updated_at` | date | 是 | 最后更新时间 |

> **WeekDay 约定**：1=周一，2=周二，...，7=周日

**索引：**
```js
{ schedule_id: 1 }
{ student_id: 1, day_of_week: 1 }  // 首页渲染高频查询
```

---

## families（家庭关系）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 是 | 自动生成 |
| `owner_openid` | string | 是 | 家庭主创建者 openid |
| `member_openid` | string | 是 | 成员 openid |
| `member_nickname` | string | 否 | 成员昵称 |
| `member_avatar` | string | 否 | 成员头像 URL |
| `role` | string | 否 | 成员角色（如：爸爸、妈妈） |
| `student_id` | string | 是 | 关联学生 ID |
| `created_at` | date | 是 | 加入时间 |

**索引：**
```js
{ owner_openid: 1 }
{ member_openid: 1 }
```

---

## share_codes（分享口令）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 是 | 自动生成 |
| `code` | string | 是 | 6位大写口令（唯一索引） |
| `schedule_id` | string | 是 | 要分享的课表 ID |
| `student_id` | string | 是 | 关联学生 ID |
| `owner_openid` | string | 是 | 创建口令的用户 openid |
| `permission` | string | 是 | 授予的权限：`'edit'` 或 `'view'` |
| `expires_at` | date | 是 | 过期时间（默认24小时） |
| `used_count` | number | 是 | 已使用次数，默认 0 |
| `max_uses` | number | 否 | 最大使用次数，null = 不限 |
| `created_at` | date | 是 | 创建时间 |

> **注意**：微信云数据库不支持原生 TTL 自动删除，需定时云函数清理过期口令

**索引：**
```js
{ code: 1 }        // unique
{ expires_at: 1 }  // 用于清理过期数据
```

---

## reminders（提醒记录）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 是 | 自动生成 |
| `openid` | string | 是 | 接收提醒的用户 openid |
| `student_id` | string | 是 | 关联学生 ID |
| `course_id` | string | 是 | 关联课程 ID |
| `course_name` | string | 是 | 课程名称（冗余存储，防止课程删除后丢失） |
| `date` | string | 是 | 提醒日期（YYYY-MM-DD） |
| `trigger_time` | date | 是 | 触发时间（精确到分钟） |
| `status` | string | 是 | `pending` / `sent` / `failed` |
| `created_at` | date | 是 | 创建时间 |
| `sent_at` | date | 否 | 实际发送时间 |

**索引：**
```js
{ status: 1, trigger_time: 1 }  // 定时任务高频查询
{ openid: 1, date: 1 }
```

---

## tools_data（百宝箱数据）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 是 | 自动生成 |
| `openid` | string | 是 | 用户 openid |
| `tool_type` | string | 是 | 工具类型：`homework` / `exam` / `note` |
| `student_id` | string | 否 | 关联学生 ID（可选） |
| `title` | string | 是 | 标题 |
| `content` | string | 否 | 内容/备注 |
| `due_date` | string | 否 | 截止日期（YYYY-MM-DD） |
| `is_done` | boolean | 否 | 是否完成，默认 false |
| `tags` | array | 否 | 标签列表（string[]） |
| `created_at` | date | 是 | 创建时间 |
| `updated_at` | date | 是 | 最后更新时间 |

**索引：**
```js
{ openid: 1, tool_type: 1 }
{ student_id: 1 }
```

---

## 数据关系图

```
users
  └─ openid
       ↓
    students (owner_openid)
       ↓
    schedules (student_id, owner_openid)
       ├─ shared_with[] → other users
       └─ courses (schedule_id, student_id)
               ↓
           reminders (course_id)

share_codes (schedule_id, owner_openid)
families (owner_openid, member_openid, student_id)
tools_data (openid, student_id?)
```

## 命名约定

- 数据库字段：**snake_case**（`owner_openid`、`day_of_week`）
- 前端 TypeScript 类型：**camelCase**（`ownerId`、`weekday`）
- API 层负责映射转换
