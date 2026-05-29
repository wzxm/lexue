import Taro from '@tarojs/taro'

/** 微信本地临时路径，重启或跨会话后无法用于 Image src */
export function isEphemeralAvatarUrl(url?: string | null): boolean {
  if (!url) return false
  return (
    url.startsWith('wxfile://') ||
    url.includes('/__tmp__/') ||
    url.startsWith('http://tmp/') ||
    url.startsWith('https://tmp/')
  )
}

export function isCloudFileId(url?: string | null): boolean {
  return !!url && url.startsWith('cloud://')
}

/** 同步展示用：过滤失效临时路径，保留 https 与 cloud:// */
export function getDisplayAvatarUrl(avatarUrl: string | undefined | null, fallback: string): string {
  if (!avatarUrl || isEphemeralAvatarUrl(avatarUrl)) return fallback
  return avatarUrl
}

/** 将 cloud fileID 转为可展示的 HTTPS 临时链接 */
export async function resolveCloudAvatarUrl(fileId: string): Promise<string> {
  const res = await Taro.cloud.getTempFileURL({ fileList: [fileId] })
  const item = res.fileList?.[0]
  if (item?.status === 0 && item.tempFileURL) {
    return item.tempFileURL
  }
  throw new Error(item?.errMsg || '头像链接解析失败')
}
