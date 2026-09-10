import { View, Text, Input, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { verifyInviteCode, copyByInviteCode } from '../../api/share.api';
import { ROUTES } from '../../constants/routes';
import { useScheduleStore } from '../../store/schedule.store';
import { tabState } from '../../utils/tabState';

import './index.scss';

export default function CopySchedulePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const addSchedule = useScheduleStore(s => s.addSchedule);
  const setCurrentSchedule = useScheduleStore(s => s.setCurrentSchedule);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '复制课表' });
  }, []);

  const handleCopy = async () => {
    if (!code.trim()) {
      Taro.showToast({ title: '请输入口令', icon: 'none' });
      return;
    }

    setLoading(true);
    Taro.showLoading({ title: '正在校验', mask: true });

    try {
      await verifyInviteCode(code.trim());
      Taro.hideLoading();

      const confirmContent = '即将复制课表的内容，复制后你可按需修改课表信息和课程内容。\n（⚠️注意：出于隐私保护，老师的信息不会被复制，如有需要可自行添加）';

      Taro.showModal({
        title: '口令匹配成功',
        content: confirmContent,
        confirmColor: '#3b82f6',
        confirmText: '立即复制',
        cancelText: '关闭',
        success: async (res) => {
          if (res.confirm) {
            await doCopyCode();
          } else {
            setLoading(false);
          }
        }
      });
    } catch (err: any) {
      Taro.hideLoading();
      setLoading(false);
      const msg = err.message || '';
      if (msg.includes('自己的口令')) {
        Taro.showModal({
          title: '这是你自己的口令',
          content: '该口令是你生成的，分享给好友使用吧，自己无需复制。',
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#3b82f6',
        });
      } else {
        Taro.showModal({
          title: '复制失败',
          content: '复制失败，请检查口令后再试。（若连续多次失败，系统将限制今日使用。）',
          showCancel: false,
          confirmColor: '#3b82f6',
          confirmText: '确定',
        });
      }
    }
  };

  const doCopyCode = async () => {
    Taro.showLoading({ title: '复制中', mask: true });
    try {
      const newSchedule = await copyByInviteCode(code.trim());

      addSchedule(newSchedule);
      setCurrentSchedule(newSchedule);

      Taro.hideLoading();

      Taro.showToast({ title: '复制成功', icon: 'success', duration: 1500 });
      setTimeout(() => {
        tabState.setFamilyShareBanner(true);
        Taro.switchTab({ url: ROUTES.SCHEDULE });
      }, 1500);
    } catch (err: any) {
      Taro.hideLoading();
      Taro.showToast({ title: err.message || '复制失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="copy-schedule-page">
      <View className="copy-schedule-content">
        <View className="copy-schedule-hero">
          <View className="hero-icon">
            <View className="hero-icon-inner" />
          </View>
          <Text className="hero-title">复制同学课表</Text>
          <Text className="hero-desc">
            输入同学分享的口令，即可一键复制课表内容
          </Text>
        </View>

        <View className="input-card">
          <View className={`code-input-wrap ${isFocused ? 'focused' : ''}`}>
            <Input
              className="code-input"
              placeholder="粘贴或输入口令"
              placeholderStyle="color: #8e8e93; font-weight: normal; letter-spacing: 0;"
              value={code}
              onInput={(e) => setCode(e.detail.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
          </View>

          <Button
            className={`copy-btn ${!code.trim() || loading ? 'btn-disabled' : ''}`}
            onClick={handleCopy}
            disabled={loading || !code.trim()}
          >
            {loading ? '校验中...' : '一键复制'}
          </Button>
        </View>

        <View className="safety-notice">
          <View className="safety-icon" />
          <Text className="safety-text">
            安全提示：老师电话等敏感信息不会被复制。建议复制后及时核对课程时间。
          </Text>
        </View>
      </View>
    </View>
  );
}
