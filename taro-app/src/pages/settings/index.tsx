import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ROUTES } from '../../constants/routes'
import './index.scss'

interface MenuItem {
  label: string
  route: string
  icon: string
}

const menuItems: MenuItem[] = [
  { label: '学生管理', route: ROUTES.STUDENT_FORM, icon: '👤' },
  { label: '家人管理', route: ROUTES.FAMILY_MANAGE, icon: '👨‍👩‍👧' },
  { label: '通知提醒', route: ROUTES.NOTIFICATION_SETTINGS, icon: '🔔' },
  { label: '分享课表', route: ROUTES.SHARE_CODE, icon: '📤' },
]

export default function SettingsPage() {
  const onNavigate = (route: string) => {
    Taro.navigateTo({ url: route })
  }

  return (
    <View className='settings-page'>
      <View className='user-card'>
        <View className='user-avatar'>
          <Text className='user-avatar-text'>我</Text>
        </View>
        <View className='user-info'>
          <Text className='user-name'>我的课表</Text>
          <Text className='user-sub'>管理家人与学生信息</Text>
        </View>
        <Text className='user-card-arrow'>›</Text>
      </View>

      <View className='menu-list'>
        {menuItems.map((item) => (
          <View
            key={item.label}
            className='menu-item'
            onClick={() => onNavigate(item.route)}
          >
            <View className='menu-item-left'>
              <View className='menu-icon-wrap'>
                <Text className='menu-icon'>{item.icon}</Text>
              </View>
              <Text className='menu-label'>{item.label}</Text>
            </View>
            <Text className='menu-arrow'>›</Text>
          </View>
        ))}
      </View>

      <View className='version-area'>
        <Text className='version-text'>乐学课表 v1.0.0</Text>
      </View>
    </View>
  )
}
