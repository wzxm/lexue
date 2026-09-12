import Taro from '@tarojs/taro'

/** 微信运行时注入的全局对象（非微信端可能不存在） */
type WxLike = {
  openOfficialAccountArticle?: (options: {
    url: string
    success?: (res: { cancel?: boolean; confirm?: boolean }) => void
    fail?: (err: { errMsg?: string; errCode?: number }) => void
  }) => void
}

declare const wx: WxLike | undefined

/** 打开公众号文章（基础库 3.4.8+，需用户点击触发）；不支持或失败时降级为复制链接 */
export function openOfficialArticle(url: string) {
  const wxApi = typeof wx !== 'undefined' ? wx : undefined
  if (wxApi && typeof wxApi.openOfficialAccountArticle === 'function') {
    wxApi.openOfficialAccountArticle({
      url,
      fail: () => copyLinkFallback(url)
    })
    return
  }
  copyLinkFallback(url)
}

function copyLinkFallback(url: string) {
  void Taro.setClipboardData({ data: url })
  Taro.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none' })
}
