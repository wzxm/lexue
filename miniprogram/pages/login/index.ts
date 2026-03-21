import { login } from '../../api/auth.api';
import { authStore } from '../../store/auth.store';
import { ROUTES } from '../../constants/routes';

Page({
  data: {
    loading: false,
  },

  async onGetUserInfo(e: WechatMiniprogram.GetUserInfoSuccessCallbackResult & { detail: { errMsg: string } }) {
    if ((e as any).detail.errMsg !== 'getUserInfo:ok') {
      wx.showToast({ title: '需要授权才能使用', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const userInfo = await login();
      authStore.setUserInfo(userInfo);
      wx.reLaunch({ url: ROUTES.SCHEDULE });
    } catch (err) {
      console.error('[login] error', err);
      wx.showToast({ title: (err as Error).message || '登录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
