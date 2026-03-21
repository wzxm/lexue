import { cloud } from './cloud';
import type { BackendSettings } from '../types/index';

export type NotifySettings = BackendSettings;

export async function getSettings(): Promise<NotifySettings> {
  return cloud.call<NotifySettings>('notify', { action: 'getSettings', payload: {} });
}

export async function updateSettings(settings: Partial<NotifySettings>): Promise<void> {
  return cloud.call<void>('notify', { action: 'updateSettings', payload: settings });
}

export async function recordSubscribe(templateId: string, result: 'accept' | 'reject' | 'ban'): Promise<void> {
  return cloud.call<void>('notify', { action: 'recordSubscribe', payload: { templateId, result } });
}
