import { useEffect, useMemo, useState } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { fullBotSvg } from './botIcon'
import { AI_COURSES, AI_STORAGE } from './data'
import noticeIllustration from '../../assets/ai-kid-plan/notice-illustration.jpg'
import './index.scss'

export default function AiKidPlanIndex () {
  const [showNotice, setShowNotice] = useState(false)
  const [last, setLast] = useState<number | null>(null)
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({})
  const [pressedId, setPressedId] = useState<number | null>(null)
  const botSrc = useMemo(() => fullBotSvg(), [])

  const refresh = () => {
    setLast(Number(Taro.getStorageSync(AI_STORAGE.last)) || null)
    setDoneMap(Taro.getStorageSync(AI_STORAGE.done) || {})
  }

  useEffect(() => {
    if (!Taro.getStorageSync(AI_STORAGE.notice)) setShowNotice(true)
  }, [])

  useDidShow(refresh)

  useShareAppMessage(() => ({
    title: '和朋友一起学习ai，邀请他们接受挑战～',
    path: '/pages/ai-kid-plan/index'
  }))

  const closeNotice = () => {
    Taro.setStorageSync(AI_STORAGE.notice, true)
    setShowNotice(false)
  }

  return (
    <View className='ai-plan-page'>
      <View className='ai-plan-header'>
        <View className='header-text'>
          <Text className='eyebrow'>5 天启蒙计划</Text>
          <Text className='ai-plan-title'>和孩子一起认识 AI</Text>
        </View>
        <Image className='bot-img' src={botSrc} mode='aspectFit' />
      </View>

      <View className='ai-toc'>
        {AI_COURSES.map(course => {
          const done = Boolean(doneMap[course.id])
          const isCurrent = last === course.id
          return (
            <View
              key={course.id}
              className={[
                'ai-course-row',
                isCurrent ? 'is-current' : '',
                pressedId === course.id ? 'is-pressed' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() =>
                Taro.navigateTo({
                  url: `/pages/ai-kid-plan/course/index?id=${course.id}`
                })
              }
              onTouchStart={() => setPressedId(course.id)}
              onTouchEnd={() => setPressedId(null)}
              onTouchCancel={() => setPressedId(null)}
            >
              <Text className='ai-course-num'>
                {String(course.day).padStart(2, '0')}
              </Text>
              <View className='ai-course-main'>
                <View className='toc-title-line'>
                  <Text className={done ? 'ai-course-title is-done' : 'ai-course-title'}>
                    {course.title}
                  </Text>
                  {done && (
                    <View className='done-badge'>
                      <View className='done-check' />
                    </View>
                  )}
                  {isCurrent && !done && (
                    <Text className='now-tag'>继续学习</Text>
                  )}
                </View>
                <Text className='ai-course-desc'>{course.desc}</Text>
              </View>
              <Text className='ai-arrow'>→</Text>
            </View>
          )
        })}
      </View>

      <View className='ai-invite'>
        <View className='invite-text'>
          <Text className='invite-desc'>
            和朋友一起学习ai，邀请他们接受挑战～
          </Text>
        </View>
        <Button className='invite-btn' openType='share'>
          邀请朋友
        </Button>
      </View>

      <Text className='ai-foot'>适读 5～10 岁 · 请家长陪同一起使用</Text>
      <View className='notice-entry' onClick={() => setShowNotice(true)}>
        <View className='notice-entry-heart' />
        <Text>温馨提示</Text>
      </View>

      {showNotice && (
        <View className='ai-mask' catchMove>
          <View className='ai-sheet'>
            <View className='sheet-panel'>
              <View className='sheet-head'>
                <View className='sheet-head-text'>
                  <View className='sheet-eyebrow'>
                    <View className='eyebrow-heart' />
                    <Text>给家长的小提醒</Text>
                  </View>
                  <View className='sheet-title'>
                    <Text className='title-line'>陪孩子一起</Text>
                    <Text className='title-line'>
                      开启 <Text className='title-accent'>AI</Text> 启蒙
                    </Text>
                  </View>
                </View>
                <Image
                  className='sheet-illus'
                  src={noticeIllustration}
                  mode='aspectFit'
                />
              </View>

              <View className='notice-list'>
                <View className='notice-item'>
                  <View className='notice-icon notice-icon-family' />
                  <Text className='notice-text'>
                    本内容适合 5-10 岁孩子使用，建议家长陪伴孩子一起探索、一起提问。
                  </Text>
                </View>
                <View className='notice-divider' />
                <View className='notice-item'>
                  <View className='notice-icon notice-icon-safe' />
                  <Text className='notice-text'>
                    适度的 AI 互动，可以帮助孩子练习表达、培养思考与逻辑。
                  </Text>
                </View>
                <View className='notice-divider' />
                <View className='notice-item'>
                  <View className='notice-icon notice-icon-time' />
                  <Text className='notice-text'>
                    也请您协助孩子合理安排使用时长，养成健康的屏幕使用习惯，让科技更好地陪伴成长。
                  </Text>
                </View>
              </View>

              <View className='sheet-btn' onClick={closeNotice}>
                知道了
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
