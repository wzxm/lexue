import { cloud } from './cloud';
import type { BackendSettings } from '../types/index';

// 后端字段约定（snake_case，与云函数保持一致）
export type NotifySettings = BackendSettings;

export async function getSettings(): Promise<NotifySettings> {
  return cloud.call<NotifySettings>('notify', { action: 'getSettings', payload: {} });
}

export async function updateSettings(settings: Partial<NotifySettings>): Promise<void> {
  return cloud.call<void>('notify', { action: 'updateSettings', payload: settings });
}

// result: 'accept' | 'reject' | 'ban'（微信订阅消息回调的结果值）
export async function recordSubscribe(templateId: string, result: 'accept' | 'reject' | 'ban'): Promise<void> {
  return cloud.call<void>('notify', { action: 'recordSubscribe', payload: { templateId, result } });
}
