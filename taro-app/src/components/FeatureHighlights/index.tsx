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
  { icon: '\ue759', name: '随时查看', desc: '多种方式录入课程' },
  { icon: '\ue696', name: '课周定位', desc: '单/双周课程轻松记' },
  { icon: '\ue600', name: '多孩管理', desc: '多个孩子课表轻松管理' },
  { icon: '\ue729', name: '课表共享', desc: '家人共同管理课表' },
]

export default function FeatureHighlights({
  title = '',
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
