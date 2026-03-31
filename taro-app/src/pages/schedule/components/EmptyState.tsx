import { View, Text, Button } from '@tarojs/components'

interface Props {
  onAddCourse: () => void;
}

export default function EmptyState({ onAddCourse }: Props) {
  return (
    <View className='empty-content'>
      <View className='guide-subtitle'>课表亮点功能</View>
      <View className='feature-grid'>
        {[
          { icon: '\ue759', name: '微信通知', desc: '提前提醒家人接送' },
          { icon: '\ue729', name: '课表共享', desc: '家人随时查看孩子课程' },
          { icon: '\ue696', name: '课周定位', desc: '不怕单双周记不住' },
          { icon: '\ue600', name: '多孩管理', desc: '多个孩子课表轻松管理' },
        ].map(f => (
          <View key={f.name} className='feature-item'>
            <View className='feature-icon-wrap'>
              <Text className='iconfont feature-icon'>{f.icon}</Text>
            </View>
            <Text className='feature-name'>{f.name}</Text>
            <Text className='feature-desc'>{f.desc}</Text>
          </View>
        ))}
      </View>
      <Button className='create-btn' onClick={onAddCourse}>创建课表 (约耗时1分钟)</Button>
    </View>
  )
}
