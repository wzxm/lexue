import { shareApi } from '../../api/share.api';

Page({
  data: {
    code: '',
    expireAt: '',
    loading: true,
    scheduleId: '',
  },

  async onLoad(options: { scheduleId?: string }) {
    const scheduleId = options.scheduleId || '';
    this.setData({ scheduleId });
    await this.generateCode(scheduleId);
  },

  async generateCode(scheduleId?: string) {
    this.setData({ loading: true });
    try {
      const res = await shareApi.generateCode({ scheduleId: scheduleId || this.data.scheduleId });
      const expire = new Date(res.expiresAt);
      const expireStr = `${expire.getMonth() + 1}月${expire.getDate()}日`;
      this.setData({ code: res.code, expireAt: expireStr });
    } catch (e) {
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  copyCode() {
    wx.setClipboardData({
      data: this.data.code,
      success: () => {
        wx.showToast({ title: '已复制口令', icon: 'success' });
      }
    });
  },

  async regenerateCode() {
    await this.generateCode();
    wx.showToast({ title: '口令已更新', icon: 'success' });
  }
});
