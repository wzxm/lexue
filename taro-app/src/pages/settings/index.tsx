import { useState } from 'react'
import { View, Text, PageContainer, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidHide, useDidShow, useUnload } from '@tarojs/taro'
import { tabState } from '../../utils/tabState'
import { ROUTES } from '../../constants/routes'
import { useAuthStore } from '../../store/auth.store'
import { getSettingsSummary, type SettingsSummary, updateProfile } from '../../api/auth.api'
import defaultAvatar from '../../assets/default-avatar.png'
import './index.scss'

type MenuKey = 'notify' | 'family' | 'scheduleTab' | 'studentManage' | 'student' | 'shareSchedule' | 'feedback' | 'recommend'

interface MenuRow {
  key: MenuKey
  label: string
  icon: string
}

const menuRows: MenuRow[] = [
  { key: 'notify', label: '通知提醒', icon: '\ue759' },
  { key: 'family', label: '家人管理', icon: '\ue600' },
  { key: 'scheduleTab', label: '课表管理', icon: '\ue696' },
  { key: 'studentManage', label: '学生管理', icon: '\ue706' },
  // { key: 'student', label: '展示管理', icon: '\ue706' },
  { key: 'shareSchedule', label: '分享课表', icon: '\ue729' },
  { key: 'feedback', label: '意见反馈', icon: '\ue759' },
  // { key: 'recommend', label: '推荐小程序', icon: '\ue729' },
]

function menuSuffix(row: MenuRow, summary: SettingsSummary | null): string {
  if (!summary) return ''
  switch (row.key) {
    case 'notify':
      return summary.notifyAnyEnabled ? '开' : '关'
    case 'family':
      return `${summary.familyMemberCount}位`
    case 'scheduleTab':
      return `${summary.scheduleCount}张`
    case 'studentManage':
      return `${summary.studentCount}位`
    default:
      return ''
  }
}

