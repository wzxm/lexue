---
name: ai-model-cloudbase
description: 课表管家 AI 模型调用规范 - CloudBase AI SDK 调用 hy3-preview
alwaysApply: false
---

## ⚠️ 项目覆盖：智鑫课表 AI 方案

本项目在云函数里用 `@cloudbase/node-sdk` 调 hy3-preview，不直接调 DeepSeek 官方 API，也不走小程序端 `wx.cloud.extend.AI`。

主文件：`cloudfunctions/ai/index.js`

```
图片 → [CloudBase AI 多模态直调] → [腾讯云 OCR + CloudBase AI 文本解析] → [OCR 启发式兜底]
```

## 本仓库规则包

本项目只收录智鑫课表会用到的 CloudBase 规范（官方 skills **2.32.5**）。先读本文件顶部覆盖段和 `AGENTS.md`。

| 场景 | 阅读 |
|------|------|
| 小程序 / Taro / 预览上传 | `../miniprogram-development/rule.md` |
| 云函数 | `../cloud-functions/rule.md` |
| 微信鉴权 / OPENID | `../auth-wechat/rule.md` |
| 文档数据库 | `../no-sql-wx-mp-sdk/rule.md` |
| 云函数调 AI | `../ai-model-cloudbase/rule.md` |
| 全新视觉改版 | `../ui-design/rule.md` |

不要套用 Web SDK、HTTP Function、CloudRun、MySQL、微信支付。缺失的 sibling skill 不要远程拉取。

## `createModel` 只能传 GroupName

官方 2.32 起，`ai.createModel(...)` **不是**厂商名或模型 ID，只允许：

| 合法参数 | 本项目 |
|----------|--------|
| `"cloudbase"` | **使用这个**（TokenHub 托管组） |
| `"hunyuan-exp"` | 不用 |
| `"custom-<name>"` | 不用 |

具体模型写在 `generateText` / `streamText` 的 `model` 字段。本项目固定 `hy3-preview`，不要改成 `deepseek` / `hunyuan` 等厂商名。

```js
const model = tcbApp.ai().createModel('cloudbase'); // GroupName
await model.generateText({
  model: 'hy3-preview',                             // 模型 ID
  messages: [{ role: 'user', content: 'prompt' }],
});
```

## SDK 调用方式

```js
const tcb = require('@cloudbase/node-sdk');
const tcbApp = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });

const model = tcbApp.ai().createModel('cloudbase');
const result = await model.generateText({
  model: 'hy3-preview',
  messages: [{ role: 'user', content: 'prompt' }],
  temperature: 0.1,
}, { timeout: 50000 });

const text = result?.text || result?.choices?.[0]?.message?.content || '';
```

## 多模态（图片输入）

```js
await model.generateText({
  model: 'hy3-preview',
  messages: [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,xxx' } },
      { type: 'text', text: 'prompt内容' },
    ],
  }],
}, { timeout: 50000 });
```

⚠️ `image_url` 必须是嵌套对象 `{ url: "data:..." }`，不能直接传字符串。

## 环境变量

```
CLOUDBASE_AI_TIMEOUT_MS=50000      # 超时（默认 50s，范围 5-120s）
CLOUDBASE_VISION_ENABLED=false     # true 启用多模态直调路径
TENCENT_SECRET_ID=xxx              # 腾讯云 OCR
TENCENT_SECRET_KEY=xxx             # 腾讯云 OCR
```

## 三级容错流程

1. **CloudBase AI 多模态直调**（`CLOUDBASE_VISION_ENABLED=true` 时）→ 图片直接发给模型
2. **腾讯云 OCR + CloudBase AI 文本解析**（主路径）→ OCR 提取文字再让 AI 结构化
3. **OCR 启发式坐标解析兜底** → 纯本地算法

## 注意事项

- 不使用 DeepSeek 官方 API，无需 API Key
- 图片大小限制 8MB，建议前端压缩后上传
- 超时默认 50s，可通过 `CLOUDBASE_AI_TIMEOUT_MS` 调整（范围 5-120s）
- 不要把 `createModel` 的参数写成厂商名或模型 ID
