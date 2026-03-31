# 乐学课表 - 项目概览

## 项目简介

**乐学课表**是一款面向学生家庭的微信小程序，支持多学生课表管理、家庭成员共享、上课提醒推送等功能。家长可以为孩子创建课表，邀请其他家庭成员（爸爸、妈妈、爷爷等）以查看或编辑权限共享课表，并配置上课前提醒通知。

## 技术栈总览

| 分类 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Taro | 4.x |
| UI 框架 | React | 18.x |
| 语言 | TypeScript | 5.x |
| 状态管理 | Zustand | 5.x |
| 样式方案 | Sass (SCSS) | 1.x |
| 后端平台 | 微信云开发（云函数 + 云数据库） | - |
| 云函数运行时 | Node.js | 18+ |
| 包管理器（前端） | pnpm | - |
| 包管理器（云函数） | npm | - |

## 架构类型

- **仓库类型**：Monorepo（多模块）
- **部署目标**：微信小程序平台
- **后端形态**：Serverless（微信云函数，按调用计费）
- **数据库**：微信云数据库（NoSQL，MongoDB 兼容接口）

## 仓库模块结构

```
lexue/
├── taro-app/          # 小程序前端（Taro 4.x + React + TypeScript）
├── cloudfunctions/    # 微信云函数（9个，Node.js）
├── shared/            # 云函数公共模块（5个工具文件）
├── schema/            # 数据库集合字段 & 索引说明（文档）
├── scripts/           # 根目录脚本（云函数部署）
└── docs/              # AI 辅助开发文档（本目录）
```

## 云环境信息

- **云环境 ID**：`cloud1-1g0kf2p8b07af20f`
- 前端 `app.ts` 和所有云函数均硬编码此云环境 ID

## 核心功能模块

| 功能 | 相关页面 | 相关云函数 |
|------|----------|------------|
| 用户登录/注册 | `login` | `auth` |
| 课表管理（CRUD） | `schedule`, `schedule-form` | `schedule` |
| 课程管理（CRUD） | `schedule`, `course-form` | `course` |
| 学生管理 | `student-form` | `student` |
| 家庭共享 | `family-manage`, `share-code` | `family`, `share` |
| 提醒设置 | `notification-settings` | `notify`, `reminder` |
| 百宝箱工具 | `tools` | - |
| 个人设置 | `settings` | `auth` |

## 权限模型

课表访问权限分三级，均在云函数中基于微信 `WXContext.OPENID` 鉴权，前端传入的 openid 不可信：

| 权限级别 | 标识符 | 说明 |
|----------|--------|------|
| 所有者 | `owner` | 可读写删，可管理共享成员 |
| 编辑者 | `edit` | 可读写，不可删课表、不可管理成员 |
| 查看者 | `view` | 只读 |

## 相关文档

- [架构文档 - 前端](./architecture-taro-app.md)
- [架构文档 - 云函数](./architecture-cloudfunctions.md)
- [API 契约文档](./api-contracts-cloudfunctions.md)
- [数据模型文档](./data-models.md)
- [组件清单](./component-inventory-taro-app.md)
- [开发指南](./development-guide.md)
- [集成架构](./integration-architecture.md)
