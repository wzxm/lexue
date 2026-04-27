import Taro from '@tarojs/taro'
import type { ApiResponse } from '../types/index';

const CLOUD_ENV = 'cloud1-1g0kf2p8b07af20f';
let initPromise: Promise<void> | null = null;

export async function ensureCloudInitialized(): Promise<void> {
  if (!Taro.cloud) {
    throw new Error('当前环境不支持云开发');
  }

  if (!initPromise) {
    try {
      Taro.cloud.init({
        env: CLOUD_ENV,
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
