import { View, Button } from '@tarojs/components'
import FeatureHighlights from '../../../components/FeatureHighlights'

interface Props {
  onAddCourse: () => void;
  onCopySchedule: () => void;
}

export default function EmptyState({ onAddCourse, onCopySchedule }: Props) {
  return (
    <View className='empty-content'>
      <FeatureHighlights />
      <View className='empty-actions'>
        <Button className='create-btn' onClick={onAddCourse}>创建课表</Button>
        <Button className='copy-schedule-btn' onClick={onCopySchedule}>复制同学课表</Button>
      </View>
    </View>
  )
}
