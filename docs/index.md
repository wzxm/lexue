# 乐学课表 - 项目文档索引

> **AI 辅助开发主入口**。在 brownfield PRD 或新功能开发前，先阅读此索引了解项目全貌。
>
> 生成时间：2026-03-28 | 扫描级别：快速扫描（pattern-based）

---

## 项目概览

- **类型**：Monorepo（多模块）
- **主要语言**：TypeScript（前端）+ JavaScript（云函数）
- **平台**：微信小程序
- **架构**：Taro 4.x 前端 + 微信云开发 Serverless 后端
- **云环境 ID**：`cloud1-1g0kf2p8b07af20f`

### 模块速览

| 模块 | 路径 | 类型 | 核心技术 |
|------|------|------|----------|
| 小程序前端 | `taro-app/` | mobile | Taro 4.x + React 18 + TypeScript + Zustand + Sass |
| 云函数后端 | `cloudfunctions/` | backend | Node.js + wx-server-sdk（9个函数） |
| 公共模块 | `shared/` | backend | db/auth/errors/logger/validator |
| 数据库文档 | `schema/` | 文档 | Markdown（字段定义 + 索引） |

---

## 生成的文档

### 项目级

- [项目概览](./project-overview.md) — 功能模块、技术栈总览、权限模型
- [源码目录结构](./source-tree-analysis.md) — 完整目录树 + 每个目录/文件的用途说明
- [集成架构](./integration-architecture.md) — 前后端通信机制、数据流、共享成员流程

### 前端（taro-app）

- [前端架构文档](./architecture-taro-app.md) — 分层架构、状态管理、路由、构建
- [组件清单](./component-inventory-taro-app.md) — 页面、组件、Store、API 层、工具函数

### 云函数后端（cloudfunctions）

- [云函数架构文档](./architecture-cloudfunctions.md) — 函数列表、入口约定、shared 模块、权限模型
- [API 契约文档](./api-contracts-cloudfunctions.md) — 所有云函数 action 的请求/响应格式

### 数据

- [数据模型文档](./data-models.md) — 8个数据库集合的字段定义、索引、关系图

### 开发

- [开发指南](./development-guide.md) — 环境搭建、开发命令、发布流程、常见问题

---

## 现有文档（来自代码库）

- [README.md](../README.md) — 项目简介、快速开始
- [schema/collections.md](../schema/collections.md) — 数据库集合字段原始定义
- [schema/indexes.md](../schema/indexes.md) — 数据库索引配置
- [CLAUDE.md](../CLAUDE.md) — AI 开发规范（项目级）

---

## 快速上手

### 启动开发环境

```bash
# 前端
cd taro-app
pnpm install
pnpm dev:weapp
# 用微信开发者工具打开 taro-app/dist/

# 云函数部署（根目录）
npm run deploy
```

### 核心代码入口

| 场景 | 关键文件 |
|------|----------|
| 应用初始化 | `taro-app/src/app.ts` |
| 路由配置 | `taro-app/src/app.config.ts` |
| 所有云函数调用 | `taro-app/src/api/cloud.ts` |
| 用户状态 | `taro-app/src/store/auth.store.ts` |
| 课表/课程状态 | `taro-app/src/store/schedule.store.ts` |
| 云函数入口 | `cloudfunctions/<name>/index.js` |
| 数据库操作 | `shared/db.js` |
| 错误码 | `shared/errors.js` |

---

## 给 AI 开发助手的提示

- **新增功能**前先查 [集成架构](./integration-architecture.md) 了解数据流
- **修改云函数**时参考 [API 契约文档](./api-contracts-cloudfunctions.md) 保持响应格式一致
- **修改数据库**时更新 [数据模型文档](./data-models.md) 和 `schema/collections.md`
- **权限问题**必须在云函数中基于 `WXContext.OPENID` 校验，禁止从 payload 取 openid
- `shared_with[].permission` 值是 `'edit'`（不是 `'editor'`）
- `WeekDay` 约定：1=周一，7=周日
- 前端 camelCase，数据库 snake_case，API 层负责映射
