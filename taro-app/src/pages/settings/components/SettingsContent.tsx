import { memo } from 'react'
import { View, Text, Image, Button } from '@tarojs/components'
import type { SettingsSummary } from '../../../api/auth.api'
import bannerImg from '../../../assets/banner.png'
import aiKidPlanIcon from '../../../assets/ai-kid-plan/entry-icon.png'
import { menuRows, menuSuffix, type MenuRow } from '../settingsMenu'

interface SettingsContentProps {
  settingsSummary: SettingsSummary | null
  onMenu: (row: MenuRow) => void
  onGuestBannerClick: () => void
  onAiKidPlanClick: () => void
}

interface MenuItemProps {
  row: MenuRow
  suffix: string
  onMenu: (row: MenuRow) => void
}

function MenuItem({ row, suffix, onMenu }: MenuItemProps) {
  const content = (
    <>
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
    </>
  )

  if (row.key === 'shareSchedule') {
    return (
      <View className='menu-item-wrap'>
        <Button className='menu-item menu-item--share-btn' openType='share'>
          {content}
        </Button>
      </View>
    )
  }

  return (
    <View className='menu-item' onClick={() => onMenu(row)}>
      {content}
    </View>
  )
}

function SettingsContent({ settingsSummary, onMenu, onGuestBannerClick, onAiKidPlanClick }: SettingsContentProps) {
  return (
    <View className='content'>
      <View className='guest-top'>
        <View
          className='guest-banner'
          hoverClass='guest-banner--pressed'
          onClick={onGuestBannerClick}
        >
          <Image className='guest-banner-img' src={bannerImg} mode='widthFix' />
        </View>
      </View>

      <View className='menu-list'>
        <View className='menu-list-group'>
          {menuRows.slice(0, 4).map((row) => (
            <MenuItem
              key={row.key}
              row={row}
              suffix={menuSuffix(row, settingsSummary)}
              onMenu={onMenu}
            />
          ))}
        </View>

        <View className='menu-list-group'>
          {menuRows.slice(4).map((row) => (
            <MenuItem
              key={row.key}
              row={row}
              suffix={menuSuffix(row, settingsSummary)}
              onMenu={onMenu}
            />
          ))}
        </View>
      </View>

      <View className='ai-plan-entry' hoverClass='ai-plan-entry--pressed' onClick={onAiKidPlanClick}>
        <Image className='ai-plan-entry__icon' src={aiKidPlanIcon} mode='aspectFit' />
        <View className='ai-plan-entry__content'>
          <Text className='ai-plan-entry__title'>AI启蒙计划 🎉</Text>
          <Text className='ai-plan-entry__desc'>5天学习计划，和孩子一起认识ai</Text>
        </View>
        <Text className='ai-plan-entry__arrow'>›</Text>
      </View>

      <View className='version-area'>
        <Text className='version-text'>v0.1.0 内测版本，如有疑问请联系我们</Text>
      </View>
    </View>
  )
}

export default memo(SettingsContent)
