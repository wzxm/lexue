---
name: cloud-functions
description: 课表管家 Event 云函数开发、部署和调试规范
version: 2.32.5
alwaysApply: false
---

## ⚠️ 项目覆盖：课表管家云函数约定

- 云环境 ID：`cloud1-d5gbyvu3l05e11828`，包管理用 **npm**（根目录）
- 现有函数：`auth` | `schedule` | `course` | `student` | `family` | `share` | `notify` | `reminder` | `ai`
- 路由模式：所有函数用 `exports.main(event, context)`，`event` 含 `{ action, payload }`，新功能加 action，不加新函数
- **向后兼容（强制）**：云函数一部署即作用于整个云环境，旧版/预览/体验版小程序仍可能调用已有 action。禁止破坏已有 action 的入参、响应形状与语义；新能力优先新增 action；`shared/` 改动须确认所有调用方。详见下文「向后兼容」。
- 响应格式：`{ code: 0, message, data }` 成功 / `{ code: 4xxxx|50000, message, data: null }` 失败
- OPENID：只从 `cloud.getWXContext().OPENID` 取，禁止从 `event.payload` 传
- 前端调用：只走 `src/api/cloud.ts` 的 `cloud.call<T>()`，不直接调 `Taro.cloud.callFunction`
- 部署：根目录 `npm run deploy` / `npm run deploy:<name>`，不要用 `tcb deploy` 或 HTTP Function

## 本仓库规则包

本项目只收录课表管家会用到的 CloudBase 规范（官方 skills **2.32.5**）。先读本文件顶部覆盖段和 `AGENTS.md`。

| 场景 | 阅读 |
|------|------|
| 小程序 / Taro / 预览上传 | `../miniprogram-development/rule.md` |
| 云函数 | `../cloud-functions/rule.md` |
| 微信鉴权 / OPENID | `../auth-wechat/rule.md` |
| 文档数据库 | `../no-sql-wx-mp-sdk/rule.md` |
| 云函数调 AI | `../ai-model-cloudbase/rule.md` |
| 全新视觉改版 | `../ui-design/rule.md` |

不要套用 Web SDK、HTTP Function、CloudRun、MySQL、微信支付。缺失的 sibling skill 不要远程拉取。

## 向后兼容（强制）

云环境与小程序**分开发布**：后端部署后，所有连该 env 的客户端立刻使用新代码，无法假设「用户已更新到最新前端」。

| 允许 | 禁止 |
|------|------|
| 新增 `action`、新增可选 `payload` 字段、新增响应字段 | 删除/重命名已有 `action` |
| 内部重构，对外 `code/message/data` 与旧版一致 | 改变已有 action 的 `data` 结构或字段含义 |
| 读写字段时兼容旧文档（默认值、归一化） | 要求旧客户端必须传新必填参数 |
| 新前端专用新 action，旧 action 长期保留 | 仅部署云函数而不保留旧 action 的替代路径 |

改 `shared/` 时按同样标准检查：每个引用该模块的云函数及对应 `taro-app/src/api/*.api.ts` 中的 action 是否仍可用。

部署前在改动说明中列出：影响的函数名、action 列表、旧客户端是否仍安全。

## 开发与检查

- 先阅读现有 action 和 `shared/` 实现，再增加业务逻辑；数据库字段使用 snake_case。
- 集合创建与数据写入是独立操作，不要假定 `collection().add()` 会创建集合。
- 不返回完整 event、context、环境变量或凭据；日志只记录诊断所需字段。
- 运行时、超时和环境变量以项目部署配置为准；更新环境变量时保留无关配置。
- 本地开发和检查不等于部署授权，部署须有用户请求；不得提交密钥或擅自删除云资源。
- 涉及 `cloudfunctions/` 或 `shared/` 的改动须满足上文「向后兼容」；部署前对照 [checklist.md](checklist.md) 第 7 条。

## 参考

- [检查清单](checklist.md)
- [Event Function](references/event-functions.md)
- [日志、环境变量和定时器](references/operations-and-config.md)
