# 乐学课表

面向学生家庭的微信小程序，支持多学生课表管理、家庭成员共享、上课提醒推送。

## 技术栈

- **前端**：Taro 4.x + React + TypeScript + Zustand + Tailwind CSS（weapp-tailwindcss）
- **后端**：微信云开发（云函数 + 云数据库）
- **云环境 ID**：`cloud1-1g0kf2p8b07af20f`

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

首次部署需在云开发控制台触发 `init-db` 云函数初始化所有集合。

## 权限模型

课表权限分三级：`owner`（创建者）> `edit`（可编辑的共享成员）> `view`（只读共享成员）。所有鉴权在云函数中基于 `WXContext.OPENID` 执行，前端传入的 openid 不可信。
