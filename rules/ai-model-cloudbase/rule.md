---
name: ai-model-cloudbase
description: 课表管家 AI 图片识别调用规范
alwaysApply: false
---

## 项目约定

`cloudfunctions/ai/index.js` 是 CloudBase Event Function，通过 OpenAI 兼容的 Chat Completions 接口调用视觉模型。默认使用 DeepSeek 官方接口，也支持 LiteLLM 网关。

DeepSeek 配置：

```text
AI_PROVIDER=deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=[REDACTED_SECRET]
DEEPSEEK_VISION_MODEL=<实际可用的视觉模型 ID>
```

`DEEPSEEK_VISION_MODEL` 必须支持 `image_url` 多模态输入；不要将纯文本模型用于课表图片识别。密钥不得提交到仓库或返回客户端。

LiteLLM 配置：`AI_PROVIDER=litellm`，并设置 `LITELLM_BASE_URL`、`LITELLM_API_KEY`、`LITELLM_VISION_MODEL`。
