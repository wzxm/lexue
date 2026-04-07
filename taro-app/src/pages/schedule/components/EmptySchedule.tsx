import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ROUTES } from '../../../constants/routes'

interface Props {
  scheduleId?: string;
  /** true = redirectTo（替换页面栈），false = navigateTo（默认） */
  useRedirect?: boolean;
  onAddLater?: () => void;
  /** 隐藏顶部标题（作为弹窗内容时使用） */
  hideTitle?: boolean;
}

export default function EmptySchedule({ scheduleId, useRedirect, onAddLater, hideTitle }: Props) {
  const goToCourseForm = () => {
    if (!scheduleId) return
    const url = `${ROUTES.COURSE_FORM}?mode=add&scheduleId=${scheduleId}`
    useRedirect ? Taro.redirectTo({ url }) : Taro.navigateTo({ url })
  }

  return (
    <View className="empty-schedule-view">
      {!hideTitle && <Text className="step2-title">选择添加课程方式</Text>}
      <View className="section">
        <View className="list-item" onClick={() => Taro.showToast({ title: "功能开发中", icon: "none" })}>
          <Text className="list-label">照片</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">OCR识别</Text>
            <Text className="list-arrow">›</Text>
          </View>
        </View>
        
        <View className="list-item" onClick={() => Taro.showToast({ title: "功能开发中", icon: "none" })}>
          <Text className="list-label">Excel</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">AI识别</Text>
            <Text className="list-arrow">›</Text>
          </View>
        </View>

        <View className="list-item" onClick={() => Taro.navigateTo({ url: ROUTES.COPY_SCHEDULE })}>
          <Text className="list-label">复制课表</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">输入口令复制</Text>
            <Text className="list-arrow">›</Text>
          </View>
        </View>

        <View className="list-item" onClick={goToCourseForm}>
          <Text className="list-label">手动添加课程</Text>
          <View className="list-right">
            <Text className="list-arrow">›</Text>
          </View>
        </View>
      </View>
      {onAddLater && (
        <View className="step2-footer">
          <Text className="add-later-text" onClick={onAddLater}>
            稍后再添加
          </Text>
        </View>
      )}
    </View>
  )
}
