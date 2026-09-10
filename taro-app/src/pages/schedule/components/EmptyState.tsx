import { View, Button, Text } from '@tarojs/components'
import FeatureHighlights from '../../../components/FeatureHighlights'

interface Props {
  onAddCourse: () => void;
  onCopySchedule: () => void;
}

export default function EmptyState({ onAddCourse, onCopySchedule }: Props) {
  return (
    <View className='empty-content'>
      <FeatureHighlights />
      <Button className='create-btn' onClick={onAddCourse}>创建课表</Button>
      <Text className='copy-schedule-link' onClick={onCopySchedule}>复制同学课表</Text>
    </View>
  )
}
