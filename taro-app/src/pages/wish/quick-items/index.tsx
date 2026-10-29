import { View, Text, Button, Input } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import * as wishApi from '../../../api/wish.api';
import type { WishQuickItem, WishTransactionType } from '../../../types/index';
import './index.scss';

export default function WishQuickItemsPage() {
  const [studentId, setStudentId] = useState('');
  const [items, setItems] = useState<WishQuickItem[]>([]);
  const [activeTab, setActiveTab] = useState<WishTransactionType>('earn');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useLoad((options) => {
    const sid = options.studentId || '';
    setStudentId(sid);
    if (sid) {
      loadQuickItems(sid);
    } else {
      setReady(true);
    }
  });

  const loadQuickItems = async (sid: string) => {
    try {
      const result = await wishApi.listQuickItems(sid);
      setItems(result);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      // 首次数据就绪后再展示内容，避免空列表闪烁
      setReady(true);
    }
  };

  const handleAddItem = (type: WishTransactionType) => {
    const newItem: WishQuickItem = {
      type,
      name: '',
      amount: 1,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleUpdateItem = (index: number, field: keyof WishQuickItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSave = async () => {
    const validItems = items.filter(item => item.name.trim() && item.amount > 0 && item.amount <= 999);

    if (validItems.length === 0) {
      Taro.showToast({ title: '请至少添加一项', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      await wishApi.saveQuickItems(studentId, validItems);
      Taro.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1000);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  const earnItems = items.filter(item => item.type === 'earn');
  const spendItems = items.filter(item => item.type === 'spend');
  const activeItems = activeTab === 'earn' ? earnItems : spendItems;

  if (!ready) {
    return (
      <View className='wish-quick-items-page'>
        <View className='page-loading'>
          <Text className='page-loading-text'>✨ 加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className='wish-quick-items-page'>
      <View className='page-body'>
        <View className='tabs'>
          <View
            className={`tab-item ${activeTab === 'earn' ? 'active' : ''}`}
            onClick={() => setActiveTab('earn')}
          >
            <Text className='tab-text'>存入</Text>
          </View>
          <View
            className={`tab-item ${activeTab === 'spend' ? 'active' : ''}`}
            onClick={() => setActiveTab('spend')}
          >
            <Text className='tab-text'>取出</Text>
          </View>
        </View>

        <Button className='add-btn' onClick={() => handleAddItem(activeTab)}>
          ＋ 添加{activeTab === 'earn' ? '存入' : '取出'}项
        </Button>

        <View className='section'>
          {activeItems.map(item => {
            const globalIdx = items.findIndex(i => i === item);
            return (
              <View key={globalIdx} className='item-row'>
                <Input
                  className='item-name'
                  placeholder='名称'
                  value={item.name}
                  onInput={(e) => handleUpdateItem(globalIdx, 'name', e.detail.value)}
                />
                <Input
                  className='item-amount'
                  type='number'
                  placeholder='1-999'
                  value={item.amount.toString()}
                  onInput={(e) => handleUpdateItem(globalIdx, 'amount', parseInt(e.detail.value, 10) || 1)}
                />
                <Text className='item-remove' onClick={() => handleRemoveItem(globalIdx)}>删除</Text>
              </View>
            );
          })}
          {activeItems.length === 0 && (
            <View className='empty-hint'>
              <Text>还没有{activeTab === 'earn' ? '存入' : '取出'}项，点下方添加</Text>
            </View>
          )}
        </View>
      </View>

      <View className='footer'>
        <Button className='save-btn' disabled={saving} onClick={handleSave}>保存</Button>
      </View>
    </View>
  );
}