export default function SettingsPage() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const userInfo = useAuthStore(s => s.userInfo)
  const setUserInfo = useAuthStore(s => s.setUserInfo)
  const logout = useAuthStore(s => s.logout)
  const [activeSheet, setActiveSheet] = useState<'none' | 'menu' | 'rename'>('none')
  const [renaming, setRenaming] = useState(false)
  const [updatingAvatar, setUpdatingAvatar] = useState(false)
  const [draftNickname, setDraftNickname] = useState('')
  const [settingsSummary, setSettingsSummary] = useState<SettingsSummary | null>(null)

  const loadSettingsSummary = async () => {
    if (!isLoggedIn) {
      setSettingsSummary(null)
      return
    }
    try {
      const data = await getSettingsSummary()
      setSettingsSummary(data)
    } catch {
      setSettingsSummary(null)
    }
  }

  useDidShow(() => {
    tabState.setVisible(true)
    tabState.setSelected(2)
    loadSettingsSummary()
  })

  useDidHide(() => {
    tabState.setVisible(true)
  })

  useUnload(() => {
    tabState.setVisible(true)
  })

  const windowInfo = Taro.getWindowInfo()
  const menuButtonInfo = Taro.getMenuButtonBoundingClientRect()

  const statusBarHeight = windowInfo.statusBarHeight || 0
  const navBarHeight = (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height

  const goLogin = () => {
    Taro.navigateTo({ url: ROUTES.LOGIN })
  }

  const handleUserClick = () => {
    if (isLoggedIn) {
      tabState.setVisible(false)
      setActiveSheet('menu')
    }
  }

  const closeSheet = () => {
    setActiveSheet('none')
    tabState.setVisible(true)
  }

  const openRenameSheet = () => {
    setDraftNickname(userInfo?.nickname || '')
    setActiveSheet('rename')
  }

  const handleLogout = () => {
    logout()
    closeSheet()
  }

  const handleRename = async () => {
    if (renaming) return
    const nickname = draftNickname.trim()
    if (!nickname) {
      Taro.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    if (nickname.length > 20) {
      Taro.showToast({ title: '名称最多20个字', icon: 'none' })
      return
    }
    setRenaming(true)
    try {
      const profile = await updateProfile({ nickname })
      setUserInfo(profile)
      Taro.showToast({ title: '名称已更新', icon: 'success' })
      closeSheet()
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '修改失败', icon: 'none' })
    } finally {
      setRenaming(false)
    }
  }

  const handleChooseAvatar = async (e: any) => {
    if (updatingAvatar) return
    const avatarUrl = e?.detail?.avatarUrl || ''
    if (!avatarUrl) {
      Taro.showToast({ title: '未获取到头像', icon: 'none' })
      return
    }
    setUpdatingAvatar(true)
    try {
      const profile = await updateProfile({ avatarUrl })
      setUserInfo(profile)
      Taro.showToast({ title: '头像已更新', icon: 'success' })
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '头像更新失败', icon: 'none' })
    } finally {
      setUpdatingAvatar(false)
    }
  }

  const onMenu = (row: MenuRow) => {
    if (!isLoggedIn) {
      goLogin()
      return
    }
    switch (row.key) {
      case 'notify':
        Taro.navigateTo({ url: ROUTES.NOTIFICATION_SETTINGS })
        break
      case 'family':
        Taro.navigateTo({ url: ROUTES.FAMILY_MANAGE })
        break
      case 'scheduleTab':
        Taro.navigateTo({ url: ROUTES.SCHEDULE_MANAGE })
        break
      case 'studentManage':
        Taro.navigateTo({ url: ROUTES.STUDENT_MANAGE })
        break
      case 'student':
        Taro.navigateTo({ url: ROUTES.DISPLAY_SETTINGS })
        break
      case 'shareSchedule':
        Taro.navigateTo({ url: ROUTES.SHARE_SCHEDULE })
        break
      case 'feedback':
        Taro.showToast({ title: '敬请期待', icon: 'none' })
        break
      case 'recommend':
        Taro.showToast({ title: '敬请期待', icon: 'none' })
        break
      default:
        break
    }
  }

  const avatarUrl = userInfo?.avatarUrl || defaultAvatar
  const openIdTip = userInfo?.openId ? `id:${userInfo.openId.slice(0, 6)}*** ▾` : '点击管理账号 ▾'

  return (
    <View className={`settings-page ${!isLoggedIn ? 'settings-page--guest' : ''}`}>
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
          {!isLoggedIn ? (
            <View className='user-info-nav' onClick={goLogin}>
              <View className='guest-avatar-small'>
                <Image className='guest-avatar-small-img' src={defaultAvatar} mode='aspectFill' />
              </View>
              <View className='user-text'>
                <Text className='name'>登录注册</Text>
                <Text className='school'>等你来用～</Text>
              </View>
            </View>
          ) : (
            <View className='user-info-nav' onClick={handleUserClick}>
              <Image className='avatar-img' src={avatarUrl} mode='aspectFill' />
              <View className='user-text'>
                <View className='name-row'>
                  <Text className='name'>{userInfo?.nickname || '微信昵称限6字...'}</Text>
                </View>
                <Text className='school'>{openIdTip}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={{ flexShrink: 0, height: `${statusBarHeight + navBarHeight}px` }} />
      <View className='content'>
        <View className='guest-top'>
          <View className='guest-banner'>
            <Text className='iconfont guest-banner-icon'>{'\ue759'}</Text>
            <Text className='guest-banner-title'>广告banner 占位示意</Text>
            <Text className='guest-banner-text'>示意图</Text>
          </View>
        </View>

        <View className='menu-list'>
        <View className='menu-list-group'>
          {menuRows.slice(0, 4).map((row) => {
            const suffix = menuSuffix(row, settingsSummary)
            return (
            <View key={row.key} className='menu-item' onClick={() => onMenu(row)}>
              <View className='menu-item-left'>
                <View className='menu-icon-wrap'>
                  <Text className='iconfont menu-icon'>{row.icon}</Text>
                </View>
                <Text className='menu-label'>{row.label}</Text>
              </View>
              <View className='menu-item-right'>
                {suffix ? <Text className='menu-suffix'>{suffix}</Text> : null}
                <Text className='menu-arrow'>›</Text>
              </View>
            </View>
            )
          })}
        </View>

        <View className='menu-list-group'>
          {menuRows.slice(4).map((row) => {
            const suffix = menuSuffix(row, settingsSummary)
            return (
            <View key={row.key} className='menu-item' onClick={() => onMenu(row)}>
              <View className='menu-item-left'>
                <View className='menu-icon-wrap'>
                  <Text className='iconfont menu-icon'>{row.icon}</Text>
                </View>
                <Text className='menu-label'>{row.label}</Text>
              </View>
              <View className='menu-item-right'>
                {suffix ? <Text className='menu-suffix'>{suffix}</Text> : null}
                <Text className='menu-arrow'>›</Text>
              </View>
            </View>
            )
          })}
        </View>
      </View>

      <View className='version-area'>
        <Text className='version-text'>乐学课表 v1.0.0</Text>
      </View>
      </View>

      {/* 退出登录弹窗 */}
      <PageContainer
        show={activeSheet !== 'none'}
        position='bottom'
        round
        zIndex={1000}
        onClickOverlay={closeSheet}
      >
        {activeSheet === 'menu' ? (
          <View className='logout-sheet-content'>
            <View className='logout-btn' onClick={openRenameSheet}>
              <Text className='iconfont logout-icon'>&#xe729;</Text>
              <Text className='logout-text'>修改资料</Text>
            </View>
            <View className='logout-btn' onClick={handleLogout}>
              <Text className='iconfont logout-icon'>&#xe759;</Text>
              <Text className='logout-text'>退出登录</Text>
            </View>
            <View className='logout-cancel' onClick={closeSheet}>
              取消
            </View>
          </View>
        ) : (
          <View className='rename-sheet-content'>
            <Text className='rename-title'>修改资料</Text>
            <View className='rename-avatar-row'>
              <Image className='rename-avatar-img' src={avatarUrl} mode='aspectFill' />
              <Button
                className='rename-avatar-btn'
                openType='chooseAvatar'
                loading={updatingAvatar}
                onChooseAvatar={handleChooseAvatar}
              >
                {updatingAvatar ? '同步中...' : '同步微信头像'}
              </Button>
            </View>
            <Input
              className='rename-input'
              maxlength={20}
              value={draftNickname}
              placeholder='请输入新名称'
              onInput={(e) => setDraftNickname(e.detail.value)}
            />
            <View className='rename-actions'>
              <View className='rename-cancel' onClick={closeSheet}>
                取消
              </View>
              <View className='rename-confirm' onClick={handleRename}>
                {renaming ? '保存中...' : '保存'}
              </View>
            </View>
          </View>
        )}
      </PageContainer>
    </View>
  )
}
