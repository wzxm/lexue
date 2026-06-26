---
name: ai-model-nodejs
description: 智鑫课表 Node.js 云函数 AI 调用规范 - CloudBase AI SDK (hy3-preview) + 腾讯云 OCR
version: 2.18.0
alwaysApply: false
---

## 适用场景

云函数中调用 AI 模型进行课表图片识别、文本结构化解析。

---

## 架构概览

```
图片 → [CloudBase AI 多模态直调] → [腾讯云 OCR + CloudBase AI 文本解析] → [OCR 启发式兜底]
```

主文件：`cloudfunctions/ai/index.js`

## CloudBase AI SDK 调用

```js
const model = tcbApp.ai().createModel('cloudbase');
const result = await model.generateText({
  model: 'hy3-preview',
  messages: [{ role: 'user', content: 'prompt' }],
  temperature: 0.1,
}, { timeout: 50000 });

const text = result?.text || result?.choices?.[0]?.message?.content || '';
```

### 多模态请求

```js
await model.generateText({
  model: 'hy3-preview',
  messages: [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,xxx' } },
      { type: 'text', text: 'prompt' },
    ],
  }],
}, { timeout: 50000 });
```

⚠️ `image_url` 必须是嵌套对象 `{ url: "data:..." }`。

---

## 环境变量

```
CLOUDBASE_AI_TIMEOUT_MS=50000      # 超时（默认 50s，范围 5-120s）
CLOUDBASE_VISION_ENABLED=false     # true 启用多模态直调
TENCENT_SECRET_ID=xxx              # 腾讯云 OCR
TENCENT_SECRET_KEY=xxx             # 腾讯云 OCR
```

---

## 三级容错策略

1. **CloudBase AI 多模态直调**（`CLOUDBASE_VISION_ENABLED=true` 时）
2. **腾讯云 OCR + CloudBase AI 文本解析**（主路径）
3. **OCR 启发式坐标解析兜底**（纯本地算法）

---

## 注意事项

- 不使用 DeepSeek 官方 API，无需 API Key
- 图片大小限制 8MB，建议前端压缩后上传
- 超时默认 50s，可通过 `CLOUDBASE_AI_TIMEOUT_MS` 调整（范围 5-120s）
