import Taro from '@tarojs/taro'
import { saveSubscribeAuth } from '../api/auth.api'

/**
 * 订阅消息模板ID
 * 需要在微信公众平台申请，并替换此常量
 * 申请步骤见 cloudfunctions/reminder/index.js 注释
 */
export const SUBSCRIBE_TEMPLATE_ID = 'YOUR_SUBSCRIBE_TEMPLATE_ID'

/**
 * 请求订阅消息授权
 * 调用微信 API 弹出授权弹窗，用户同意后保存授权记录到数据库
 *
 * @returns Promise<boolean> 是否授权成功
 */
export async function requestSubscribeMessage(): Promise<boolean> {
  try {
    // 调用微信 API 请求订阅消息授权
    const res = await Taro.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TEMPLATE_ID],
      entityIds: []
    })

    // 获取授权结果
    const result = res[SUBSCRIBE_TEMPLATE_ID]
    console.log('[subscribe] 授权结果:', result)

    // 保存授权记录到数据库
    if (result === 'accept' || result === 'reject' || result === 'ban') {
      await saveSubscribeAuth(SUBSCRIBE_TEMPLATE_ID, result)
    }

    return result === 'accept'
  } catch (error) {
    console.error('[subscribe] 请求授权失败:', error)
    return false
  }
}

/**
 * 检查是否需要请求订阅授权
 * 在用户��启提醒功能时调用
 *
 * @returns Promise<boolean> 是否已授权
 */
export async function checkSubscribeAuth(): Promise<boolean> {
  try {
    // 微信小程序没有直接查询订阅状态的 API
    // 只能通过请求授权来判断
    // 如果用户已授权，会直接返回 'accept'
    // 如果用户未授权，会弹出授权弹窗
    return await requestSubscribeMessage()
  } catch (error) {
    console.error('[subscribe] 检查授权失败:', error)
    return false
  }
}
