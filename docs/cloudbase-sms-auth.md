# CloudBase 托管手机号登录配置

项目使用 CloudBase 身份认证的短信验证码：**发码与验码由 CloudBase HTTP API 完成**，小程序只通过 `auth` 云函数调用；业务登录不建立 CloudBase Auth 会话，仍用 `OPENID` 绑定 `users`。

## 控制台设置

在环境 `cloud1-d5gbyvu3l05e11828` 中：

1. 身份认证 -> 登录方式 -> 开启「短信验证码登录」。短信登录地域必须为上海（`ap-shanghai`）。
2. 配置短信签名、模板、单号码频率和每日上限，并购买短信资源包（预付费环境首月有 100 条免费额度，具体以控制台为准）。
3. 小程序必须已关联该 CloudBase 环境。

## 云函数环境变量

在 **auth 云函数** 环境变量中配置（勿写入小程序或仓库）：

| 变量 | 说明 |
|------|------|
| `CLOUDBASE_PUBLISHABLE_KEY` | 云开发控制台 ApiKey 管理中的 Publishable Key |
| `CLOUDBASE_ENV_ID` | 可选，默认 `cloud1-d5gbyvu3l05e11828` |

## 代码约定

- 前端：`sendSmsCode` / `loginByPhone` 仅调用 `cloud.call('auth', …)`，不使用 `@cloudbase/js-sdk`。
- 云函数：`shared/sms.js` 请求 `POST /auth/v1/verification` 与 `POST /auth/v1/verification/verify`；`sms_codes` 只存 `verification_id`、过期时间与限流字段，**不存验证码明文或哈希**。
- 身份：云函数从 `wx-server-sdk` 的 `getWXContext().OPENID` 获取微信身份，验码成功后用手机号绑定业务用户。

## 发布检查

```bash
cd taro-app && pnpm install
pnpm build:weapp
cd .. && npm run deploy:auth
```

首次上线前请在测试环境实际验证：发送频率限制、错误验证码、过期验证码、首次手机号注册和已有手机号登录。
