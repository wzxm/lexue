import { View, Text, Input, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { verifyInviteCode, copyByInviteCode } from '../../api/share.api';
import { getSchedule } from '../../api/schedule.api';
import { listStudents } from '../../api/student.api';
import { useScheduleStore } from '../../store/schedule.store';
import { useStudentStore } from '../../store/student.store';
import { goScheduleWithFamilyInvite } from '../../utils/goScheduleWithFamilyInvite';
import type { Student } from '../../types/index';

import './index.scss';

function ownStudentsOf(list: Student[]) {
  return list.filter(s => !s.isShared);
}

export default function CopySchedulePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [pendingStudents, setPendingStudents] = useState<Student[] | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const addSchedule = useScheduleStore(s => s.addSchedule);
  const setCurrentSchedule = useScheduleStore(s => s.setCurrentSchedule);
  const setCurrentStudent = useStudentStore(s => s.setCurrentStudent);

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
    setSelectedStudentId('');
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

  // 只按「我名下」的学生归属：1 个直接复制，多个必须点选后再复制
  const handleConfirmCopy = async () => {
    try {
      const ownStudents = ownStudentsOf(await listStudents());
      if (ownStudents.length > 1) {
        setPendingStudents(ownStudents);
        setSelectedStudentId('');
        setLoading(false);
        return;
      }
      await doCopyCode(ownStudents[0]);
    } catch (err: any) {
      setLoading(false);
      Taro.showToast({ title: err?.message || '获取学生信息失败', icon: 'none' });
    }
  };

  const doCopyCode = async (student?: Student) => {
    const studentId = student?.id;
    Taro.showLoading({ title: '复制中', mask: true });
    try {
      const newSchedule = await copyByInviteCode(code.trim(), studentId);

      addSchedule(newSchedule);

      Taro.hideLoading();

      const full = await getSchedule(newSchedule.id);
      setCurrentSchedule(full);

      const ownerId = full.student_id || studentId || '';
      if (student && ownerId === student.id) {
        setCurrentStudent(student);
      } else if (ownerId) {
        const owner = (await listStudents()).find(s => s.id === ownerId);
        if (owner) setCurrentStudent(owner);
      }

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
        goScheduleWithFamilyInvite();
      }, 1500);
    } catch (err: any) {
      Taro.hideLoading();
      Taro.showToast({ title: err.message || '复制失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const confirmSelectedStudent = () => {
    const target = pendingStudents?.find(s => s.id === selectedStudentId);
    if (!target) {
      Taro.showToast({ title: '请选择学生', icon: 'none' });
      return;
    }
    setPendingStudents(null);
    void doCopyCode(target);
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
            <View className='student-picker-list'>
              {pendingStudents.map((student) => {
                const active = student.id === selectedStudentId
                return (
                  <View
                    key={student.id}
                    className={`student-picker-item${active ? ' student-picker-item--active' : ''}`}
                    onClick={() => setSelectedStudentId(student.id)}
                  >
                    <Text className='student-picker-item-name'>{student.name}</Text>
                    {active ? <Text className='student-picker-item-check'>✓</Text> : null}
                  </View>
                )
              })}
            </View>
            <View className='student-picker-actions'>
              <View className='student-picker-btn student-picker-btn--cancel' onClick={() => dismissStudentPicker()}>取消</View>
              <View
                className={`student-picker-btn student-picker-btn--confirm${!selectedStudentId ? ' student-picker-btn--disabled' : ''}`}
                onClick={confirmSelectedStudent}
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
