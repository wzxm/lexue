import * as familyApi from '../../api/family.api';
import * as shareApi from '../../api/share.api';
import type { MemberInfo } from '../../api/family.api';
import { scheduleStore } from '../../store/schedule.store';

Page({
  data: {
    members: [] as MemberInfo[],
    loading: true,
    scheduleId: '',
  },

  async onLoad() {
    // 从当前默认课表获取 scheduleId
    const schedule = scheduleStore.currentSchedule;
    const scheduleId = schedule?.id || '';
    this.setData({ scheduleId });
    await this.loadMembers(scheduleId);
  },

  async loadMembers(scheduleId: string) {
    if (!scheduleId) return;
    this.setData({ loading: true });
    try {
      const members = await familyApi.listMembers(scheduleId);
      this.setData({ members: members || [] });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleInvite() {
    const { scheduleId } = this.data;
    if (!scheduleId) return wx.showToast({ title: '请先选择课表', icon: 'none' });
    wx.showLoading({ title: '生成邀请中...' });
    try {
      const res = await shareApi.generateInvite(scheduleId);
      wx.hideLoading();
      wx.setClipboardData({
        data: res.inviteUrl,
        success: () => {
          wx.showToast({ title: '邀请链接已复制，发给家人吧', icon: 'none', duration: 2500 });
        }
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    }
  },

  handleRemoveMember(e: any) {
    const { openid, nickname } = e.currentTarget.dataset;
    const { scheduleId } = this.data;
    wx.showModal({
      title: '移除成员',
      content: `确定移除「${nickname}」吗？`,
      confirmColor: '#FF5252',
      success: async (res) => {
        if (res.confirm) {
          try {
            await familyApi.removeMember(scheduleId, openid);
            wx.showToast({ title: '已移除' });
            await this.loadMembers(scheduleId);
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  handleLeave() {
    const { scheduleId } = this.data;
    wx.showModal({
      title: '退出共享',
      content: '确定退出该课表的共享吗？',
      confirmColor: '#FF5252',
      success: async (res) => {
        if (res.confirm) {
          try {
            await familyApi.leave(scheduleId);
            wx.showToast({ title: '已退出' });
            wx.navigateBack();
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  }
});
