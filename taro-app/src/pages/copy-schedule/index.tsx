import { View, Text, Input, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { verifyInviteCode, copyByInviteCode } from '../../api/share.api';
import { ROUTES } from '../../constants/routes';
import { useScheduleStore } from '../../store/schedule.store';

import './index.scss';

export default function CopySchedulePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const addSchedule = useScheduleStore(s => s.addSchedule);

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

      const confirmContent = '口令校验通过，确认复制课表？\n\n复制课表以下内容：\n- 所在学期所有课程信息\n- 课程名称、时间、周次安排\n（老师姓名和联系方式不会被复制）';

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

      Taro.hideLoading();

      Taro.showModal({
        title: '复制成功',
        content: '复制成功，您可按自身需求调整课表：\n- 修改或添加课程\n- 课表所属学生纠正\n- 调整课节和开启通知',
        confirmColor: '#3b82f6',
        confirmText: '返回课表页',
        showCancel: false,
        success: (res) => {
          if (res.confirm) {
            Taro.switchTab({ url: ROUTES.SCHEDULE });
          }
        },
      });
    } catch (err: any) {
      Taro.hideLoading();
      Taro.showToast({ title: err.message || '复制失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="copy-schedule-page">
      <View className="copy-schedule-header">
        <Text className="title">复制好友课表</Text>
        <Text className="subtitle">
          输入好友分享的口令，即可一键复制课表内容
        </Text>
      </View>

      <View className="copy-schedule-card">
        {/* <Text className="input-label">分享口令</Text> */}
        <View className={`code-input-wrap ${isFocused ? 'focused' : ''}`}>
          <Input
            className="code-input"
            placeholder="粘贴或输入口令"
            placeholderStyle="color: #8e8e93; font-weight: normal;"
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

      <View className="copy-schedule-tips">
        <Text className="tip-icon">🛡️</Text>
        <Text className="tip-text">
          安全提示：老师电话等敏感信息不会被复制。建议复制后及时核对课程时间。
        </Text>
      </View>
    </View>
  );
}
