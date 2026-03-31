# 乐学课表 - 集成架构文档

## 架构概览

乐学课表采用微信云开发 Serverless 架构，前端（小程序）与后端（云函数）通过微信云调用协议通信，不存在传统意义上的 HTTP API。

```
┌─────────────────────────────────────────────────────────┐
│                     微信小程序平台                        │
│                                                         │
│   ┌──────────────┐         ┌───────────────────────┐   │
│   │  taro-app    │         │   微信云开发平台        │   │
│   │  (前端)      │         │                       │   │
│   │              │  云调用  │  ┌─────────────────┐  │   │
│   │  api/cloud.ts│─────────▶  │   cloudfunctions │  │   │
│   │              │         │  │   (9个云函数)    │  │   │
│   │  Zustand     │         │  └────────┬────────┘  │   │
│   │  Stores      │         │           │            │   │
│   │              │         │  ┌────────▼────────┐  │   │
│   │  Pages/      │         │  │   shared/       │  │   │
│   │  Components  │         │  │   公共模块       │  │   │
│   └──────────────┘         │  └────────┬────────┘  │   │
│                             │           │            │   │
│                             │  ┌────────▼────────┐  │   │
│                             │  │   云数据库       │  │   │
│                             │  │  (8个集合)      │  │   │
│                             │  └─────────────────┘  │   │
│                             └───────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 集成点详情

### 1. 前端 → 云函数（主要通信路径）

| 属性 | 值 |
|------|-----|
| 通信方式 | `Taro.cloud.callFunction()` |
| 统一入口 | `taro-app/src/api/cloud.ts` 的 `cloud.call<T>()` |
| 请求格式 | `{ action: string; payload?: object }` |
| 响应格式 | `{ code: number; message: string; data: T }` |
| 鉴权方式 | 微信自动传递 `WXContext.OPENID`（无需 token） |

**调用示例：**
```ts
// api/cloud.ts
const result = await cloud.call<Schedule[]>('schedule', {
  action: 'list',
  payload: {}
})
```

---

### 2. 云函数 → 云数据库

| 属性 | 值 |
|------|-----|
| SDK | `wx-server-sdk`（云函数端） |
| 公共封装 | `shared/db.js`（getOne/findOne/create/update/delete） |
| 数据库权限 | 仅云函数可读写（安全模式） |
| 环境 ID | `cloud1-1g0kf2p8b07af20f` |

---

### 3. 云函数间关系（共享代码）

云函数不直接相互调用，而是通过 `shared/` 公共模块共享逻辑：

| 云函数 | 使用的 shared 模块 |
|--------|-------------------|
| 所有云函数 | `shared/errors.js`（统一响应）、`shared/logger.js` |
| auth, schedule, course, student, family, share | `shared/auth.js`（鉴权）、`shared/db.js`（数据库） |
| schedule, course | `shared/validator.js`（参数校验） |

---

### 4. reminder 云函数（定时触发）

`reminder` 云函数不接受前端调用，由微信云开发的**定时触发器**驱动：

```
微信云开发定时器（Cron）
    ↓ 每X分钟触发
cloudfunctions/reminder/index.js
    ↓ 查询 status=pending 的提醒记录
云数据库 reminders 集合
    ↓ 调用微信订阅消息 API
用户微信通知
    ↓ 更新记录 status → sent/failed
云数据库 reminders 集合
```

---

## 数据流示例：首页加载课表

```
1. App 挂载 → useAuthStore.hydrate()
   └─ 从微信 storage 读取缓存登录态
   └─ 若无缓存 → 跳转 login 页面

2. 登录页 → auth.api.login()
   └─ cloud.call('auth', { action: 'login' })
   └─ 云函数 auth: 查/创建 users 记录
   └─ 返回 { openid, nickname, avatar_url }
   └─ useAuthStore.setUser() + 写 storage

3. 首页加载 → useStudentStore.loadStudents()
   └─ cloud.call('student', { action: 'list' })
   └─ 返回 Student[]

4. 选择学生 → useScheduleStore.loadSchedules(studentId)
   └─ cloud.call('schedule', { action: 'list' })
   └─ 返回 Schedule[]（owner + 共享的）

5. 选择激活课表 → useScheduleStore.loadCourses(scheduleId)
   └─ cloud.call('course', { action: 'list', payload: { schedule_id } })
   └─ 返回 Course[]

6. buildGrid() → 将 Course[] 转为 [day][period] 二维数组
   └─ ScheduleGrid 组件渲染
```

---

## 共享成员加入流程

```
Owner 端:
share.api.generateCode({ schedule_id, student_id, permission })
    ↓
生成6位口令 → share_codes 集合
    ↓
UI 展示口令

成员端:
share.api.acceptCode({ code })
    ↓
云函数验证口令有效性
    ↓
schedules.shared_with[] 添加成员
    ↓
返回 { schedule_id }
    ↓
成员可查看/编辑该课表
```

---

## 跨模块依赖关系

| 前端 API 模块 | → 云函数 | → 数据库集合 |
|--------------|----------|------------|
| `auth.api.ts` | `auth` | `users` |
| `schedule.api.ts` | `schedule` | `schedules` |
| `course.api.ts` | `course` | `courses` |
| `student.api.ts` | `student` | `students` |
| `family.api.ts` | `family` | `families`, `schedules` |
| `share.api.ts` | `share` | `share_codes`, `schedules` |
| `notify.api.ts` | `notify` | `reminders`（设置部分） |
| - | `reminder`（定时） | `reminders`, `courses` |
