import { View, Text, Input, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { verifyCode, acceptCode, ShareCodePreview } from '../../api/share.api';
import { ROUTES } from '../../constants/routes';
import { useScheduleStore } from '../../store/schedule.store';
import { getSchedule } from '../../api/schedule.api';
import './index.scss';

export default function CopySchedulePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const setCurrentSchedule = useScheduleStore(s => s.setCurrentSchedule);
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
      // 1. 先验证口令，获取预览信息
      const preview = await verifyCode(code.trim());
      Taro.hideLoading();

      // 2. 弹窗让用户确认
      Taro.showModal({
        title: '口令匹配成功',
        content: `查找到【${preview.studentName}，${preview.scheduleName}】，确认复制？`,
        confirmText: '立即复制',
        cancelText: '关闭',
        success: async (res) => {
          if (res.confirm) {
            await doCopyCode(preview);
          } else {
            setLoading(false);
          }
        }
      });
    } catch (err: any) {
      Taro.hideLoading();
      setLoading(false);
      Taro.showModal({
        title: '复制失败',
        content: err.message || '复制失败，请检查口令后再试。（若连续多次失败，系统将限制今日使用。）',
        showCancel: false,
        confirmText: '确定'
      });
    }
  };

  const doCopyCode = async (preview: ShareCodePreview) => {
    Taro.showLoading({ title: '复制中', mask: true });
    try {
      // 3. 接受口令，把当前用户加到 shared_with 列表中
      await acceptCode(code.trim());
      
      // 4. 获取被分享课表的完整信息
      const schedule = await getSchedule(preview.scheduleId);
      
      // 更新本地 store
      addSchedule(schedule);
      setCurrentSchedule(schedule);

      Taro.hideLoading();
      
      // 5. 提示复制成功
      Taro.showModal({
        title: '复制成功',
        content: '复制成功，您可按自身需求调整课表：\n- 修改或添加课程\n- 课表所属学生纠正\n- 调整课节和开启通知',
        confirmText: '查看课表',
        showCancel: false,
        success: (res) => {
          if (res.confirm) {
            Taro.switchTab({ url: ROUTES.SCHEDULE });
          }
        }
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
      <View className="content">
        <Text className="title">输入口令，复制好友的课表</Text>
        <View className="warning-text">⚠️老师电话等敏感信息不支持复制</View>
        
        <View className="input-wrap">
          <Input
            className="code-input"
            placeholder="请输入口令"
            placeholderClass="placeholder-text"
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
        </View>

        <Button 
          className={`submit-btn ${!code.trim() ? 'submit-btn--disabled' : ''}`}
          onClick={handleCopy}
          disabled={loading || !code.trim()}
        >
          一键复制
        </Button>
      </View>
    </View>
  );
}
