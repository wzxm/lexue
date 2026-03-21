import { authStore } from '../../store/auth.store';
import { ROUTES } from '../../constants/routes';

// 启动页：检查登录态跳转
Page({
  onLoad() {
    if (authStore.isLoggedIn) {
      wx.reLaunch({ url: ROUTES.SCHEDULE });
    } else {
      wx.reLaunch({ url: ROUTES.LOGIN });
    }
  },
});
