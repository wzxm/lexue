App<IAppOption>({
  globalData: {},

  onLaunch() {
    // 初始化云开发（必须最先执行，其他页面 onLoad 时云已就绪）
    if (!wx.cloud) {
      console.error('[app] 基础库不支持云开发，请升级微信');
      return;
    }

    wx.cloud.init({
      env: 'cloud1-1g0kf2p8b07af20f',
      traceUser: true,
    });

    console.log('[app] 云开发初始化完成');
  },
});
