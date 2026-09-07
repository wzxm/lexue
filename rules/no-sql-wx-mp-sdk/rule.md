---
name: cloudbase-document-database-in-wechat-miniprogram
description: Use CloudBase document database WeChat MiniProgram SDK to query, create, update, and delete data. Supports complex queries, pagination, aggregation, and geolocation queries.
version: 2.32.5
alwaysApply: false
---

## ⚠️ 项目覆盖：课表管家前端不直接访问数据库

前端永远不调用 `wx.cloud.database()`，所有数据操作走云函数。

数据流：`cloud.call('funcName', { action, payload })` → 云函数 → `shared/db.js` → 返回结果

- 写新功能：在对应云函数加 action，再写 `*.api.ts` 函数
- 本规范仅在写**云函数侧** DB 代码时参考（`wx-server-sdk` / `shared/db.js`）

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

## Activation Contract

### Use this first when

- A WeChat Mini Program must access CloudBase document database through `wx.cloud.database()`.
- The request mentions Mini Program collection CRUD, pagination, aggregation, or geolocation queries.

### Read before writing code if

- The task is Mini Program database work but you still need to separate it from Web SDK, cloud functions, or SQL tasks.
- The request depends on built-in user identity, `_openid`, or Mini Program-side permissions.

### Then also read

- Mini Program project rules and CloudBase integration -> `../miniprogram-development/rule.md`
- Mini Program auth and identity flow -> `../auth-wechat/rule.md`

### Do NOT use for

- Browser/Web code using `@cloudbase/js-sdk`.
- Server-side or cloud-function database access.
- MySQL / relational database work.

### Common mistakes / gotchas

- Copying Web SDK code into Mini Program pages.
- Manually writing `_openid` during create or update operations.
- Assuming built-in Mini Program identity means security rules can be ignored.
- Mixing collection CRUD and backend-wide admin workflows in the same client path.

### Minimal checklist

- Confirm the caller is a Mini Program page/component or Mini Program-side logic.
- Initialize `wx.cloud` correctly before database calls.
- Verify whether the collection rules rely on `auth.openid` / `_openid`.
- Read the specific companion reference file for the operation you need.

## Overview

This skill covers **Mini Program-side document database access** through `wx.cloud.database()`.

Use it for:

- collection CRUD in Mini Program pages
- query composition and pagination
- aggregation
- geolocation queries

Mini Program CloudBase access comes with built-in identity, but database operations are still constrained by collection permissions and security rules.

## Canonical initialization

```javascript
const db = wx.cloud.database();
const _ = db.command;
```

To target a specific environment:

```javascript
const db = wx.cloud.database({
  env: "test"
});
```

Important notes:

- Users are authenticated through the Mini Program CloudBase context.
- In cloud functions, caller identity is available through `wxContext.OPENID`.
- In client-side collection rules, ownership checks usually use `auth.openid` / `doc._openid`.

## Quick routing

- CRUD -> `./crud-operations.md`
- Complex queries -> `./complex-queries.md`
- Pagination -> `./pagination.md`
- Aggregation -> `./aggregation.md`
- Geolocation -> `./geolocation.md`
- Security rules -> `./security-rules.md`

## Working rules for a coding agent

1. **Keep Mini Program code Mini Program-native**
   - Use `wx.cloud.database()`.
   - Do not substitute browser SDK initialization patterns.

2. **Respect ownership fields**
   - `_openid` is system-managed for SDK writes.
   - Never set or override `_openid` manually in `.add()`, `.set()`, or `.update()` payloads.

3. **Remember that security rules validate requests**
   - If a rule requires ownership conditions, the query shape must match that rule model.
   - Permission errors usually mean the rule/query relationship is wrong, not only that the user is logged out.

4. **Route admin-style operations to backend flows**
   - If the task needs privileged global access, use backend tools or functions instead of exposing that path directly in Mini Program client code.

## Quick examples

### Basic collection access

```javascript
const todos = db.collection("todos");
const result = await todos.where({ completed: false }).get();
```

### Document reference

```javascript
const todo = db.collection("todos").doc("todo-id");
const result = await todo.get();
```

## Best practices

1. Create clear collection naming conventions.
2. Use typed wrappers or model helpers in app code where possible.
3. Design rules around real ownership and sharing patterns.
4. Use pagination instead of large unbounded reads.
5. Keep admin/operations logic in backend code, not Mini Program direct access.
