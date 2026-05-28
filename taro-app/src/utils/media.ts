import Taro from '@tarojs/taro'

export type MediaSourceType = 'album' | 'camera'

/** 通过 ActionSheet 让用户选择拍照或相册，取消时返回 null */
export async function chooseMediaSource(): Promise<MediaSourceType | null> {
  try {
    const { tapIndex } = await Taro.showActionSheet({
      itemList: ['拍照', '相册选择'],
    })
    return tapIndex === 0 ? 'camera' : 'album'
  } catch (err: any) {
    if (err?.errMsg?.includes('cancel')) return null
    throw err
  }
}
