# 乐学课表 - 前端组件清单

## 页面组件（Pages）

TabBar 三个主入口 + 8个二级页面，共11个页面。

### TabBar 主入口页面

| 页面 | 路径 | 功能说明 |
|------|------|----------|
| 首页（课表网格） | `pages/index` | 按周展示课程网格，切换学生/课表，支持单双周 |
| 百宝箱 | `pages/tools` | 作业、考试、备忘等工具集合 |
| 设置 | `pages/settings` | 个人设置、账号管理 |

### 二级页面

| 页面 | 路径 | 功能说明 | 入口 |
|------|------|----------|------|
| 登录页 | `pages/login` | 微信授权登录，首次使用引导 | 未登录时自动跳转 |
| 课表列表 | `pages/schedule` | 显示学生的所有课表，切换/删除 | 首页导航 |
| 创建/编辑课表 | `pages/schedule-form` | 新建课表，设置名称、学期 | 课表列表操作 |
| 添加/编辑课程 | `pages/course-form` | 设置课程名、颜色、时间、教师等 | 课表网格点击 |
| 添加/编辑学生 | `pages/student-form` | 设置学生姓名、年级、头像 | 设置页 |
| 家庭成员管理 | `pages/family-manage` | 查看成员列表，修改权限，移除成员 | 设置页 |
| 分享口令 | `pages/share-code` | 生成口令或邀请链接，输入口令加入 | 家庭管理/分享入口 |
| 提醒设置 | `pages/notification-settings` | 配置提前多少分钟提醒，开关订阅 | 设置页 |

---

## 公共组件（Components）

### ScheduleGrid

**路径：** `src/components/ScheduleGrid/`

**功能：** 课表二维网格展示组件，是应用的核心 UI 组件。

| 属性 | 说明 |
|------|------|
| 展示形式 | 时间段（行）× 星期（列）的二维网格 |
| 数据来源 | 从 `useScheduleStore` 的 `buildGrid()` 获取二维课程数组 |
| 交互 | 点击空格子→新建课程，点击已有课程→编辑 |
| 特性 | 支持单周/双周模式切换，支持横向滑动 |

---

### CourseCard

**路径：** `src/components/CourseCard/`

**功能：** 单个课程卡片展示，嵌套在 ScheduleGrid 内。

| 属性 | 说明 |
|------|------|
| 展示内容 | 课程名称、教师、教室（空间有限时省略） |
| 样式 | 根据 `color` 字段动态设置背景色 |

---

### CloudTipModal

**路径：** `src/components/CloudTipModal/`

**功能：** 云开发提示弹窗，用于首次使用引导或云服务异常提示。

---

## 自定义 TabBar

**路径：** `src/custom-tab-bar/`

**功能：** 替代微信原生 TabBar，实现自定义样式和激活态控制。三个 Tab：首页（课表）/ 百宝箱 / 设置。

---

## 状态管理（Stores）

| Store | 文件 | 管理状态 | 初始化时机 |
|-------|------|----------|------------|
| `useAuthStore` | `store/auth.store.ts` | 登录态、openid、用户 profile | App 挂载时 `hydrate()`，从 storage 恢复 |
| `useScheduleStore` | `store/schedule.store.ts` | 当前课表、课程列表、weekOffset、网格数据 | 登录后 / 首页加载 |
| `useStudentStore` | `store/student.store.ts` | 学生列表、当前选中学生 | 登录后 |
| `useFamilyStore` | `store/family.store.ts` | 家庭成员列表 | 家庭管理页加载 |

---

## 工具函数（Utils）

| 文件 | 功能 |
|------|------|
| `utils/date.ts` | 日期处理：周计算、`day_of_week` 转换、格式化显示 |
| `utils/permission.ts` | 权限判断：`isOwner()`, `canEdit()`, `canView()` |
| `utils/storage.ts` | 微信 storage 封装：`get/set/remove` |
| `utils/tabState.ts` | TabBar 激活态管理 |

---

## 常量（Constants）

| 文件 | 内容 |
|------|------|
| `constants/routes.ts` | 所有页面路由路径常量（避免魔法字符串） |
| `constants/colors.ts` | 课程颜色预设列表（hex 色值数组） |
| `constants/periods.ts` | 课节时间配置（第1-N节课的默认开始/结束时间） |

---

## API 层（api/）

| 文件 | 对应云函数 | 主要方法 |
|------|----------|---------|
| `api/cloud.ts` | 所有函数 | `cloud.call<T>(funcName, {action, payload})` |
| `api/auth.api.ts` | `auth` | `login()`, `getProfile()`, `updateProfile()` |
| `api/schedule.api.ts` | `schedule` | `listSchedules()`, `createSchedule()`, `setDefault()`, ... |
| `api/course.api.ts` | `course` | `listCourses()`, `createCourse()`, `batchCreate()`, ... |
| `api/student.api.ts` | `student` | `listStudents()`, `createStudent()`, ... |
| `api/family.api.ts` | `family` | `listMembers()`, `updatePermission()`, ... |
| `api/share.api.ts` | `share` | `generateCode()`, `acceptCode()`, `generateInvite()`, ... |
| `api/notify.api.ts` | `notify` | `getSettings()`, `updateSettings()`, `recordSubscribe()` |
