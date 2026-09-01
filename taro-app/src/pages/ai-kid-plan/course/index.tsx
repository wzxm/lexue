import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Text, Video, View } from '@tarojs/components'
import Taro, { useReady, useRouter, useShareAppMessage } from '@tarojs/taro'
import { faceBotSvg } from '../botIcon'
import { AI_COURSES, AI_STORAGE, courseById, parseTask } from '../data'
import iconWechat from '../../../assets/ai-kid-plan/icon-wechat-white.png'
import './index.scss'

function countDone (map: Record<number, boolean>) {
  return AI_COURSES.filter(c => map[c.id]).length
}

export default function AiCoursePage () {
  const { params } = useRouter()
  const course = useMemo(() => courseById(Number(params.id) || 1), [params.id])
  const botFaceSrc = useMemo(() => faceBotSvg(), [])
  const [done, setDone] = useState(false)
  const [slideX, setSlideX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [resharePressed, setResharePressed] = useState(false)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const slideXRef = useRef(0)
  const maxSlideRef = useRef(0)
  const doneRef = useRef(false)

  const measureTrack = useCallback((retry = 0) => {
    // 完成态滑块由 CSS 锁右端，仅未完成时需要测量可滑距离
    if (doneRef.current) return
    Taro.createSelectorQuery()
      .select('.slide-track')
      .boundingClientRect()
      .select('.slide-knob')
      .boundingClientRect()
      .exec(res => {
        const track = res?.[0]
        const knob = res?.[1]
        if (track && knob && knob.width > 0) {
          // 滑块未移动时 left 差值为左右留白
          const margin = knob.left - track.left
          maxSlideRef.current = Math.max(
            0,
            track.width - knob.width - margin * 2
          )
        } else if (retry < 5) {
          setTimeout(() => measureTrack(retry + 1), 100)
        }
      })
  }, [])

  useEffect(() => {
    const map = Taro.getStorageSync(AI_STORAGE.done) || {}
    const isDone = Boolean(map[course.id])
    doneRef.current = isDone
    setDone(isDone)
    slideXRef.current = 0
    setSlideX(0)
    Taro.setStorageSync(AI_STORAGE.last, course.id)
    Taro.setNavigationBarTitle({
      title: `第 ${course.day} 天｜${course.title}`
    })
    if (!isDone) setTimeout(() => measureTrack(), 80)
  }, [course, measureTrack])

  useReady(() => {
    if (!doneRef.current) measureTrack()
  })

  const posterUrl = () => {
    const map = Taro.getStorageSync(AI_STORAGE.done) || {}
    return `/pages/ai-kid-plan/poster/index?day=${
      course.day
    }&title=${encodeURIComponent(course.title)}&done=${countDone(
      map
    )}&total=${AI_COURSES.length}`
  }

  const finish = () => {
    const map = Taro.getStorageSync(AI_STORAGE.done) || {}
    map[course.id] = true
    Taro.setStorageSync(AI_STORAGE.done, map)
    doneRef.current = true
    setDone(true)
    slideXRef.current = 0
    setSlideX(0)
    Taro.vibrateShort({ type: 'light' })
    Taro.navigateTo({ url: posterUrl() })
  }

  const touchStart = (event: any) => {
    if (doneRef.current) return
    draggingRef.current = true
    startXRef.current = event.touches[0].clientX
    setDragging(true)
  }

  const touchMove = (event: any) => {
    if (doneRef.current || !draggingRef.current) return
    const dx = event.touches[0].clientX - startXRef.current
    const nextX = Math.min(Math.max(0, dx), maxSlideRef.current)
    slideXRef.current = nextX
    setSlideX(nextX)
  }

  const touchEnd = () => {
    if (doneRef.current || !draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    if (
      maxSlideRef.current > 0 &&
      slideXRef.current >= maxSlideRef.current * 0.8
    ) {
      finish()
    } else {
      slideXRef.current = 0
      setSlideX(0)
    }
  }

  useShareAppMessage(() => {
    if (done) {
      return {
        title: `我在5天AI启蒙挑战完成了第${course.day}天！`,
        path: '/pages/ai-kid-plan/index'
      }
    }
    return {
      title: `第${course.day}天｜${course.title}`,
      path: `/pages/ai-kid-plan/course/index?id=${course.id}`
    }
  })

  return (
    <View className='ai-course-page'>
      <View className='course-head'>
        <Text className='course-title'>{course.title}</Text>
      </View>

      <View className='video-wrap'>
        <Video
          className='course-video'
          src={course.videoUrl}
          controls
          objectFit='contain'
          showCenterPlayBtn
          title={course.title}
        />
      </View>

      <View className='course-panel'>
        <View className='remember-top'>
          <Image className='bot-avatar' src={botFaceSrc} mode='aspectFit' />
          <Text className='panel-label'>重点笔记</Text>
        </View>
        <Text className='remember-text'>{course.rememberToday}</Text>
      </View>

      <View className='course-panel'>
        <Text className='panel-label'>{course.taskTitle}</Text>
        {course.taskContent.map((task, i) => {
          const p = parseTask(task)
          return (
            <View className='task-item' key={i}>
              <View className='task-main'>
                {p.verb ? <Text className='task-verb'>{p.verb}</Text> : null}
                <Text className='task-text'>{p.rest}</Text>
              </View>
            </View>
          )
        })}
        <View className='say-line'>
          <Text className='say-label'>今天请孩子说一句</Text>
          <Text className='say-text'>{course.sayLine}</Text>
        </View>
      </View>

      <View className='slide-row'>
        <View className={`slide-track ${done ? 'is-done' : ''}`}>
          <Text className='slide-text'>
            {done ? '完成挑战啦～' : '滑动完成今天的学习'}
          </Text>
          <View
            className={`slide-knob ${dragging ? 'is-dragging' : ''}`}
            style={
              done
                ? undefined
                : {
                    // 大写 PX：避免 Taro 把触摸测得的屏幕 px 再转成 rpx
                    transform: `translateX(${slideX}PX)`
                  }
            }
            onTouchStart={touchStart}
            onTouchMove={touchMove}
            onTouchEnd={touchEnd}
            onTouchCancel={touchEnd}
          >
            {done ? (
              <View className='knob-check' />
            ) : (
              <View className='knob-arrow' />
            )}
          </View>
        </View>

        {done && (
          <View
            className={`reshare-btn ${resharePressed ? 'is-pressed' : ''}`}
            onClick={() => Taro.navigateTo({ url: posterUrl() })}
            onTouchStart={() => setResharePressed(true)}
            onTouchEnd={() => setResharePressed(false)}
            onTouchCancel={() => setResharePressed(false)}
          >
            <Image className='reshare-ic' src={iconWechat} mode='aspectFit' />
            <Text>分享</Text>
          </View>
        )}
      </View>
    </View>
  )
}
