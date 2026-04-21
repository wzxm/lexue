import { View, Text } from '@tarojs/components'
import './index.scss'

interface FeatureItem {
  icon: string
  name: string
  desc: string
}

interface Props {
  title?: string
  features?: FeatureItem[]
  className?: string
}

const DEFAULT_FEATURES: FeatureItem[] = [
  { icon: '\ue759', name: '微信通知', desc: '提前提醒家人接送' },
  { icon: '\ue729', name: '课表共享', desc: '家人随时查看孩子课程' },
  { icon: '\ue696', name: '课周定位', desc: '不怕单双周记不住' },
  { icon: '\ue600', name: '多孩管理', desc: '多个孩子课表轻松管理' },
]

export default function FeatureHighlights({
  title = '课表亮点功能',
  features = DEFAULT_FEATURES,
  className = '',
}: Props) {
  return (
    <View className={`feature-highlights ${className}`}>
      {title ? <View className='feature-highlights-title'>{title}</View> : null}
      <View className='feature-highlights-grid'>
        {features.map(f => (
          <View key={f.name} className='feature-highlights-item'>
            <View className='feature-highlights-icon-wrap'>
              <Text className='iconfont feature-highlights-icon'>{f.icon}</Text>
            </View>
            <Text className='feature-highlights-name'>{f.name}</Text>
            <Text className='feature-highlights-desc'>{f.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
