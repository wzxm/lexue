import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { tabState } from '../../utils/tabState'
import { ROUTES } from '../../constants/routes'
import gushiciIcon from '../../assets/gushici.png'
import xuepingxianIcon from '../../assets/xuepingxian.png'
import aiIcon from '../../assets/ai.png'
import saomiaoIcon from '../../assets/saomiao.png'
import starIcon from '../../assets/xiaoxinyuan-star.png'
import aiQimengIcon from '../../assets/ai-qimeng.png'
import './index.scss'

interface Tool {
  name: string
  icon?: string
  imgIcon?: string
  bgColor: string
  iconColor?: string
  onClick?: () => void
}

// 「古诗词」小程序 AppID（wx 开头，拿到后填入即可跳转）
const GUSHICI_APP_ID = 'wxd0f3bc0fc13834d2'

const openMiniProgram = (appId: string, path = '') => {
  return Taro.navigateToMiniProgram({ appId, path }).catch((err) => {
    // Taro 在调用失败时也会 reject；用户取消应静默结束。
    const errMsg = String(err?.errMsg || err?.message || '')
    if (/cancel|user\s+den(?:y|ied)|用户取消/i.test(errMsg)) return
    Taro.showToast({ title: '打开失败，请稍后再试', icon: 'none' })
  })
}

const toolList: Tool[] = [
  {
    name: '扫描试卷',
    imgIcon: saomiaoIcon,
    bgColor: '#FFF3E0',
    onClick: () => openMiniProgram('wx9a1d82a0e399420a')
  },
  {
    name: 'AI启蒙',
    imgIcon: aiIcon,
    bgColor: '#E3F2FD',
    onClick: () => {
      Taro.navigateTo({
        url: `/pages/webview/index?src=${encodeURIComponent('https://mp.weixin.qq.com/s/w2cyWKW2kIgQfGr6e1Deng')}&title=${encodeURIComponent('AI启蒙')}`
      })
    }
  },
  {
    name: '学平险',
    imgIcon: xuepingxianIcon,
    bgColor: '#F3E5F5',
    onClick: () => openMiniProgram('wxe186f230ce102b30', 'pages/middle/middle?id=1098274')
  },
  {
    name: '古诗词',
    imgIcon: gushiciIcon,
    bgColor: '#FFEBEE',
    onClick: () => openMiniProgram(GUSHICI_APP_ID)
  }
]

export default function ToolsPage () {
  const windowInfo = Taro.getWindowInfo()
  const menuButtonInfo = Taro.getMenuButtonBoundingClientRect()

  const statusBarHeight = windowInfo.statusBarHeight || 0
  const rawNavBar =
    (menuButtonInfo.top - statusBarHeight) * 2 + (menuButtonInfo.height || 0)
  const navBarHeight =
    Number.isFinite(rawNavBar) && rawNavBar > 0 ? rawNavBar : 88

  useDidShow(() => {
    tabState.setVisible(true)
    tabState.setSelected(1)
  })

  // 小星愿入口
  const goXiaoxinyuan = () => {
    Taro.navigateTo({ url: ROUTES.WISH_HOME })
  }

  // 孩子AI启蒙入口（公众号文章）
  const goAiQimeng = () => {
    Taro.navigateTo({
      url: `/pages/webview/index?src=${encodeURIComponent('https://mp.weixin.qq.com/s/w2cyWKW2kIgQfGr6e1Deng')}&title=${encodeURIComponent('孩子AI启蒙')}`
    })
  }

  return (
    <View className='page-container'>
      {/* 自定义导航栏背景 */}
      <View className='custom-nav-bg' />

      {/* 自定义导航栏内容 */}
      <View
        className='custom-nav-bar'
        style={{
          paddingTop: `${menuButtonInfo.top}px`,
          paddingRight: `${windowInfo.windowWidth - menuButtonInfo.left}px`
        }}
      >
        <View className='nav-title-wrap'>
          <View className='explore-header'>
            <Text className='explore-title'>💡探索世界</Text>
            <Text className='explore-subtitle'>陪伴孩子成长～</Text>
          </View>
        </View>
      </View>

      <View
        style={{ flexShrink: 0, height: `${statusBarHeight + navBarHeight}px` }}
      />
      <View className='content'>
        <View className='section-title'>百宝箱</View>
        <View className='tools-grid'>
          {toolList.map(item => (
            <View key={item.name} className='tool-card' onClick={item.onClick}>
              <View
                className='tool-icon-wrap'
                // style={{ background: item.bgColor }}
              >
                {item.imgIcon ? (
                  <Image
                    className='tool-img-icon'
                    src={item.imgIcon}
                    mode='aspectFit'
                  />
                ) : (
                  <Text
                    className='iconfont tool-icon'
                    style={{ color: item.iconColor }}
                  >
                    {item.icon}
                  </Text>
                )}
              </View>
              <Text className='tool-name'>{item.name}</Text>
            </View>
          ))}
        </View>

        <View className='section-header'>
          <Text className='section-title'>成长护航</Text>
        </View>

        <View className='entry-card' onClick={goXiaoxinyuan}>
          <Image className='entry-icon' src={starIcon} mode='aspectFit' />
          <View className='entry-info'>
            <Text className='entry-name'>小星愿</Text>
            <Text className='entry-desc'>记录孩子努力的过程</Text>
          </View>
          <Text className='entry-arrow'>›</Text>
        </View>

        <View className='entry-card' onClick={goAiQimeng}>
          <Image className='entry-icon' src={aiQimengIcon} mode='aspectFit' />
          <View className='entry-info'>
            <Text className='entry-name'>孩子AI启蒙</Text>
            <Text className='entry-desc'>5天打卡计划，萌芽心智</Text>
          </View>
          <Text className='entry-arrow'>›</Text>
        </View>
      </View>
    </View>
  )
}
