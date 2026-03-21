import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

interface Tool {
  name: string
  icon: string
  available: boolean
  bgColor: string
  iconColor: string
}

const toolList: Tool[] = [
  { name: '作业提醒', icon: '\ue601', available: false, bgColor: '#FFF3E0', iconColor: '#FF9800' },
  { name: '考试日历', icon: '\ue602', available: false, bgColor: '#E3F2FD', iconColor: '#2196F3' },
  { name: '假期日历', icon: '\ue603', available: false, bgColor: '#F3E5F5', iconColor: '#9C27B0' },
  { name: '成绩记录', icon: '\ue604', available: false, bgColor: '#E8F5E9', iconColor: '#4CAF50' },
  { name: '课表模板', icon: '\ue605', available: false, bgColor: '#FFEBEE', iconColor: '#E91E63' },
  { name: '家校通知', icon: '\ue606', available: false, bgColor: '#E1F5FE', iconColor: '#03A9F4' },
]

export default function ToolsPage() {
  const handleTool = (tool: Tool) => {
    if (!tool.available) {
      Taro.showToast({ title: '即将上线，敬请期待', icon: 'none', duration: 2000 })
    }
  }

  return (
    <View className='page'>
      <View className='page-header'>
        <Text className='page-title'>百宝箱</Text>
        <Text className='page-subtitle'>更多好用工具，助力学习成长</Text>
      </View>

      <View className='tools-grid'>
        {toolList.map((item) => (
          <View key={item.name} className='tool-card' onClick={() => handleTool(item)}>
            <View className='tool-icon-wrap' style={{ background: item.bgColor }}>
              <Text className='iconfont tool-icon' style={{ color: item.iconColor }}>{item.icon}</Text>
            </View>
            <Text className='tool-name'>{item.name}</Text>
            {!item.available ? (
              <View className='coming-badge'>
                <Text className='coming-text'>即将上线</Text>
              </View>
            ) : (
              <View className='available-badge'>
                <Text className='available-text'>可用</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}
