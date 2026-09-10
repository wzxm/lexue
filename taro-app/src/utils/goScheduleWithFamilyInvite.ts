import Taro from '@tarojs/taro'
import { ROUTES } from '../constants/routes'
import { tabState } from './tabState'

/** 进入课表 Tab 并展示底部「邀请家人」引导（与复制课表成功流程一致） */
export function goScheduleWithFamilyInvite() {
  tabState.setFamilyShareBanner(true)
  Taro.switchTab({ url: ROUTES.SCHEDULE })
}
