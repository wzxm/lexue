import { View, Text, Image, Button } from '@tarojs/components'
import FeatureHighlights from '../../../components/FeatureHighlights'
import guideIcon from '../../../assets/guide-icon.png'

interface Props {
  onAddCourse: () => void;
  onCopySchedule: () => void;
  onOpenGuide: () => void;
}

export default function EmptyState({ onAddCourse, onCopySchedule, onOpenGuide }: Props) {
  return (
    <View className='empty-content'>
      <FeatureHighlights />
      <View className='empty-actions'>
        <Button className='create-btn' onClick={onAddCourse}>创建课表</Button>
        <Button className='copy-schedule-btn' onClick={onCopySchedule}>复制同学课表</Button>
      </View>
      <View className='empty-guide' onClick={onOpenGuide}>
        <Text className='empty-guide-text'>使用指南</Text>
        <Image className='empty-guide-icon' src={guideIcon} mode='aspectFit' />
      </View>
    </View>
  )
}
