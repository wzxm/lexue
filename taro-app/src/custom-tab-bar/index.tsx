import { Component } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { tabState } from '../utils/tabState'
import './index.scss'

const LIST = [
  { pagePath: '/pages/schedule/index', text: '课表', icon: '\ue696' },
  { pagePath: '/pages/tools/index', text: '工具', icon: '\ue6ad' },
  { pagePath: '/pages/settings/index', text: '设置', icon: '\ue657' },
]

export default class CustomTabBar extends Component {
  private unsubscribe: (() => void) | null = null
  private unsubscribeVisible: (() => void) | null = null

  state = {
    selected: tabState.current,
    visible: tabState.visible,
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
  }

  componentDidShow() {
    this.syncSelectedFromRoute()
  }

  componentWillUnmount() {
    this.unsubscribe?.()
    this.unsubscribeVisible?.()
  }

  switchTab = (idx: number, url: string) => {
    tabState.setSelected(idx)
    Taro.switchTab({ url })
  }

  render() {
    const { selected, visible } = this.state
    if (!visible) return null

    return (
      <View className='custom-tab-bar'>
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
    )
  }
}
