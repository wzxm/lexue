import { ROUTES } from '../../constants/routes';

interface MenuItem {
  label: string;
  route: string;
  icon: string;
}

interface PageData {
  menuItems: MenuItem[];
}

Page<PageData, Record<string, never>>({
  data: {
    menuItems: [
      { label: '学生管理', route: ROUTES.STUDENT_FORM, icon: '👤' },
      { label: '家人管理', route: ROUTES.FAMILY_MANAGE, icon: '👨‍👩‍👧' },
      { label: '通知提醒', route: ROUTES.NOTIFICATION_SETTINGS, icon: '🔔' },
      { label: '分享课表', route: ROUTES.SHARE_CODE, icon: '📤' },
    ],
  },

  onNavigate(e: WechatMiniprogram.TouchEvent) {
    const { route } = e.currentTarget.dataset as { route: string };
    wx.navigateTo({ url: route });
  },
});
