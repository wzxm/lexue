export default defineAppConfig({
  pages: [
    'pages/schedule/index',
    'pages/login/index',
    'pages/index/index',
    'pages/schedule-form/index',
    'pages/course-form/index',
    'pages/student-form/index',
    'pages/settings/index',
    'pages/notification-settings/index',
    'pages/family-manage/index',
    'pages/share-code/index',
    'pages/tools/index',
  ],
  tabBar: {
    color: '#999999',
    selectedColor: '#00C853',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/schedule/index',
        text: '课表',
        iconPath: 'assets/tabbar/schedule.png',
        selectedIconPath: 'assets/tabbar/schedule-active.png',
      },
      {
        pagePath: 'pages/tools/index',
        text: '百宝箱',
        iconPath: 'assets/tabbar/tools.png',
        selectedIconPath: 'assets/tabbar/tools-active.png',
      },
      {
        pagePath: 'pages/settings/index',
        text: '设置',
        iconPath: 'assets/tabbar/settings.png',
        selectedIconPath: 'assets/tabbar/settings-active.png',
      },
    ],
  },
  window: {
    backgroundColor: '#F5F5F5',
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTitleText: '乐学课表',
    navigationBarTextStyle: 'black',
  },
  cloud: true,
})
