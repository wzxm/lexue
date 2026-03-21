import type { ApiResponse } from '../types/index';

// CloudClient — 封装 wx.cloud.callFunction，统一处理错误
// 老王注：所有云函数调用都走这里，别自己裸调 wx.cloud，那样出错了你哭都找不到地方

class CloudClient {
  async call<T>(functionName: string, data: Record<string, unknown>): Promise<T> {
    let res: WechatMiniprogram.Cloud.CallFunctionResult;
    try {
      res = await wx.cloud.callFunction({ name: functionName, data });
    } catch (e) {
      console.error(`[cloud] callFunction "${functionName}" network error`, e);
      throw new Error(`网络请求失败，请检查网络`);
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
