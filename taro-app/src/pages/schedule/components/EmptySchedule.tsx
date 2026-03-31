import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ROUTES } from '../../../constants/routes'
import type { Schedule } from '../../../types/index'

interface Props {
  currentSchedule: Schedule | null;
}

export default function EmptySchedule({ currentSchedule }: Props) {
  return (
    <View className="empty-schedule-view">
      <Text className="step2-title">选择添加课程方式</Text>
      <View className="section">
        <View className="list-item" onClick={() => Taro.showToast({ title: "功能开发中", icon: "none" })}>
          <Text className="list-label">照片</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">OCR识别</Text>
            <Text className="list-arrow">›</Text>
          </View>
        </View>
        <View className="divider" />
        <View className="list-item" onClick={() => Taro.showToast({ title: "功能开发中", icon: "none" })}>
          <Text className="list-label">Excel</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">AI识别</Text>
            <Text className="list-arrow">›</Text>
          </View>
        </View>
        <View className="divider" />
        <View className="list-item" onClick={() => Taro.navigateTo({ url: ROUTES.COPY_SCHEDULE })}>
          <Text className="list-label">复制课表</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">输入口令复制</Text>
            <Text className="list-arrow">›</Text>
          </View>
        </View>
        <View className="divider" />
        <View
          className="list-item"
          onClick={() => {
            if (currentSchedule?.id) Taro.navigateTo({ url: `${ROUTES.COURSE_FORM}?mode=add&scheduleId=${currentSchedule.id}` });
          }}
        >
          <Text className="list-label">手动添加课程</Text>
          <View className="list-right">
            <Text className="list-arrow">›</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
