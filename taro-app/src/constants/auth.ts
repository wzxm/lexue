export type LoginMode = 'wechat' | 'phone';

/**
 * 登录方式切换：
 * - wechat：现有微信一键登录（仅 openid，不强制手机号）
 * - phone：微信授权手机号快捷登录（需 getPhoneNumber 授权，写入 users.phone）
 */
export const LOGIN_MODE: LoginMode = 'phone';
