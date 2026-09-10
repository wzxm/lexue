import { Component } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { tabState } from '../utils/tabState'
import { ROUTES } from '../constants/routes'
import './index.scss'

const LIST = [
  { pagePath: '/pages/schedule/index', text: '课表', icon: '\ue696' },
  // { pagePath: '/pages/tools/index', text: '工具', icon: '\ue6ad' },
  { pagePath: '/pages/settings/index', text: '设置', icon: '\ue657' },
]

export default class CustomTabBar extends Component {
  private unsubscribe: (() => void) | null = null
  private unsubscribeVisible: (() => void) | null = null
  private unsubscribeBanner: (() => void) | null = null

  state = {
    selected: tabState.current,
    visible: tabState.visible,
    familyShareBanner: tabState.familyShareBanner,
  }

  private normalizeRoute(route?: string) {
    const raw = (route || '').split('?')[0]
    return `/${raw.replace(/^\/+/, '')}`
  }

  private getSelectedFromRoute() {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const route = this.normalizeRoute(current?.route)
    const idx = LIST.findIndex((item) => item.pagePath === route)
    return idx >= 0 ? idx : null
  }

  private syncSelectedFromRoute() {
    const idx = this.getSelectedFromRoute()
    if (idx === null) return
    if (idx !== this.state.selected) {
      this.setState({ selected: idx })
    }
    if (idx !== tabState.current) {
      tabState.setSelected(idx)
    }
  }

  componentDidMount() {
    this.syncSelectedFromRoute()

    this.unsubscribe = tabState.subscribe((idx) => {
      if (idx !== this.state.selected) {
        this.setState({ selected: idx })
      }
    })

    this.unsubscribeVisible = tabState.subscribeVisible((visible) => {
      if (visible !== this.state.visible) {
        this.setState({ visible })
      }
    })

    this.unsubscribeBanner = tabState.subscribeFamilyShareBanner((familyShareBanner) => {
      if (familyShareBanner !== this.state.familyShareBanner) {
        this.setState({ familyShareBanner })
      }
    })
  }

  componentDidShow() {
    this.syncSelectedFromRoute()
  }

  componentWillUnmount() {
    this.unsubscribe?.()
    this.unsubscribeVisible?.()
    this.unsubscribeBanner?.()
  }

  switchTab = (idx: number, url: string) => {
    tabState.setSelected(idx)
    Taro.switchTab({ url })
  }

  closeFamilyShareBanner = () => {
    tabState.setFamilyShareBanner(false)
  }

  handleInviteFamily = () => {
    tabState.setFamilyShareBanner(false)
    Taro.navigateTo({ url: `${ROUTES.FAMILY_MANAGE}?autoInvite=1` })
  }

  render() {
    const { selected, visible, familyShareBanner } = this.state
    if (!visible) return null

    return (
      <View className='custom-tab-bar'>
        {familyShareBanner && (
          <View className='tab-family-banner'>
            <Text className='tab-family-banner-text'>可以共享课表给家人哦~</Text>
            <View className='tab-family-banner-actions'>
              <View className='tab-family-banner-btn tab-family-banner-btn--ghost' onClick={this.closeFamilyShareBanner}>
                <Text className='tab-family-banner-btn-text'>关闭</Text>
              </View>
              <View className='tab-family-banner-btn tab-family-banner-btn--primary' onClick={this.handleInviteFamily}>
                <Text className='tab-family-banner-btn-text tab-family-banner-btn-text--primary'>邀请</Text>
              </View>
            </View>
          </View>
        )}
        <View className='tab-items-row'>
          {LIST.map((item, idx) => (
            <View
              key={item.pagePath}
              className={`tab-item ${selected === idx ? 'tab-item--active' : ''}`}
              onClick={() => this.switchTab(idx, item.pagePath)}
            >
              <Text className='iconfont tab-icon'>{item.icon}</Text>
              <Text className='tab-text'>{item.text}</Text>
            </View>
          ))}
        </View>
      </View>
    )
  }
}
