# CLAUDE.md

## 项目简介

**智鑫课表** — 微信小程序，管理学生课表、家庭共享、上课提醒。

技术栈：Taro 4.x + React + TypeScript + Zustand + Sass + Tailwind CSS + 微信云开发

## 仓库结构

- `taro-app/` — 小程序前端
- `cloudfunctions/` — 云函数（auth/schedule/course/student/family/share/notify/reminder）
- `shared/` — 云函数公共模块（db.js/auth.js/errors.js/logger.js/validator.js）
- `schema/` — 数据库集合字段 & 索引说明
- `rules/` — CloudBase 按需规范（不是运行时代码）

## 常用命令

```bash
# 前端（taro-app/）— 用 pnpm
pnpm dev:weapp          # 开发
pnpm build:weapp        # 构建
pnpm build:upload       # 构建 + 上传

# 云函数（根目录）— 用 npm
npm run deploy          # 部署所有
npm run deploy:auth     # 部署单个
```

## 核心约定

- **数据流**：云函数 → `api/cloud.ts`（`cloud.call<T>(funcName, {action, payload})`）→ `*.api.ts` → zustand store → pages
- **云函数入口**：`exports.main` 接收 `{action, payload}` 路由；OPENID 必须从 `cloud.getWXContext()` 获取
- **响应格式**：`{code: 0, message, data}` 成功 / `{code: 4xxxx|50000, message, data: null}` 失败
- **命名**：DB 字段 snake_case，前端类型 camelCase
- **WeekDay**：1=周一 … 7=周日
- **FamilyRole**：`owner` | `edit` | `view`
- **样式**：Tailwind 工具类 + Sass(.scss)，`pxtransform` 自动 px→rpx
- **云环境 ID**：`test-d7gxuxk5a8418c629`
- **包管理**：前端 pnpm，根目录 npm，别混用

## CloudBase 规范查阅

需要平台细节时读 `rules/{name}/rule.md`：

| 场景 | 阅读 |
|------|------|
| 小程序 / Taro / 预览上传 | `rules/miniprogram-development/rule.md` |
| 云函数 | `rules/cloud-functions/rule.md` |
| 微信鉴权 / OPENID | `rules/auth-wechat/rule.md` |
| 云数据库 | `rules/no-sql-wx-mp-sdk/rule.md` |
| 云函数调 AI | `rules/ai-model-cloudbase/rule.md` |
| 全新视觉改版 | `rules/ui-design/rule.md` |

`rules/` 只保留上表场景（CloudBase skills **2.32.5** + 项目覆盖段）。与项目约定冲突时，以本文件和规则顶部的「智鑫课表」覆盖段为准。
