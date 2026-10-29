import { View, Text, Button, Input } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import * as wishApi from '../../../api/wish.api';
import type { WishQuickItem, WishTransactionType } from '../../../types/index';
import './index.scss';

export default function WishQuickItemsPage() {
  const [studentId, setStudentId] = useState('');
  const [items, setItems] = useState<WishQuickItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useLoad((options) => {
    const sid = options.studentId || '';
    setStudentId(sid);
    if (sid) {
      loadQuickItems(sid);
    }
  });

  const loadQuickItems = async (sid: string) => {
    setLoading(true);
    try {
      const result = await wishApi.listQuickItems(sid);
      setItems(result);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
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

  return (
    <View className='wish-quick-items-page'>
      <View className='section'>
        <View className='section-header'>
          <Text className='section-title'>赚取项</Text>
          <Button className='add-btn earn' onClick={() => handleAddItem('earn')}>+ 添加</Button>
        </View>
        {earnItems.map((item, idx) => {
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
      </View>

      <View className='section'>
        <View className='section-header'>
          <Text className='section-title'>消费项</Text>
          <Button className='add-btn spend' onClick={() => handleAddItem('spend')}>+ 添加</Button>
        </View>
        {spendItems.map((item, idx) => {
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
      </View>

      <View className='footer'>
        <Button className='save-btn' disabled={saving} onClick={handleSave}>保存</Button>
      </View>
    </View>
  );
}
