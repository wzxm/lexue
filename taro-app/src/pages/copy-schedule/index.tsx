import { View, Text, Input, Button, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { verifyInviteCode, copyByInviteCode } from '../../api/share.api';
import { getSchedule } from '../../api/schedule.api';
import { listStudents } from '../../api/student.api';
import { ROUTES } from '../../constants/routes';
import { useScheduleStore } from '../../store/schedule.store';
import { tabState } from '../../utils/tabState';
import type { Student } from '../../types/index';

import './index.scss';

export default function CopySchedulePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [pendingStudents, setPendingStudents] = useState<Student[] | null>(null);
  const [studentPickerIndex, setStudentPickerIndex] = useState(0);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
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

      const confirmContent = '复制后可按需修改课表信息和课程内容。\n（⚠️注意：出于隐私保护，老师的信息不会被复制，如有需要可自行添加）';

      Taro.showModal({
        title: '口令匹配成功',
        content: confirmContent,
        confirmColor: '#3b82f6',
        confirmText: '立即复制',
        cancelText: '关闭',
        success: async (res) => {
          if (res.confirm) {
            await handleConfirmCopy();
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

  const dismissStudentPicker = () => {
    setPendingStudents(null);
    setLoading(false);
  };

  const handleModalClose = () => {
    setConfirmModalVisible(false);
    setLoading(false);
  };

  const handleModalCopy = () => {
    setConfirmModalVisible(false);
    void handleConfirmCopy();
  };

  // 确认复制：单学生直接归属；多学生弹滑动选择器；无学生交给云函数提示
  const handleConfirmCopy = async () => {
    try {
      const studentList = await listStudents();
      if (studentList.length > 1) {
        setPendingStudents(studentList);
        setStudentPickerIndex(0);
        setLoading(false);
        return;
      }
      await doCopyCode(studentList[0]?.id);
    } catch (err: any) {
      setLoading(false);
      Taro.showToast({ title: err?.message || '获取学生信息失败', icon: 'none' });
    }
  };

  const doCopyCode = async (studentId?: string) => {
    Taro.showLoading({ title: '复制中', mask: true });
    try {
      const newSchedule = await copyByInviteCode(code.trim(), studentId);

      addSchedule(newSchedule);

      Taro.hideLoading();

      // 拉取含课程列表的完整课表，确保回到课表页能直接看到复制的课程
      const full = await getSchedule(newSchedule.id);
      setCurrentSchedule(full);

      // 防御：线上 share 云函数若为旧版本，会忽略所选学生、落到默认学生
      if (studentId && full.student_id && full.student_id !== studentId) {
        Taro.showModal({
          title: '学生归属可能不正确',
          content: '当前线上 share 云函数是旧版本，未按所选学生归属。请重新部署 share 云函数（npm run deploy:share）后，删除本课表并重新复制。',
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#3b82f6',
        });
        setLoading(false);
        return;
      }

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

      {confirmModalVisible && (
        <View className='confirm-modal-mask' onClick={handleModalClose}>
          <View className='confirm-modal-card' onClick={(e) => e.stopPropagation()}>
            <Text className='confirm-modal-title'>口令匹配成功</Text>
            <View className='confirm-modal-body'>
              <Text className='confirm-modal-line'>复制后可按需修改课表信息和课程内容。</Text>
              <Text className='confirm-modal-line'>（⚠️注意：出于隐私保护，老师的信息不会被复制，如有需要可自行添加）</Text>
            </View>
            <View className='confirm-modal-actions'>
              <View className='confirm-modal-btn confirm-modal-btn--cancel' onClick={handleModalClose}>关闭</View>
              <View className='confirm-modal-btn confirm-modal-btn--confirm' onClick={handleModalCopy}>立即复制</View>
            </View>
          </View>
        </View>
      )}

      {pendingStudents && (
        <View className='student-picker-mask' onClick={() => dismissStudentPicker()}>
          <View className='student-picker-card' onClick={(e) => e.stopPropagation()}>
            <Text className='student-picker-title'>选择学生</Text>
            <Text className='student-picker-desc'>请选择复制的课表归属到哪个学生名下</Text>
            <Picker
              mode='selector'
              range={pendingStudents.map(s => s.name)}
              value={studentPickerIndex}
              onChange={(e) => setStudentPickerIndex(Number(e.detail.value))}
            >
              <View className='student-picker-value'>
                <Text className='student-picker-value-text'>{pendingStudents[studentPickerIndex]?.name || '请选择'}</Text>
                <Text className='student-picker-arrow'>›</Text>
              </View>
            </Picker>
            <View className='student-picker-actions'>
              <View className='student-picker-btn student-picker-btn--cancel' onClick={() => dismissStudentPicker()}>取消</View>
              <View
                className='student-picker-btn student-picker-btn--confirm'
                onClick={() => {
                  const target = pendingStudents[studentPickerIndex];
                  setPendingStudents(null);
                  if (target) void doCopyCode(target.id);
                }}
              >
                确认复制
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
