import { View, WebView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import './index.scss';

// 允许内嵌的域名白名单（后续要内嵌其他站点时在数组里追加）
const ALLOWED_HOSTS = ['mp.weixin.qq.com'];

export default function WebviewPage() {
  const [src, setSrc] = useState('');

  useLoad((options) => {
    const raw = decodeURIComponent(options.src || '');
    const match = raw.match(/^https:\/\/([^/?#]+)/);
    const host = match ? match[1] : '';

    if (host && ALLOWED_HOSTS.includes(host)) {
      setSrc(raw);
      if (options.title) {
        Taro.setNavigationBarTitle({ title: decodeURIComponent(options.title) });
      }
    } else {
      Taro.showToast({ title: '链接不可用', icon: 'none' });
      setTimeout(() => Taro.navigateBack(), 1200);
    }
  });

  if (!src) {
    return <View className='webview-page' />;
  }

  return (
    <View className='webview-page'>
      <WebView src={src} />
    </View>
  );
}
