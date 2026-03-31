# 乐学课表 - 前端架构文档（taro-app）

## 执行摘要

`taro-app` 是乐学课表的微信小程序前端，基于 Taro 4.x + React 18 构建，使用 TypeScript 开发，Zustand 管理状态，Sass（SCSS）与内联样式处理界面样式。编译产物在 `dist/` 目录，通过微信开发者工具调试和发布。

---

## 技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Taro | 4.1.x | 小程序跨端框架 |
| UI 框架 | React | 18.3 | 组件开发 |
| 语言 | TypeScript | 5.x | 类型安全 |
| 状态管理 | Zustand | 5.x | 全局状态（store） |
| 样式 | Sass (SCSS) | 1.x | 页面/组件级样式与全局 `app.scss` |
| 构建工具 | Webpack | 5.91 | 打包 |
| CI/发布 | miniprogram-ci | 2.x | 上传/预览 |

---

## 架构模式

**分层架构**（Layered Architecture）：

```
Pages / Components（视图层）
        ↓
    Zustand Stores（状态层）
        ↓
    api/*.api.ts（API 层）
        ↓
    api/cloud.ts（传输层）
        ↓
    微信云函数（后端）
```

每层职责单一，数据单向流动（从后端到 Store 到 View）。

---

## 应用入口

### app.ts
- 初始化微信云开发环境（`Taro.cloud.init({ env: 'cloud1-1g0kf2p8b07af20f' })`）
- 挂载 React App 组件
- 调用 `useAuthStore.hydrate()` 恢复登录态

### app.config.ts
- 注册所有页面路由
- 配置 TabBar（3个入口：index/tools/settings）
- 配置权限（如：录音、相册）

---

## 路由结构

| 路由 | TabBar | 说明 |
|------|--------|------|
| `pages/index/index` | ✅ | 首页课表网格 |
| `pages/tools/index` | ✅ | 百宝箱 |
| `pages/settings/index` | ✅ | 设置 |
| `pages/login/index` | - | 登录页，未登录时自动跳转 |
| `pages/schedule/index` | - | 课表列表 |
| `pages/schedule-form/index` | - | 创建/编辑课表 |
| `pages/course-form/index` | - | 添加/编辑课程 |
| `pages/student-form/index` | - | 添加/编辑学生 |
| `pages/family-manage/index` | - | 家庭成员管理 |
| `pages/share-code/index` | - | 分享口令 |
| `pages/notification-settings/index` | - | 提醒设置 |

跳转方式：`Taro.navigateTo({ url: Routes.XXX })`（非 TabBar 页面用 push）

---

## 状态管理

使用 Zustand 轻量状态管理，各 Store 职责：

### useAuthStore
```
状态: { user, isLoggedIn, isHydrated }
动作: login(), logout(), hydrate(), updateProfile()
初始化: App 挂载时 hydrate()，从微信 storage 恢复登录态
持久化: 登录 token/openid 存 storage，Zustand 不做持久化
```

### useScheduleStore
```
状态: { schedules, currentSchedule, courses, weekOffset, grid }
动作: loadSchedules(), selectSchedule(), loadCourses(), buildGrid()
核心: buildGrid() 将 courses 数组转为 grid[day][period] 二维结构供 ScheduleGrid 渲染
```

### useStudentStore
```
状态: { students, currentStudent }
动作: loadStudents(), selectStudent(), createStudent(), updateStudent()
```

### useFamilyStore
```
状态: { members }
动作: loadMembers(), updatePermission(), removeMember()
```

---

## API 层设计

### cloud.ts - 统一调用封装

```ts
// 所有云函数调用的唯一入口
cloud.call<T>(funcName: string, params: { action: string; payload?: object }): Promise<T>
```

各 `xxx.api.ts` 文件封装具体业务方法，每个方法对应云函数的一个 action，方便维护和 TypeScript 类型推导。

---

## 关键组件

### ScheduleGrid（核心 UI）
- 从 `useScheduleStore` 获取 `grid[day][period]` 二维数组
- 渲染 7列（周一到周日）× N行（节次）的课表格子
- 空格子可点击新建课程
- 已有课程格子显示 `CourseCard` 并可点击编辑
- 支持周偏移（`weekOffset`）切换上一周/下一周

---

## 样式方案

- **全局样式**：`src/app.scss`（主题变量、通用类等）
- **页面/组件样式**：与页面同名的 `index.scss`
- **动态样式**：必要时使用内联 `style`（如局部布局、主题色）

---

## 构建产物

| 目录 | 内容 |
|------|------|
| `taro-app/dist/` | 微信小程序编译产物（用微信开发者工具打开此目录） |
| `taro-app/dist/app.js` | 应用入口 |
| `taro-app/dist/pages/` | 各页面的 JS/WXML/WXSS |
| `taro-app/dist/components/` | 组件产物 |

---

## 编译命令

```bash
cd taro-app

pnpm dev:weapp        # 开发模式（--watch）
pnpm build:weapp      # 生产构建

pnpm ci:preview       # 构建 + 预览码
pnpm ci:upload        # 构建 + 上传后台
```

---

## 性能注意事项

- 课表数据在 Store 中缓存，切换学生/课表时按需加载
- `buildGrid()` 在每次 courses 变化时重新计算（Zustand selector）
- 图片资源建议使用 CDN URL（微信云存储或第三方 CDN）
- 避免在列表渲染中频繁调用云函数
