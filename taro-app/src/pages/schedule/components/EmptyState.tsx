import { View, Button } from '@tarojs/components'
import FeatureHighlights from '../../../components/FeatureHighlights'

interface Props {
  onAddCourse: () => void;
}

export default function EmptyState({ onAddCourse }: Props) {
  return (
    <View className='empty-content'>
      <FeatureHighlights />
      <Button className='create-btn' onClick={onAddCourse}>创建课表</Button>
    </View>
  )
}
