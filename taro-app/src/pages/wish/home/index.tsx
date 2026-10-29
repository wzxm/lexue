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
  const { homeData, setHomeData, currentStudentId, setCurrentStudentId, quickItems, setQuickItems } = useWishStore();

  // 自定义导航（透明）：与 tools 页同一套胶囊避让算法
  const windowInfo = Taro.getWindowInfo();
  const menuButtonInfo = Taro.getMenuButtonBoundingClientRect();
  const statusBarHeight = windowInfo.statusBarHeight || 0;
  const rawNavBar =
    (menuButtonInfo.top - statusBarHeight) * 2 + (menuButtonInfo.height || 0);
  const navBarHeight =
    Number.isFinite(rawNavBar) && rawNavBar > 0 ? rawNavBar : 88;

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
  const [currentYearMonth, setCurrentYearMonth] = useState(new Date().toISOString().substring(0, 7));
  const [calendarData, setCalendarData] = useState<Record<string, { has_earn: boolean; has_spend: boolean }>>({});

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
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().substring(0, 7);
      setSelectedDate(today);
      setCurrentYearMonth(thisMonth);
      loadHomeData(activeStudent.id, today);
      loadCalendarData(activeStudent.id, thisMonth);
    }
  }, [activeStudent?.id]);

  useDidShow(() => {
    if (activeStudent) {
      loadHomeData(activeStudent.id, selectedDate);
      loadCalendarData(activeStudent.id, currentYearMonth);
    }
  });

  // 月份变化时加载日历数据
  useEffect(() => {
    if (activeStudent) {
      loadCalendarData(activeStudent.id, currentYearMonth);
    }
  }, [currentYearMonth, activeStudent?.id]);

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

  const loadHomeData = async (studentId: string, date?: string) => {
    if (!studentId) return;
    setLoading(true);
    try {
      await wishApi.ensureAccount(studentId);
      const targetDate = date || selectedDate;
      const data = await wishApi.getHome(studentId, targetDate);
      setHomeData(data);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarData = async (studentId: string, yearMonth: string) => {
    if (!studentId || !yearMonth) return;
    try {
      const result = await wishApi.getMonthCalendar(studentId, yearMonth);
      setCalendarData(result.days || {});
    } catch (e: any) {
      console.error('loadCalendarData error:', e);
    }
  };

  const handleSelectStudent = (student: Student) => {
    setCurrentStudent(student);
  };

  const handleEarn = async () => {
    setShowEarnSheet(true);
    setEarnAmount('');
    setEarnReason('');
    // 加载快捷项
    if (activeStudent) {
      try {
        const items = await wishApi.listQuickItems(activeStudent.id);
        setQuickItems(items);
      } catch (e) {
        console.error('loadQuickItems error:', e);
      }
    }
  };

  const handleSpend = async () => {
    setShowSpendSheet(true);
    setSpendAmount('');
    setSpendReason('');
    // 加载快捷项
    if (activeStudent) {
      try {
        const items = await wishApi.listQuickItems(activeStudent.id);
        setQuickItems(items);
      } catch (e) {
        console.error('loadQuickItems error:', e);
      }
    }
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
      loadHomeData(activeStudent.id, selectedDate);
      loadCalendarData(activeStudent.id, currentYearMonth);
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
      loadHomeData(activeStudent.id, selectedDate);
      loadCalendarData(activeStudent.id, currentYearMonth);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  // 快捷项点击处理
  const handleQuickItemClick = (type: WishTransactionType, name: string, amount: number) => {
    if (type === 'earn') {
      setEarnAmount(amount.toString());
      setEarnReason(name);
    } else {
      setSpendAmount(amount.toString());
      setSpendReason(name);
    }
  };

  // 日历导航
  const handlePrevMonth = () => {
    const [year, month] = currentYearMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setCurrentYearMonth(prevYM);
  };

  const handleNextMonth = () => {
    const [year, month] = currentYearMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    const nextYM = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setCurrentYearMonth(nextYM);
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    if (activeStudent) {
      loadHomeData(activeStudent.id, date);
    }
  };

  // 生成日历格子
  const generateCalendarDays = () => {
    const [year, month] = currentYearMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay() || 7; // 0=Sunday -> 7

    const days: Array<{ date: string; day: number; hasEarn: boolean; hasSpend: boolean; isToday: boolean; isSelected: boolean }> = [];
    
    // 填充前面的空格
    for (let i = 1; i < startWeekday; i++) {
      days.push({ date: '', day: 0, hasEarn: false, hasSpend: false, isToday: false, isSelected: false });
    }

    // 填充日期
    const today = new Date().toISOString().split('T')[0];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = calendarData[dateStr] || { has_earn: false, has_spend: false };
      days.push({
        date: dateStr,
        day,
        hasEarn: dayData.has_earn,
        hasSpend: dayData.has_spend,
        isToday: dateStr === today,
        isSelected: dateStr === selectedDate,
      });
    }

    return days;
  };

  // 格式化明细标题
  const formatDayTitle = () => {
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate === today) {
      return '今日明细';
    }
    const date = new Date(selectedDate);
    return `${date.getMonth() + 1}月${date.getDate()}日明细`;
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

  const goBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
    } else {
      Taro.reLaunch({ url: ROUTES.TOOLS });
    }
  };

  // 统计标签月份：跟随所选日期所在月份
  const statMonth = Number(selectedDate.split('-')[1]) || 1;

  // 罐内星星：按余额计算数量与排布（存钱罐视觉）
  const jarStars = (() => {
    const balance = Math.max(0, homeData?.balance ?? 0);
    const count = Math.min(48, Math.ceil(Math.sqrt(balance) * 3));
    const colors = ['#FFD36C', '#FFC5AD', '#D5B2F5', '#FFE593'];
    return Array.from({ length: count }, (_, i) => {
      const col = i % 7;
      const row = Math.floor(i / 7);
      return {
        left: 6 + col * 12.6 + (row % 2) * 3.2 + (i % 3) * 0.8,
        bottom: 7 + row * 12.4 + (i % 4) * 1.2,
        size: 26 + (i % 3) * 6,
        color: colors[i % 4],
        rotate: (i % 5) * 14 - 28,
        // 伪随机（按序号确定）：延迟 0~900ms、时长 1.1~1.8s、两套掉落轨迹交替
        delay: Math.round((((i * 137) % 100) / 100) * 900),
        duration: (1.1 + (((i * 61) % 100) / 100) * 0.7).toFixed(2),
        anim: i % 2 === 0 ? 'star-drop-a' : 'star-drop-b',
      };
    });
  })();

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
      {/* 自定义导航区（透明，融入页面渐变背景） */}
      <View className='custom-nav' style={{ height: `${statusBarHeight + navBarHeight}px` }}>
        <View className='nav-inner' style={{ paddingTop: `${menuButtonInfo.top}px` }}>
          <View className='nav-back' onClick={goBack}>
            <Text className='nav-back-icon'>‹</Text>
          </View>
          <Text className='nav-title'>小星愿</Text>
        </View>
      </View>

      {/* 学生行：横向滑动选择，右侧固定「管理快捷项」按钮 */}
      <View className='student-row'>
        <ScrollView scrollX enhanced showScrollbar={false} className='student-scroll'>
          <View className='student-chips'>
            {manageableStudents.map(s => (
              <View
                key={s.id}
                className={`student-item ${s.id === activeStudent.id ? 'active' : ''}`}
                onClick={() => handleSelectStudent(s)}
              >
                <Text className='student-name'>{s.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View className='quick-manage-btn' onClick={goToQuickItems}>
          <Text className='quick-manage-icon'>⚙️</Text>
        </View>
      </View>

      {/* 星愿储蓄罐 */}
      <View className='jar-hero'>
        <Text className='hero-eyebrow'>每天攒一点，努力会发光✨</Text>
        <View className='jar-flex'>
          <View className='jar-wrap'>
          <View className='jar-lid' />
          <View className='jar-jar'>
            <View className='jar-stars'>
              {jarStars.map((st, i) => (
                <View
                  key={`${activeStudent?.id ?? 'star'}-${i}`}
                  className='jar-star'
                  style={{
                    left: `${st.left}%`,
                    bottom: `${st.bottom}%`,
                    animation: `${st.anim} ${st.duration}s cubic-bezier(0.3, 0.7, 0.4, 1) ${st.delay}ms backwards`
                  }}
                >
                  <Text
                    className='jar-star-icon'
                    style={{
                      fontSize: `${st.size}rpx`,
                      color: st.color,
                      transform: `rotate(${st.rotate}deg)`
                    }}
                  >★</Text>
                </View>
              ))}
            </View>
            <View className='jar-shine' />
          </View>
        </View>
          <View className='balance-side'>
            <Text className='balance'>{homeData?.balance ?? 0}</Text>
            <Text className='coin-label'>星愿币</Text>
            <Text className='ledger-link' onClick={goToLedger}>存取明细 ›</Text>
          </View>
        </View>
      </View>

      {/* 存取按钮 */}
      <View className='action-buttons'>
        <Button className='action-btn earn-btn' onClick={handleEarn}>存</Button>
        <Button className='action-btn spend-btn' onClick={handleSpend}>取</Button>
      </View>

      {/* 月历（顶部融合本月存取统计） */}
      <View className='calendar-section'>
        <View className='calendar-stats'>
          <View className='calendar-stat earn'>
            <Text className='calendar-stat-label'>{statMonth}月共存</Text>
            <Text className='calendar-stat-value'>+{homeData?.monthEarn ?? 0}</Text>
          </View>
          <View className='calendar-stat spend'>
            <Text className='calendar-stat-label'>{statMonth}月共取</Text>
            <Text className='calendar-stat-value'>-{homeData?.monthSpend ?? 0}</Text>
          </View>
        </View>
        <View className='calendar-header'>
          <Text className='prev-month' onClick={handlePrevMonth}>‹</Text>
          <Text className='calendar-title'>{currentYearMonth}</Text>
          <Text className='next-month' onClick={handleNextMonth}>›</Text>
        </View>
        <View className='calendar-weekdays'>
          {['一', '二', '三', '四', '五', '六', '日'].map(day => (
            <View key={day} className='weekday-label'>
              <Text>{day}</Text>
            </View>
          ))}
        </View>
        <View className='calendar-days'>
          {generateCalendarDays().map((item, idx) => (
            <View
              key={idx}
              className={`calendar-day ${item.date ? '' : 'empty'} ${item.isToday ? 'today' : ''} ${item.isSelected ? 'selected' : ''}`}
              onClick={() => item.date && handleDateClick(item.date)}
            >
              {item.date && (
                <>
                  <Text className='day-number'>{item.day}</Text>
                  {(item.hasEarn || item.hasSpend) && (
                    <View className='day-dots'>
                      {item.hasEarn && <View className='dot earn' />}
                      {item.hasSpend && <View className='dot spend' />}
                    </View>
                  )}
                </>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* 当日明细 */}
      <View className='today-section'>
        <View className='section-header'>
          <Text className='section-title'>{formatDayTitle()}</Text>
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
              <Text className='sheet-title'>存入</Text>
              <Text className='sheet-close' onClick={() => setShowEarnSheet(false)}>✕</Text>
            </View>
            <View className='sheet-body'>
              {/* 快捷项 */}
              {quickItems.filter(item => item.type === 'earn').length > 0 ? (
                <View className='quick-items-section'>
                  <Text className='quick-items-label'>快捷项</Text>
                  <View className='quick-items-list'>
                    {quickItems
                      .filter(item => item.type === 'earn')
                      .map(item => (
                        <View
                          key={item.id}
                          className='quick-item-chip'
                          onClick={() => handleQuickItemClick('earn', item.name, item.amount)}
                        >
                          <Text className='chip-text'>{item.name} {item.amount}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              ) : (
                <View className='no-quick-items'>
                  <Text className='hint-text'>暂无快捷项，去</Text>
                  <Text className='hint-link' onClick={goToQuickItems}>管理页</Text>
                  <Text className='hint-text'>添加</Text>
                </View>
              )}
              
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
              <Text className='sheet-title'>取出</Text>
              <Text className='sheet-close' onClick={() => setShowSpendSheet(false)}>✕</Text>
            </View>
            <View className='sheet-body'>
              {/* 快捷项 */}
              {quickItems.filter(item => item.type === 'spend').length > 0 ? (
                <View className='quick-items-section'>
                  <Text className='quick-items-label'>快捷项</Text>
                  <View className='quick-items-list'>
                    {quickItems
                      .filter(item => item.type === 'spend')
                      .map(item => (
                        <View
                          key={item.id}
                          className='quick-item-chip'
                          onClick={() => handleQuickItemClick('spend', item.name, item.amount)}
                        >
                          <Text className='chip-text'>{item.name} {item.amount}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              ) : (
                <View className='no-quick-items'>
                  <Text className='hint-text'>暂无快捷项，去</Text>
                  <Text className='hint-link' onClick={goToQuickItems}>管理页</Text>
                  <Text className='hint-text'>添加</Text>
                </View>
              )}

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
