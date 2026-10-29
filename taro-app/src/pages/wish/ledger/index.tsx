import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import * as wishApi from '../../../api/wish.api';
import type { WishTransaction, WishTransactionType } from '../../../types/index';
import './index.scss';

export default function WishLedgerPage() {
  const [studentId, setStudentId] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | WishTransactionType>('all');
  const [items, setItems] = useState<WishTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useLoad((options) => {
    const sid = options.studentId || '';
    setStudentId(sid);
    if (sid) {
      loadTransactions(sid, 'all', true);
    }
  });

  const loadTransactions = async (
    sid: string,
    tab: 'all' | WishTransactionType,
    reset = false
  ) => {
    if (loading) return;
    setLoading(true);

    try {
      const type = tab === 'all' ? undefined : tab;
      const cursor = reset ? undefined : nextCursor || undefined;
      const result = await wishApi.listTransactions(sid, type, 50, cursor);

      if (reset) {
        setItems(result.items);
      } else {
        setItems([...items, ...result.items]);
      }
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: 'all' | WishTransactionType) => {
    setActiveTab(tab);
    loadTransactions(studentId, tab, true);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      loadTransactions(studentId, activeTab, false);
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (itemDate.getTime() === today.getTime()) {
      return '今天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (itemDate.getTime() === yesterday.getTime()) {
      return '昨天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else {
      return d.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  return (
    <View className='wish-ledger-page'>
      <View className='tabs'>
        <View
          className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => handleTabChange('all')}
        >
          <Text className='tab-text'>全部</Text>
        </View>
        <View
          className={`tab-item ${activeTab === 'earn' ? 'active' : ''}`}
          onClick={() => handleTabChange('earn')}
        >
          <Text className='tab-text'>赚取</Text>
        </View>
        <View
          className={`tab-item ${activeTab === 'spend' ? 'active' : ''}`}
          onClick={() => handleTabChange('spend')}
        >
          <Text className='tab-text'>消费</Text>
        </View>
      </View>

      <ScrollView
        className='transaction-scroll'
        scrollY
        lowerThreshold={100}
        onScrollToLower={loadMore}
      >
        {items.length > 0 ? (
          <View className='transaction-list'>
            {items.map(item => (
              <View key={item.transactionId} className='transaction-item'>
                {item.operatorAvatar ? (
                  <Image
                    className='operator-avatar'
                    src={item.operatorAvatar}
                    mode='aspectFill'
                  />
                ) : (
                  <View className='operator-avatar operator-avatar--fallback'>
                    <Text>{(item.operatorName || '家').charAt(0)}</Text>
                  </View>
                )}
                <View className='item-main'>
                  <Text className='item-reason'>{item.reason}</Text>
                  <View className='item-meta'>
                    <Text className='item-operator'>{item.operatorName || '家庭成员'}</Text>
                    <Text className='item-time'>{formatDate(item.createdAt)}</Text>
                  </View>
                </View>
                <Text className={`item-amount ${item.type}`}>
                  {item.type === 'earn' ? '+' : '-'}{item.amount}
                </Text>
              </View>
            ))}
            {loading && <View className='loading'>加载中...</View>}
            {!loading && !hasMore && items.length > 10 && (
              <View className='no-more'>没有更多了</View>
            )}
          </View>
        ) : (
          <View className='empty-state'>
            <Text className='empty-text'>暂无记录</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
