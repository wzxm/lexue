import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ROUTES } from '../../../constants/routes'
import './EmptySchedule.scss'

interface Props {
  scheduleId?: string;
  onAddLater?: () => void;
  onAiRecognize: () => void;
  /** 点击添加方式时触发（用于关闭弹窗等） */
  onSelectMethod?: () => void;
  /** 隐藏顶部标题（作为弹窗内容时使用） */
  hideTitle?: boolean;
}

export default function EmptySchedule({ scheduleId, onAddLater, onAiRecognize, onSelectMethod, hideTitle }: Props) {
  const goToCourseForm = () => {
    onSelectMethod?.()
    if (!scheduleId) return
    // 必须用 navigateTo 保留本页，否则课程表单返回时会跳过「添加课程方式」
    Taro.navigateTo({ url: `${ROUTES.COURSE_FORM}?mode=add&scheduleId=${scheduleId}` })
  }

  const handleAiRecognize = () => {
    onSelectMethod?.()
    onAiRecognize()
  }

  const goToCopySchedule = () => {
    onSelectMethod?.()
    Taro.navigateTo({ url: ROUTES.COPY_SCHEDULE })
  }

  return (
    <View className="empty-schedule-view">
      {!hideTitle && <Text className="step2-title">添加课程方式</Text>}
      <View className="section">

        <View className="list-item" onClick={handleAiRecognize}>
          <Text className="list-label">智能识别照片</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">适合首次创建课表</Text>
            <Text className="list-arrow">›</Text>
          </View>
        </View>


        {/* 暂未开发，先隐藏入口（保留代码） */}
        {/*
        <View className="list-item" onClick={() => Taro.showToast({ title: "功能开发中", icon: "none" })}>
          <Text className="list-label">Excel</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">AI识别</Text>
            <Text className="list-arrow">›</Text>
          </View>
        </View>
        */}

        <View className="list-item" onClick={goToCopySchedule}>
          <Text className="list-label">复制同学课表</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">输入口令复制</Text>
            <Text className="list-arrow">›</Text>
          </View>
        </View>

        <View className="list-item" onClick={goToCourseForm}>
          <Text className="list-label">手动添加课程</Text>
          <View className="list-right">
            <Text className="list-value list-value--tag">适合新增单个课程</Text>
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
