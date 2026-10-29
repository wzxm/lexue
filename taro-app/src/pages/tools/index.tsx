import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { tabState } from '../../utils/tabState'
import { ROUTES } from '../../constants/routes'
import ziliaoIcon from '../../assets/ziliao.svg'
import starIcon from '../../assets/xiaoxinyuan-star.png'
import './index.scss'

interface Tool {
  name: string
  icon?: string
  imgIcon?: string
  bgColor: string
  iconColor?: string
}

const toolList: Tool[] = [
  {
    name: '视力测试',
    icon: '\ue603',
    bgColor: '#FFF3E0',
    iconColor: '#FF9800'
  },
  {
    name: '学生赛事',
    icon: '\ue602',
    bgColor: '#E3F2FD',
    iconColor: '#2196F3'
  },
  { name: '学平险', icon: '\ue601', bgColor: '#F3E5F5', iconColor: '#9C27B0' },
  { name: '练习资料', imgIcon: ziliaoIcon, bgColor: '#FFEBEE' }
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
            <View key={item.name} className='tool-card'>
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
          <Text className='section-title'>大家在看</Text>
        </View>

        <View className='entry-card' onClick={goXiaoxinyuan}>
          <Image className='entry-icon' src={starIcon} mode='aspectFit' />
          <View className='entry-info'>
            <Text className='entry-name'>小星愿</Text>
            <Text className='entry-desc'>记录孩子努力的过程</Text>
          </View>
          <Text className='entry-arrow'>›</Text>
        </View>
      </View>
    </View>
  )
}
