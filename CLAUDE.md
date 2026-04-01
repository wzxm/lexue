# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

**乐学课表** — 面向学生家长的微信小程序，用于管理学生课表、家庭成员共享、上课提醒等。

技术栈：Taro 4.x + React + TypeScript + Zustand + Sass + Tailwind CSS + 微信云开发（wx-server-sdk）

## 仓库结构

```
/
├── taro-app/          # 小程序前端（Taro 4.x）
├── cloudfunctions/    # 微信云函数（Node.js）
│   ├── auth/          # 用户认证
│   ├── schedule/      # 课表管理
│   ├── course/        # 课程管理
│   ├── student/       # 学生管理
│   ├── family/        # 家庭成员
│   ├── share/         # 分享口令
│   ├── notify/        # 消息通知
│   └── reminder/      # 上课提醒
├── shared/            # 云函数公共模块（db.js、auth.js、errors.js、logger.js、validator.js）
└── schema/            # 数据库集合字段 & 索引说明
```

## 常用命令

### 前端（taro-app/）

```bash
cd taro-app
pnpm install          # 安装依赖（项目用 pnpm）

pnpm dev:weapp        # 开发模式（--watch）
pnpm build:weapp      # 生产构建，产物在 dist/

pnpm ci:preview       # 构建并生成预览二维码
pnpm ci:upload        # 构建并上传到微信后台
pnpm build:upload     # 一键构建 + 上传
```

### 云函数部署（根目录）

```bash
npm run deploy              # 部署所有云函数
npm run deploy:auth         # 部署单个（auth/schedule/course/student/family/notify/reminder/share）
```

### CI 脚本

```bash
npm run ci:upload           # 上传小程序
npm run ci:preview          # 生成预览码
npm run ci:pack-npm         # 打包 npm
```

## 前端架构

### 数据流

```
云函数 ← Taro.cloud.callFunction → api/cloud.ts（封装 cloud.call）
    ↓
taro-app/src/api/*.api.ts（各模块 API，每个函数对应云函数一个 action）
    ↓
zustand store（auth.store.ts / schedule.store.ts）
    ↓
pages/*.tsx（页面）
```

### API 调用约定

所有云函数调用通过 `taro-app/src/api/cloud.ts` 中的 `cloud.call<T>(funcName, { action, payload })` 统一发起。每个云函数按 `action` 字段路由到对应处理函数。

### 状态管理

- `useAuthStore`：用户登录态，初始化时从 storage hydrate，App 挂载时调用 `hydrate()`
- `useScheduleStore`：当前课表、课程列表、周偏移（weekOffset），`buildGrid()` 将 courses 转为二维网格供渲染

### 路由 & TabBar

TabBar 三个 tab：课表（schedule）/ 工具（tools）/ 设置（settings）。其余页面通过 `Taro.navigateTo` 跳转。TabBar 使用自定义组件 `src/custom-tab-bar/`。

## 云函数架构

### 公共模块 shared/

| 文件 | 用途 |
|------|------|
| `db.js` | 封装云数据库 CRUD（getOne/findOne/create/update/delete） |
| `auth.js` | 鉴权工具（getOpenId/requireOwner/requireMember/requireEdit） |
| `errors.js` | 统一错误码（ERRORS 常量、success()/fail() 工厂） |
| `logger.js` | 日志工具 |
| `validator.js` | 参数校验 |

### 云函数入口约定

每个云函数 `exports.main` 接收 `{ action, payload }` 路由到内部函数。身份认证**必须**从 `cloud.getWXContext().OPENID` 获取，严禁从 payload 里取 openid。

### 统一响应格式

```js
{ code: 0, message: 'ok', data: T }        // 成功
{ code: 4xxxx, message: '...', data: null } // 业务错误
{ code: 50000, message: '...', data: null } // 系统错误
```

## 云开发环境

云环境 ID：`cloud1-1g0kf2p8b07af20f`（前端 `app.ts` 和所有云函数均硬编码此值）

## 数据库关键约定

- 集合字段用 **snake_case**（`owner_openid`、`day_of_week`），前端类型用 **camelCase**（`ownerId`、`weekday`）
- `WeekDay`：1=周一 … 7=周日
- `FamilyRole`：`owner` | `edit` | `view`（注意：共享权限字段值是 `'edit'`，不是 `'editor'`）
- 课表权限层级：owner > edit（shared_with.permission='edit'）> view
- 详细集合字段见 `schema/collections.md`，索引见 `schema/indexes.md`

## 注意事项

- 前端使用 **pnpm**，根目录云函数部署脚本用 **npm**，别混用
- 小程序端样式使用 **Tailwind CSS** 工具类 + **Sass（.scss）** + 内联 style；Tailwind 已在 `taro-app/tailwind.config.js` 配置，通过 PostCSS 集成，`pxtransform` 会自动将 `px` 转为 `rpx`
- `taro-app/dist/` 是编译产物，用微信开发者工具打开此目录调试
- 微信云数据库**不支持原生 TTL 索引**，过期 share_codes 需定时云函数清理
