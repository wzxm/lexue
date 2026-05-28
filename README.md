# 智鑫课表

面向学生家庭的微信小程序，支持多学生课表管理、家庭成员共享、上课提醒推送。

## 技术栈

- **前端**：Taro 4.x + React + TypeScript + Zustand + Sass（.scss）
- **后端**：微信云开发（云函数 + 云数据库）
- **云环境 ID**：`test-d7gxuxk5a8418c629`

## 仓库结构

```
/
├── taro-app/           # 小程序前端
│   ├── src/
│   │   ├── api/        # 云函数调用封装
│   │   ├── pages/      # 页面（11个）
│   │   ├── components/ # 公共组件
│   │   ├── store/      # Zustand 状态管理
│   │   ├── types/      # TypeScript 类型定义
│   │   └── utils/      # 工具函数
│   └── dist/           # 编译产物（用微信开发者工具打开此目录）
├── cloudfunctions/     # 云函数（8个业务函数 + init-db）
├── shared/             # 云函数公共模块（db/auth/errors/logger/validator）
└── schema/             # 数据库集合字段 & 索引说明
```

## 开发

### 前提

- 微信开发者工具（用于调试小程序）
- Node.js 18+，pnpm

### 前端开发

```bash
cd taro-app
pnpm install

pnpm dev:weapp    # 监听构建，产物输出到 dist/
pnpm build:weapp  # 生产构建
```

用微信开发者工具打开 `taro-app/dist/` 目录进行调试。

### 云函数部署

```bash
# 根目录执行，需要先在微信开发者工具完成登录授权
npm run deploy              # 部署全部云函数
npm run deploy:auth         # 部署单个云函数（auth/schedule/course/student/family/notify/reminder/share）
npm run deploy:init-db      # 部署一次性初始化函数（首次环境初始化时再执行）
```


### AI 课表识别 OCR 加速

`ai` 云函数会优先调用腾讯云 OCR 把课表图片转成文本块，再把 OCR 文本交给 MiMo 生成待导入课程；当 OCR 未配置、失败或识别文本太少时，会自动回退到原来的图片 AI 识别。

开通腾讯云 OCR：

1. 登录 [腾讯云 OCR 控制台](https://console.cloud.tencent.com/ocr)。
2. 按产品页引导开通文字识别服务；如果要试用 2026-05 新增的通用文字识别 Agent，可在对应产品能力页开通/确认额度。
3. 到 [访问密钥](https://console.cloud.tencent.com/cam/capi) 创建或复用 `SecretId` / `SecretKey`，建议使用只授权 OCR 调用权限的子账号密钥。
4. 确认账号余额、免费额度或计费方式正常，否则云函数会自动回退到图片 AI 识别。

`ai` 云函数需要给足运行时间，仓库里的 `cloudfunctions/ai/config.json` 已配置 `"timeout": 60`。如果线上仍看到 `Invoking task timed out after 3 seconds`，说明云端函数超时时间还停留在默认 3 秒，需要重新部署 `ai` 云函数，或在云开发控制台把 `ai` 函数超时时间手动改到 60 秒。

需要在云开发控制台给 `ai` 云函数配置环境变量：

| 变量 | 必填 | 说明 |
|------|------|------|
| `TENCENT_SECRET_ID` | 是 | 腾讯云访问密钥 SecretId，需有 OCR 调用权限 |
| `TENCENT_SECRET_KEY` | 是 | 腾讯云访问密钥 SecretKey |
| `TENCENT_OCR_REGION` | 否 | OCR 地域，默认 `ap-guangzhou` |
| `TENCENT_OCR_ACTION` | 否 | OCR 接口，默认 `GeneralBasicOCR`；识别质量不足可改为 `GeneralAccurateOCR`，要试用通用文字识别 Agent 可改为 `RecognizeAgent` |
| `TENCENT_OCR_TIMEOUT_MS` | 否 | OCR 超时时间，默认 `12000` |
| `TENCENT_OCR_LANGUAGE` | 否 | OCR 语言，默认 `zh` |

开通腾讯云 OCR 并配置环境变量后，重新部署 `ai` 云函数：

```bash
npm run deploy:ai
```

### 发布上传

```bash
cd taro-app
pnpm ci:preview   # 生成预览二维码
pnpm ci:upload    # 上传到微信后台
```

## 功能模块

| 页面 | 功能 |
|------|------|
| 课表（首页） | 按周展示课程网格，支持单双周切换 |
| 学生管理 | 添加/编辑学生信息 |
| 课表管理 | 创建课表、设置默认课表 |
| 课程编辑 | 添加/编辑单个课程，设置颜色、单双周 |
| 家庭共享 | 生成分享口令，管理家庭成员权限（view/edit） |
| 提醒设置 | 配置上课前提醒推送时间 |
| 工具 | 作业、考试、备忘等百宝箱功能 |

## 数据库

集合说明见 [`schema/collections.md`](schema/collections.md)，索引配置见 [`schema/indexes.md`](schema/indexes.md)。

首次环境初始化时，先执行 `npm run deploy:init-db` 上传 `init-db`，再在云开发控制台手动触发该函数初始化集合。

## 权限模型

课表权限分三级：`owner`（创建者）> `edit`（可编辑的共享成员）> `view`（只读共享成员）。所有鉴权在云函数中基于 `WXContext.OPENID` 执行，前端传入的 openid 不可信。
