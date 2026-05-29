import { memo, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import './AccountMenuSheet.scss'

interface AccountMenuSheetProps {
  visible: boolean
  onClose: () => void
  onEditProfile: () => void
  onLogout: () => void
}

function AccountMenuSheet({ visible, onClose, onEditProfile, onLogout }: AccountMenuSheetProps) {
  const [rendered, setRendered] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (visible) {
      setRendered(true)
      const timer = setTimeout(() => setActive(true), 20)
      return () => clearTimeout(timer)
    }

    setActive(false)
  }, [visible])

  if (!rendered) return null

  return (
    <View
      className={`account-menu-mask ${active ? 'account-menu-mask--active' : ''}`}
      catchMove={active}
      onClick={active ? onClose : undefined}
    >
      <View
        className={`account-menu-panel ${active ? 'account-menu-panel--active' : ''}`}
        catchMove={active}
        onClick={(e) => e.stopPropagation()}
      >
        <View className='account-menu-content'>
          <View className='account-menu-btn' onClick={onEditProfile}>
            <Text className='iconfont account-menu-icon'>&#xe729;</Text>
            <Text className='account-menu-text'>修改资料</Text>
          </View>
          <View className='account-menu-btn' onClick={onLogout}>
            <Text className='iconfont account-menu-icon'>&#xe759;</Text>
            <Text className='account-menu-text'>退出登录</Text>
          </View>
          <View className='account-menu-cancel' onClick={onClose}>
            取消
          </View>
        </View>
      </View>
    </View>
  )
}

export default memo(AccountMenuSheet)
