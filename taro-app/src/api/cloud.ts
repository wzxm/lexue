import Taro from '@tarojs/taro'
import type { ApiResponse } from '../types/index';

declare const CLOUD_ENV: string | undefined;

const DEFAULT_CLOUD_ENV = 'test-d7gxuxk5a8418c629';
const cloudEnv = typeof CLOUD_ENV !== 'undefined' && CLOUD_ENV ? CLOUD_ENV : DEFAULT_CLOUD_ENV;
let initPromise: Promise<void> | null = null;

export async function ensureCloudInitialized(): Promise<void> {
  if (!Taro.cloud) {
    throw new Error('当前环境不支持云开发');
  }

  if (!initPromise) {
    console.log('cloudEnv', cloudEnv)
    try {
      Taro.cloud.init({
        env: cloudEnv,
        traceUser: true,
      });
      initPromise = Promise.resolve();
    } catch (error) {
      initPromise = null;
      throw error;
    }
  }

  await initPromise;
}

// CloudClient — wx.cloud → Taro.cloud
class CloudClient {
  async call<T>(functionName: string, data: Record<string, unknown>): Promise<T> {
    let res: any;
    try {
      await ensureCloudInitialized();
      res = await Taro.cloud.callFunction({ name: functionName, data });
    } catch (e) {
      console.error(`[cloud] callFunction "${functionName}" network error`, e);
      throw new Error('网络请求失败，请检查网络');
    }

    const result = res.result as ApiResponse<T>;
    if (!result || result.code !== 0) {
      const msg = result?.message || '服务器返回了个寂寞';
      console.error(`[cloud] "${functionName}" business error`, result);
      throw new Error(msg);
    }

    return result.data;
  }
}

export const cloud = new CloudClient();
