import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow, useShareAppMessage, useUnload } from '@tarojs/taro'
import { tabState } from '../../utils/tabState'
import { ROUTES } from '../../constants/routes'
import { SETTINGS_AD_BANNER_MINI_PROGRAM } from '../../constants/external-mini-programs'
import { useAuthStore } from '../../store/auth.store'
import { getSettingsSummary, type SettingsSummary } from '../../api/auth.api'
import defaultAvatar from '../../assets/default-avatar.png'
import shareCover from '../../assets/share.png'
import {
  getDisplayAvatarUrl,
  isCloudFileId,
  resolveCloudAvatarUrl,
} from '../../utils/avatar'
import AccountMenuSheet from './components/AccountMenuSheet'
import ContactModal from './components/ContactModal'
import EditProfileModal from './components/EditProfileModal'
import SettingsContent from './components/SettingsContent'
import SettingsHeader from './components/SettingsHeader'
import { type MenuRow } from './settingsMenu'
import './index.scss'

const CONTACT_TEXT = '📮email：up91@foxmail.com\n✉️微信号：atgoing'

function useNavLayout() {
  return useMemo(() => {
    const windowInfo = Taro.getWindowInfo()
    const menuButtonInfo = Taro.getMenuButtonBoundingClientRect()
    const statusBarHeight = windowInfo.statusBarHeight || 0
    const navBarHeight = (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height

    return {
      navBarStyle: {
        paddingTop: `${menuButtonInfo.top}px`,
        paddingRight: `${windowInfo.windowWidth - menuButtonInfo.left}px`,
      },
      spacerStyle: {
        flexShrink: 0,
        height: `${statusBarHeight + navBarHeight}px`,
      },
    }
  }, [])
}

export default function SettingsPage() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const userInfo = useAuthStore(s => s.userInfo)
  const logout = useAuthStore(s => s.logout)
  const [activeSheet, setActiveSheet] = useState<'none' | 'menu' | 'rename'>('none')
  const [settingsSummary, setSettingsSummary] = useState<SettingsSummary | null>(null)
  const [contactVisible, setContactVisible] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState(defaultAvatar)
  const { navBarStyle, spacerStyle } = useNavLayout()

  useShareAppMessage(() => ({
    title: 'AI一键导入，告别纸质课表',
    path: ROUTES.SCHEDULE,
    imageUrl: shareCover,
  }))

  const loadSettingsSummary = useCallback(async () => {
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
  }, [isLoggedIn])

  useDidShow(() => {
    tabState.setVisible(true)
    tabState.setSelected(1)
    loadSettingsSummary()
  })

  useDidHide(() => {
    tabState.setVisible(true)
  })

  useUnload(() => {
    tabState.setVisible(true)
  })

  const goLogin = useCallback(() => {
    Taro.navigateTo({ url: ROUTES.LOGIN })
  }, [])

  const handleUserClick = useCallback(() => {
    if (isLoggedIn) {
      tabState.setVisible(false)
      setActiveSheet('menu')
    }
  }, [isLoggedIn])

  const closeSheet = useCallback(() => {
    setActiveSheet('none')
    tabState.setVisible(true)
  }, [])

  const openRenameSheet = useCallback(() => {
    setActiveSheet('rename')
  }, [])

  const handleLogout = useCallback(() => {
    logout()
    setActiveSheet('none')
    tabState.setVisible(true)
  }, [logout])

  const onMenu = useCallback((row: MenuRow) => {
    if (!isLoggedIn) {
      Taro.navigateTo({ url: ROUTES.LOGIN })
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
      case 'feedback':
        setContactVisible(true)
        break
      case 'recommend':
        Taro.showToast({ title: '敬请期待', icon: 'none' })
        break
      default:
        break
    }
  }, [isLoggedIn])

  useEffect(() => {
    const raw = userInfo?.avatarUrl
    const syncSrc = getDisplayAvatarUrl(raw, defaultAvatar)
    if (!isCloudFileId(syncSrc)) {
      setAvatarSrc(syncSrc)
      return
    }

    let cancelled = false
    void resolveCloudAvatarUrl(syncSrc)
      .then((url) => {
        if (!cancelled) setAvatarSrc(url)
      })
      .catch(() => {
        if (!cancelled) setAvatarSrc(defaultAvatar)
      })

    return () => {
      cancelled = true
    }
  }, [userInfo?.avatarUrl])

  const openIdTip = userInfo?.openId ? `id:${userInfo.openId.slice(0, 6)}*** ▾` : '点击管理账号 ▾'
  const nickname = userInfo?.nickname || '微信昵称限6字...'

  const closeContactModal = useCallback(() => setContactVisible(false), [])

  const handleCopyContact = useCallback(async () => {
    try {
      await Taro.setClipboardData({ data: CONTACT_TEXT })
      Taro.showToast({ title: '联系方式已复制', icon: 'success' })
      setContactVisible(false)
    } catch {
      Taro.showToast({ title: '复制失败，请稍后再试', icon: 'none' })
    }
  }, [])

  const handleGuestBannerClick = useCallback(() => {
    const { appId, path } = SETTINGS_AD_BANNER_MINI_PROGRAM
    Taro.navigateToMiniProgram({ appId, path, fail: () => {} })
  }, [])

  return (
    <View className={`settings-page ${!isLoggedIn ? 'settings-page--guest' : ''}`}>
      <SettingsHeader
        isLoggedIn={isLoggedIn}
        avatarSrc={avatarSrc}
        nickname={nickname}
        openIdTip={openIdTip}
        navBarStyle={navBarStyle}
        spacerStyle={spacerStyle}
        onGoLogin={goLogin}
        onUserClick={handleUserClick}
      />

      <SettingsContent
        settingsSummary={settingsSummary}
        onMenu={onMenu}
        onGuestBannerClick={handleGuestBannerClick}
      />

      <AccountMenuSheet
        visible={activeSheet === 'menu'}
        onClose={closeSheet}
        onEditProfile={openRenameSheet}
        onLogout={handleLogout}
      />

      <EditProfileModal visible={activeSheet === 'rename'} onClose={closeSheet} />

      <ContactModal visible={contactVisible} onClose={closeContactModal} onCopy={handleCopyContact} />
    </View>
  )
}
