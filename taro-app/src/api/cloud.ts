import Taro from '@tarojs/taro'
import type { ApiResponse } from '../types/index';

// CloudClient — wx.cloud → Taro.cloud
class CloudClient {
  async call<T>(functionName: string, data: Record<string, unknown>): Promise<T> {
    let res: any;
    try {
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
