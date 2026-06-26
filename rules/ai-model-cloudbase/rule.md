---
name: ai-model-cloudbase
description: 智鑫课表 AI 模型调用规范 - CloudBase AI SDK 调用 hy3-preview
alwaysApply: false
---

# 项目 AI 方案：CloudBase AI SDK

本项目通过腾讯云 CloudBase AI SDK 调用 hy3-preview，不直接调 DeepSeek 官方 API。

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
