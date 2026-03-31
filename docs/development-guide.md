# 乐学课表 - 开发指南

## 前提条件

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | 18+ | 运行 Taro CLI 和云函数 |
| pnpm | 最新版 | 前端依赖管理（**严禁用 npm/yarn 安装前端依赖**） |
| npm | 随 Node.js | 云函数部署脚本（根目录） |
| 微信开发者工具 | 最新版 | 调试小程序、云开发控制台 |
| 微信小程序账号 | - | AppID 和云开发环境访问权限 |

> **重要**：前端用 `pnpm`，根目录云函数脚本用 `npm`，**别混用**！

---

## 本地开发

### 1. 前端开发（taro-app/）

```bash
cd taro-app
pnpm install          # 安装依赖

pnpm dev:weapp        # 启动开发模式（--watch，监听文件变化）
```

产物输出到 `taro-app/dist/`，用**微信开发者工具**打开该目录进行调试。

### 2. 微信开发者工具配置

1. 打开微信开发者工具
2. 导入项目 → 选择 `taro-app/dist/` 目录
3. 填入 AppID（`wxXXXX...`）
4. 确保云开发环境 ID 为 `cloud1-1g0kf2p8b07af20f`

### 3. 云函数本地调试

云函数部署到云端后在微信开发者工具中调试：
- 在微信开发者工具的「云开发」→「云函数」中查看日志
- 可使用「本地调试」功能模拟云函数调用

---

## 生产构建

```bash
cd taro-app
pnpm build:weapp      # 生产构建，产物输出到 dist/
```

---

## 发布流程

### 生成预览码

```bash
cd taro-app
pnpm ci:preview       # 构建 + 生成预览二维码（用于测试）
```

### 上传到微信后台

```bash
cd taro-app
pnpm ci:upload        # 构建 + 上传到微信小程序后台

# 或一步完成
pnpm build:upload     # 等价于：pnpm build:weapp && upload.js
```

> 上传需要 `miniprogram-ci.config.js` 中配置正确的 AppID 和上传密钥（`private.wxXXX.key`）。

---

## 云函数部署

在**项目根目录**执行（需先完成微信开发者工具登录授权）：

```bash
npm run deploy              # 部署所有云函数

# 部署单个云函数
npm run deploy:auth
npm run deploy:schedule
npm run deploy:course
npm run deploy:student
npm run deploy:family
npm run deploy:notify
npm run deploy:reminder
npm run deploy:share
```

---

## 首次部署（新环境）

1. 在微信云开发控制台创建云环境，获取环境 ID
2. 更新代码中的云环境 ID（`taro-app/src/app.ts` 和所有 `cloudfunctions/*/config.json`）
3. 在云开发控制台**手动创建数据库集合**（参考 `schema/collections.md`）
4. 在云开发控制台**手动创建索引**（参考 `schema/indexes.md`）
5. 触发 `init-db` 云函数初始化基础数据
6. 部署所有云函数：`npm run deploy`
7. 构建前端并上传：`cd taro-app && pnpm build:upload`

---

## 数据流

```
用户操作（页面）
    ↓
useXxxStore（Zustand）
    ↓
xxx.api.ts（API 层）
    ↓
cloud.call<T>(funcName, { action, payload })（cloud.ts）
    ↓
Taro.cloud.callFunction → 微信云函数
    ↓
cloudfunctions/xxx/index.js（按 action 路由）
    ↓
shared/*.js（db/auth/errors 工具）
    ↓
微信云数据库
```

---

## 新增功能开发流程

### 新增云函数 action

1. 在对应云函数 `index.js` 的 `switch(action)` 中添加新 case
2. 实现处理函数，使用 `shared/db.js`、`shared/auth.js` 工具
3. 在 `taro-app/src/api/xxx.api.ts` 中新增调用方法
4. 更新相关 Store 或直接在页面调用
5. 重新部署云函数：`npm run deploy:xxx`

### 新增页面

1. 在 `taro-app/src/pages/` 下创建新目录，包含 `index.tsx`、`index.config.ts`（可选 `index.scss`）
2. 在 `taro-app/src/app.config.ts` 的 `pages` 数组中注册页面路径
3. 在 `taro-app/src/constants/routes.ts` 中添加路由常量
4. 通过 `Taro.navigateTo({ url: Routes.XXX })` 跳转

---

## 质量检查

```bash
cd taro-app
pnpm ci:check         # 运行代码质量检查
```

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 云函数调用失败（code: 50000） | 查看云开发控制台云函数日志，确认环境 ID 正确 |
| 上传时提示密钥错误 | 检查根目录 `private.wxXXX.key` 文件是否存在 |
| 本地修改云函数后不生效 | 重新部署对应云函数 `npm run deploy:xxx` |
| 数据库写入失败（权限错误） | 确认云函数中使用 `WXContext.OPENID`，不从 payload 取 openid |
