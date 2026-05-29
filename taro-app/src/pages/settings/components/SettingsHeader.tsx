import { memo } from 'react'
import { View, Text, Image } from '@tarojs/components'
import type { CSSProperties } from 'react'
import defaultAvatar from '../../../assets/default-avatar.png'

interface SettingsHeaderProps {
  isLoggedIn: boolean
  avatarSrc: string
  nickname: string
  openIdTip: string
  navBarStyle: CSSProperties
  spacerStyle: CSSProperties
  onGoLogin: () => void
  onUserClick: () => void
}

function SettingsHeader({
  isLoggedIn,
  avatarSrc,
  nickname,
  openIdTip,
  navBarStyle,
  spacerStyle,
  onGoLogin,
  onUserClick,
}: SettingsHeaderProps) {
  return (
    <>
      <View className='custom-nav-bg' />
      <View className='custom-nav-bar' style={navBarStyle}>
        <View className='nav-title-wrap'>
          {!isLoggedIn ? (
            <View className='user-info-nav' onClick={onGoLogin}>
              <View className='guest-avatar-small'>
                <Image className='guest-avatar-small-img' src={defaultAvatar} mode='aspectFill' />
              </View>
              <View className='user-text'>
                <Text className='name'>登录注册</Text>
                <Text className='school'>等你来用～</Text>
              </View>
            </View>
          ) : (
            <View className='user-info-nav' onClick={onUserClick}>
              <Image className='avatar-img' src={avatarSrc} mode='aspectFill' />
              <View className='user-text'>
                <View className='name-row'>
                  <Text className='name'>{nickname}</Text>
                </View>
                <Text className='school'>{openIdTip}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
      <View style={spacerStyle} />
    </>
  )
}

export default memo(SettingsHeader)
