# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目说明

**乐学课表** taro-app 子目录 — Taro 4.x + React + TypeScript + Zustand + Sass 微信小程序前端。

## 常用命令

```bash
pnpm dev:weapp        # 开发模式（--watch），产物输出到 dist/
pnpm build:weapp      # 生产构建
pnpm ci:preview       # 构建 + 生成预览二维码
pnpm ci:upload        # 构建 + 上传到微信后台
```

> 用微信开发者工具打开 `dist/` 目录进行调试和预览。

## 核心架构

### 数据流

```
云函数 (callFunction)
    ↓
src/api/cloud.ts  — CloudClient.call<T>()  统一封装，业务错误抛 Error
    ↓
src/api/*.api.ts  — 各模块 API 函数，每个函数对应云函数一个 action
    ↓
src/store/*.ts    — Zustand store（auth / schedule / student / family）
    ↓
src/pages/        — 页面组件
```

### Store 说明

| Store | 文件 | 关键点 |
|-------|------|--------|
| `useAuthStore` | `store/auth.store.ts` | 模块加载时立即从 storage hydrate；App 挂载时调用 `hydrate()` 刷新 |
| `useScheduleStore` | `store/schedule.store.ts` | 课表 + 课程列表 + `weekOffset`；`buildGrid()` 导出函数将 courses 转为 `grid[period-1][weekday-1]` |
| `useStudentStore` | `store/student.store.ts` | 学生列表 + 当前选中学生 |
| `useFamilyStore` | `store/family.store.ts` | 家庭成员列表 |

### 关键类型（src/types/index.ts）

- `WeekDay`：1=周一…7=周日
- `WeekType`：`'all' | 'odd' | 'even'`（单双周）
- `FamilyRole`：`'owner' | 'edit' | 'view'`（共享权限字段值是 `'edit'`，不是 `'editor'`）
- `ScheduleGrid`：`(Course | null)[][]`，`grid[period-1][weekday-1]`
- `BackendSettings` 用 snake_case，`UserSettings` 用 camelCase；互转用 `toBackendSettings` / `toFrontendSettings`

### 工具 & 常量

- `src/constants/routes.ts` — `ROUTES` 常量，页面跳转统一从这里取
- `src/constants/periods.ts` — `PERIOD_COUNT`、`WEEKDAY_COUNT`
- `src/utils/storage.ts` — wx storage 封装（loadOpenId/saveUserInfo 等）
- `src/utils/permission.ts` — 权限判断工具
- `src/utils/date.ts` — 日期处理工具

### 路由

TabBar 三个 tab：`pages/schedule`（课表）/ `pages/tools`（工具）/ `pages/settings`（设置）。其余页面用 `Taro.navigateTo` 跳转，路由值始终用 `ROUTES` 常量。

## 注意事项

- **样式**：使用 **Tailwind CSS** 工具类 + **Sass（.scss）** + 内联 style；Tailwind 配置在 `tailwind.config.js`，通过 PostCSS 集成，`pxtransform` 自动将 `px` 转为 `rpx`
- **云函数调用**：所有云函数调用必须通过 `cloud.call()`，不要直接用 `Taro.cloud.callFunction`
- **openid 来源**：云函数身份认证必须从 `cloud.getWXContext().OPENID` 取，严禁从 payload 里传
- **Snake/Camel case**：后端数据库字段 snake_case，前端 TypeScript 类型 camelCase，API 层负责转换
- **新增页面**：必须同时在 `src/app.config.ts` 的 `pages` 数组和 `src/constants/routes.ts` 的 `ROUTES` 里注册
