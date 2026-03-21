import * as notifyApi from '../../api/notify.api';
import type { UserSettings } from '../../types/index';

const MINUTE_OPTIONS = [5, 10, 15, 20, 25];

interface PageData {
  afterSchoolEnabled: boolean;
  afterSchoolMinutes: number;
  afterSchoolIndex: number;
  classEnabled: boolean;
  classMinutes: number;
  classIndex: number;
  minuteOptions: number[];
  loading: boolean;
}

Page<PageData, Record<string, never>>({
  data: {
    afterSchoolEnabled: true,
    afterSchoolMinutes: 15,
    afterSchoolIndex: 2,  // 默认15分钟，数组index=2
    classEnabled: true,
    classMinutes: 10,
    classIndex: 1,         // 默认10分钟，数组index=1
    minuteOptions: MINUTE_OPTIONS,
    loading: false,
  },

  async onLoad() {
    try {
      const settings = await notifyApi.getSettings();
      this.applySettings(settings);
    } catch (e) {
      // 首次使用，用默认值就行
    }
  },

  applySettings(settings: Partial<UserSettings>) {
    const afterSchoolMinutes = settings.afterSchoolReminderMinutes ?? 15;
    const classMinutes = settings.classReminderMinutes ?? 10;
    this.setData({
      afterSchoolEnabled: settings.afterSchoolReminderEnabled ?? true,
      afterSchoolMinutes,
      afterSchoolIndex: MINUTE_OPTIONS.indexOf(afterSchoolMinutes) !== -1
        ? MINUTE_OPTIONS.indexOf(afterSchoolMinutes) : 2,
      classEnabled: settings.classReminderEnabled ?? true,
      classMinutes,
      classIndex: MINUTE_OPTIONS.indexOf(classMinutes) !== -1
        ? MINUTE_OPTIONS.indexOf(classMinutes) : 1,
    });
  },

  onAfterSchoolToggle(e: WechatMiniprogram.SwitchChange) {
    this.setData({ afterSchoolEnabled: e.detail.value });
  },

  onClassToggle(e: WechatMiniprogram.SwitchChange) {
    this.setData({ classEnabled: e.detail.value });
  },

  onAfterSchoolPickerChange(e: WechatMiniprogram.PickerChange) {
    const index = Number(e.detail.value);
    this.setData({
      afterSchoolIndex: index,
      afterSchoolMinutes: MINUTE_OPTIONS[index],
    });
  },

  onClassPickerChange(e: WechatMiniprogram.PickerChange) {
    const index = Number(e.detail.value);
    this.setData({
      classIndex: index,
      classMinutes: MINUTE_OPTIONS[index],
    });
  },

  async onSave() {
    this.setData({ loading: true });
    try {
      await notifyApi.updateSettings({
        afterSchoolReminderEnabled: this.data.afterSchoolEnabled,
        afterSchoolReminderMinutes: this.data.afterSchoolMinutes,
        classReminderEnabled: this.data.classEnabled,
        classReminderMinutes: this.data.classMinutes,
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
