interface Tool {
  name: string;
  icon: string;
  available: boolean;
  bgColor?: string;
  iconColor?: string;
}

Page({
  data: {
    toolList: [
      { name: '作业提醒', icon: '\ue601', available: false, bgColor: '#FFF3E0', iconColor: '#FF9800' },
      { name: '考试日历', icon: '\ue602', available: false, bgColor: '#E3F2FD', iconColor: '#2196F3' },
      { name: '假期日历', icon: '\ue603', available: false, bgColor: '#F3E5F5', iconColor: '#9C27B0' },
      { name: '成绩记录', icon: '\ue604', available: false, bgColor: '#E8F5E9', iconColor: '#4CAF50' },
      { name: '课表模板', icon: '\ue605', available: false, bgColor: '#FFEBEE', iconColor: '#E91E63' },
      { name: '家校通知', icon: '\ue606', available: false, bgColor: '#E1F5FE', iconColor: '#03A9F4' },
    ] as Tool[],
  },

  handleTool(e: any) {
    const tool = e.currentTarget.dataset.tool as Tool;
    if (!tool.available) {
      wx.showToast({ title: '即将上线，敬请期待', icon: 'none', duration: 2000 });
    }
  }
});
