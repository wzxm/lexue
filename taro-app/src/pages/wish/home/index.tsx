import { View, Text, Button, Image, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { useStudentStore } from '../../../store/student.store';
import { useWishStore } from '../../../store/wish.store';
import * as wishApi from '../../../api/wish.api';
import { ROUTES } from '../../../constants/routes';
import type { Student, WishTransactionType } from '../../../types/index';
import './index.scss';

export default function WishHomePage() {
  const { students, currentStudent, setCurrentStudent } = useStudentStore();
  const { homeData, setHomeData, currentStudentId, setCurrentStudentId } = useWishStore();

  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showEarnSheet, setShowEarnSheet] = useState(false);
  const [showSpendSheet, setShowSpendSheet] = useState(false);
  const [earnAmount, setEarnAmount] = useState('');
  const [earnReason, setEarnReason] = useState('');
  const [spendAmount, setSpendAmount] = useState('');
  const [spendReason, setSpendReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // 可管理的学生（owner 或家庭成员）
  const manageableStudents = students.filter(
    s => !s.isShared || (s.isShared && s.ownerUserId)
  );

  const activeStudent = currentStudent && manageableStudents.find(s => s.id === currentStudent.id)
    ? currentStudent
    : manageableStudents[0] || null;

  // 检查引导
  useEffect(() => {
    checkIntro();
  }, []);

  // 切换学生
  useEffect(() => {
    if (activeStudent && activeStudent.id !== currentStudentId) {
      setCurrentStudentId(activeStudent.id);
      loadHomeData(activeStudent.id);
    }
  }, [activeStudent?.id]);

  useDidShow(() => {
    if (activeStudent) {
      loadHomeData(activeStudent.id);
    }
  });

  const checkIntro = async () => {
    try {
      const { seen } = await wishApi.getIntroState();
      if (!seen) {
        setShowIntro(true);
      }
    } catch (e) {
      console.error('checkIntro error:', e);
    }
  };

  const handleIntroClose = async () => {
    try {
      await wishApi.markIntroSeen();
      setShowIntro(false);
    } catch (e) {
      console.error('markIntroSeen error:', e);
      setShowIntro(false);
    }
  };

  const loadHomeData = async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    try {
      await wishApi.ensureAccount(studentId);
      const data = await wishApi.getHome(studentId, selectedDate);
      setHomeData(data);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = (student: Student) => {
    setCurrentStudent(student);
  };

  const handleEarn = () => {
    setShowEarnSheet(true);
    setEarnAmount('');
    setEarnReason('');
  };

  const handleSpend = () => {
    setShowSpendSheet(true);
    setSpendAmount('');
    setSpendReason('');
  };

  const handleSubmitEarn = async () => {
    if (!activeStudent) return;
    const amount = parseInt(earnAmount, 10);
    if (!amount || amount <= 0 || amount > 999) {
      Taro.showToast({ title: '金额必须为 1-999', icon: 'none' });
      return;
    }
    if (!earnReason.trim()) {
      Taro.showToast({ title: '请填写原因', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const requestId = `earn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await wishApi.addTransaction(activeStudent.id, 'earn', amount, earnReason, requestId);
      Taro.showToast({ title: '赚取成功', icon: 'success' });
      setShowEarnSheet(false);
      loadHomeData(activeStudent.id);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSpend = async () => {
    if (!activeStudent) return;
    const amount = parseInt(spendAmount, 10);
    if (!amount || amount <= 0 || amount > 999) {
      Taro.showToast({ title: '金额必须为 1-999', icon: 'none' });
      return;
    }
    if (!spendReason.trim()) {
      Taro.showToast({ title: '请填写原因', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const requestId = `spend_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await wishApi.addTransaction(activeStudent.id, 'spend', amount, spendReason, requestId);
      Taro.showToast({ title: '消费成功', icon: 'success' });
      setShowSpendSheet(false);
      loadHomeData(activeStudent.id);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const goToLedger = () => {
    if (!activeStudent) return;
    Taro.navigateTo({ url: `${ROUTES.WISH_LEDGER}?studentId=${activeStudent.id}` });
  };

  const goToQuickItems = () => {
    if (!activeStudent) return;
    Taro.navigateTo({ url: `${ROUTES.WISH_QUICK_ITEMS}?studentId=${activeStudent.id}` });
  };

  const goToStudentForm = () => {
    Taro.navigateTo({ url: ROUTES.STUDENT_FORM });
  };

  if (!activeStudent) {
    return (
      <View className='wish-home-page'>
        <View className='empty-state'>
          <Text className='empty-text'>还没有学生，快去添加吧</Text>
          <Button className='add-student-btn' onClick={goToStudentForm}>添加学生</Button>
        </View>
      </View>
    );
  }

  return (
    <View className='wish-home-page'>
      {/* 顶部学生选择 */}
      {manageableStudents.length > 1 && (
        <View className='student-selector'>
          <ScrollView scrollX className='student-list'>
            {manageableStudents.map(s => (
              <View
                key={s.id}
                className={`student-item ${s.id === activeStudent.id ? 'active' : ''}`}
                onClick={() => handleSelectStudent(s)}
              >
                <Text className='student-name'>{s.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 罐子视觉 + 余额 */}
      <View className='jar-section'>
        <View className='jar-container'>
          <View className='jar-body'>
            <Text className='balance'>{homeData?.balance ?? 0}</Text>
            <Text className='coin-label'>星愿币</Text>
          </View>
        </View>
      </View>

      {/* 本月统计 */}
      <View className='month-stats'>
        <View className='stat-item earn'>
          <Text className='stat-label'>本月赚取</Text>
          <Text className='stat-value'>+{homeData?.monthEarn ?? 0}</Text>
        </View>
        <View className='stat-item spend'>
          <Text className='stat-label'>本月消费</Text>
          <Text className='stat-value'>-{homeData?.monthSpend ?? 0}</Text>
        </View>
      </View>

      {/* 操作按钮 */}
      <View className='action-buttons'>
        <Button className='earn-btn' onClick={handleEarn}>赚取</Button>
        <Button className='spend-btn' onClick={handleSpend}>消费</Button>
      </View>

      {/* 今日明细 */}
      <View className='today-section'>
        <View className='section-header'>
          <Text className='section-title'>今日明细</Text>
          <Text className='view-all' onClick={goToLedger}>查看全部 ›</Text>
        </View>
        {homeData?.dayItems && homeData.dayItems.length > 0 ? (
          <View className='transaction-list'>
            {homeData.dayItems.map(item => (
              <View key={item.transactionId} className='transaction-item'>
                <View className='item-left'>
                  <Text className={`item-type ${item.type}`}>
                    {item.type === 'earn' ? '+' : '-'}{item.amount}
                  </Text>
                  <View className='item-info'>
                    <Text className='item-reason'>{item.reason}</Text>
                    <Text className='item-operator'>{item.operatorName || '家庭成员'}</Text>
                  </View>
                </View>
                <Text className='item-time'>
                  {new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className='empty-today'>
            <Text className='empty-text'>今天还没有记录</Text>
          </View>
        )}
      </View>

      {/* 快捷入口 */}
      <View className='quick-links'>
        <View className='link-item' onClick={goToQuickItems}>
          <Text className='link-text'>管理快捷项</Text>
        </View>
      </View>

      {/* 引导弹窗 */}
      {showIntro && (
        <View className='intro-modal'>
          <View className='intro-content'>
            <Text className='intro-title'>欢迎使用小星愿</Text>
            <Text className='intro-desc'>
              星愿币是孩子努力的见证，通过完成任务赚取，用来兑换奖励。
              {'\n\n'}
              家庭成员可以共同管理，记录孩子的每一份付出。
            </Text>
            <Button className='intro-btn' onClick={handleIntroClose}>开始使用</Button>
          </View>
        </View>
      )}

      {/* 赚取底部弹窗 */}
      {showEarnSheet && (
        <View className='sheet-mask' onClick={() => setShowEarnSheet(false)}>
          <View className='sheet-content' onClick={(e) => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='sheet-title'>赚取星愿币</Text>
              <Text className='sheet-close' onClick={() => setShowEarnSheet(false)}>✕</Text>
            </View>
            <View className='sheet-body'>
              <View className='form-item'>
                <Text className='form-label'>数量</Text>
                <input
                  className='form-input'
                  type='number'
                  placeholder='1-999'
                  value={earnAmount}
                  onInput={(e) => setEarnAmount(e.detail.value)}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>原因</Text>
                <input
                  className='form-input'
                  type='text'
                  placeholder='如：洗碗筷'
                  value={earnReason}
                  onInput={(e) => setEarnReason(e.detail.value)}
                />
              </View>
              <Button
                className='submit-btn'
                disabled={submitting}
                onClick={handleSubmitEarn}
              >
                确认
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 消费底部弹窗 */}
      {showSpendSheet && (
        <View className='sheet-mask' onClick={() => setShowSpendSheet(false)}>
          <View className='sheet-content' onClick={(e) => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='sheet-title'>消费星愿币</Text>
              <Text className='sheet-close' onClick={() => setShowSpendSheet(false)}>✕</Text>
            </View>
            <View className='sheet-body'>
              <View className='form-item'>
                <Text className='form-label'>数量</Text>
                <input
                  className='form-input'
                  type='number'
                  placeholder='1-999'
                  value={spendAmount}
                  onInput={(e) => setSpendAmount(e.detail.value)}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>原因</Text>
                <input
                  className='form-input'
                  type='text'
                  placeholder='如：吃零食'
                  value={spendReason}
                  onInput={(e) => setSpendReason(e.detail.value)}
                />
              </View>
              <Button
                className='submit-btn'
                disabled={submitting}
                onClick={handleSubmitSpend}
              >
                确认
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
