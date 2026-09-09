# CloudBase 托管手机号登录配置

项目现使用 CloudBase 身份认证的短信验证码登录（`getVerification` + `signInWithSms`），不再由 `auth` 云函数发送或校验验证码。

## 控制台设置

在环境 `cloud1-d5gbyvu3l05e11828` 中：

1. 身份认证 -> 登录方式 -> 开启“短信验证码登录”。短信登录地域必须为上海（`ap-shanghai`）。
2. 配置短信签名、模板、单号码频率和每日上限，并购买短信资源包（预付费环境首月有 100 条免费额度，具体以控制台为准）。
3. 小程序必须已关联该 CloudBase 环境，并在微信公众平台配置合法业务域名（如控制台要求）。

## 代码约定

前端 SDK 初始化使用环境 ID 和 `ap-shanghai`，验证码流程只在当前页面会话中保存 `verificationInfo`；不要把它写入数据库或 URL。云函数仍从 `wx-server-sdk` 的 `getWXContext().OPENID` 获取微信身份，用手机号将 CloudBase 登录用户绑定到现有业务用户。

## 发布检查

```bash
cd taro-app && pnpm install
pnpm build:weapp
cd .. && npm run deploy:auth
```

首次上线前请在测试环境实际验证：发送频率限制、错误验证码、过期验证码、首次手机号注册和已有手机号登录。
