import Taro from '@tarojs/taro'

export type MediaSourceType = 'album' | 'camera'

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'])

export interface PickedLocalImage {
  filePath: string
  mimeType: string
  size: number
}

type WxPrivacyApi = {
  requirePrivacyAuthorize?: (option: {
    success?: () => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function getErrMsg(err: unknown): string {
  return String((err as { errMsg?: string; message?: string } | undefined)?.errMsg
    || (err as { message?: string } | undefined)?.message
    || '')
}

function getWx(): WxPrivacyApi {
  return ((globalThis as { wx?: WxPrivacyApi }).wx || Taro) as WxPrivacyApi
}

export function isUserCancel(err: unknown): boolean {
  return /cancel/i.test(getErrMsg(err))
}

export function isPrivacyScopeUndeclared(err: unknown): boolean {
  return /scope is not declared/i.test(getErrMsg(err))
}

export function getSafeImageExt(filePath: string): string {
  const name = (filePath.split(/[\\/]/).pop() || '').split('?')[0]
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  if (IMAGE_EXTS.has(ext)) return ext === 'jpeg' ? 'jpg' : ext
  return 'jpg'
}

export function inferImageMimeType(filePath: string): string {
  const ext = getSafeImageExt(filePath)
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  if (ext === 'bmp') return 'image/bmp'
  return 'image/jpeg'
}

export function getMediaFailMessage(err: unknown, fallback: string): string {
  if (isUserCancel(err)) return ''
  const msg = getErrMsg(err)
  if (isPrivacyScopeUndeclared(err)) {
    return '未在隐私保护指引中声明相册权限'
  }
  if (/privacy/i.test(msg)) {
    return '需要同意隐私协议后才能打开相册'
  }
  if (/auth deny|authorize|permission/i.test(msg)) {
    return '请允许访问相册后再试'
  }
  return fallback
}

export function showMediaFail(err: unknown, fallback = '选择图片失败') {
  if (isUserCancel(err)) return
  if (isPrivacyScopeUndeclared(err)) {
    void Taro.showModal({
      title: '无法打开相册',
      content: '选图没有系统授权弹窗。请到微信公众平台 → 设置 → 服务内容声明 → 用户隐私保护指引，勾选「收集你选中的照片或视频信息」，拍照再勾选「访问你的摄像头」。保存生效后重新进入小程序。',
      showCancel: false,
      confirmText: '知道了',
    })
    return
  }
  Taro.showToast({ title: getMediaFailMessage(err, fallback) || fallback, icon: 'none' })
}

/** 弹出微信官方隐私同意窗；已同意则立即成功。相册读取本身没有 wx.authorize。 */
async function ensurePrivacyAuthorized() {
  const wxApi = getWx()
  if (typeof wxApi.requirePrivacyAuthorize !== 'function') return
  await new Promise<void>((resolve, reject) => {
    wxApi.requirePrivacyAuthorize!({
      success: () => resolve(),
      fail: (err) => reject(err),
    })
  })
}

/** 通过 ActionSheet 让用户选择拍照或相册，取消时返回 null */
export async function chooseMediaSource(): Promise<MediaSourceType | null> {
  try {
    const { tapIndex } = await Taro.showActionSheet({
      itemList: ['拍照', '相册选择'],
    })
    return tapIndex === 0 ? 'camera' : 'album'
  } catch (err: unknown) {
    if (isUserCancel(err)) return null
    throw err
  }
}

/**
 * 选一张本地图片。
 * iOS 上 wx.chooseMedia 只传 album 或 camera 会失败，因此走 chooseImage。
 * ActionSheet 关闭后再调原生选图，避免两个原生弹层冲突。
 */
export async function chooseLocalImage(): Promise<PickedLocalImage | null> {
  const sourceType = await chooseMediaSource()
  if (!sourceType) return null
  await waitMs(320)
  await ensurePrivacyAuthorized()
  await waitMs(200)
  const res = await Taro.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: [sourceType],
  })
  const file = res.tempFiles?.[0]
  const filePath = file?.path || res.tempFilePaths?.[0]
  if (!filePath) return null
  return {
    filePath,
    mimeType: inferImageMimeType(filePath),
    size: file?.size || 0,
  }
}
