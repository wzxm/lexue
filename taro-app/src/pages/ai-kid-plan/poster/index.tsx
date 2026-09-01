import { useEffect, useMemo, useState } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
import Taro, {
  useRouter,
  useShareAppMessage,
  useShareTimeline
} from '@tarojs/taro'
import { fullBotSvg, svgToDataUri } from '../botIcon'
import { AI_COURSES } from '../data'
import iconWechat from '../../../assets/ai-kid-plan/icon-wechat-white.png'
import iconMoments from '../../../assets/ai-kid-plan/icon-moments.png'
import './index.scss'

const COURSE_TOTAL_FALLBACK = AI_COURSES.length || 5

/** 二维码占位图：带定位角的确定性点阵（接入小程序码后替换即可） */
function buildQrPlaceholder () {
  const N = 21
  const on = (r: number, c: number) => {
    const tl = r < 7 && c < 7
    const tr = r < 7 && c >= N - 7
    const bl = r >= N - 7 && c < 7
    if (tl || tr || bl) {
      const lr = tl || tr ? r : r - (N - 7)
      const lc = tl || bl ? c : c - (N - 7)
      const ring = lr === 0 || lr === 6 || lc === 0 || lc === 6
      const core = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4
      return ring || core
    }
    if (r === 6 || c === 6) return (r + c) % 2 === 0
    return (r * 7 + c * 11 + ((r * c) % 7) * 3) % 5 < 2
  }
  let rects = ''
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (on(r, c)) {
        rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">` +
    `<rect width="${N}" height="${N}" fill="#FFFFFF"/><g fill="#4A3F35">${rects}</g></svg>`
  )
}

export default function AiPosterPage () {
  const { params } = useRouter()
  const [showTimelineTip, setShowTimelineTip] = useState(false)

  const total = Math.max(1, Number(params.total) || COURSE_TOTAL_FALLBACK)
  const day = Math.min(Math.max(1, Number(params.day) || 1), total)
  const done = Math.min(Math.max(1, Number(params.done) || day), total)
  const title = useMemo(() => {
    try {
      return decodeURIComponent(params.title || '') || '今天的 AI 小课堂'
    } catch {
      return '今天的 AI 小课堂'
    }
  }, [params.title])

  const stars = useMemo(
    () => Array.from({ length: total }, (_, i) => ({ on: i < done })),
    [total, done]
  )
  const botSrc = useMemo(() => fullBotSvg(), [])
  const qrSrc = useMemo(() => svgToDataUri(buildQrPlaceholder()), [])

  useEffect(() => {
    if (Taro.showShareMenu) {
      Taro.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline']
      })
    }
  }, [])

  useShareAppMessage(() => ({
    title: `我完成了「5天AI启蒙挑战」第${day}天！`,
    path: '/pages/ai-kid-plan/index'
  }))

  useShareTimeline(() => ({
    title: `我完成了「5天AI启蒙挑战」第${day}天！`,
    query: 'from=timeline'
  }))

  const onBackCourse = () => {
    Taro.navigateBack({
      fail: () =>
        Taro.redirectTo({
          url: `/pages/ai-kid-plan/course/index?id=${day}`
        })
    })
  }

  return (
    <View className='ai-poster-page'>
      <View className='done-head'>
        <View className='done-title-row'>
          <View className='spark spark-l' />
          <Text className='done-title'>挑战完成 🎉</Text>
          <View className='spark spark-r' />
        </View>
        <Text className='done-sub'>今天又和孩子一起认识了一点 AI</Text>
      </View>

      <View className='poster'>
        <View className='poster-inner'>
          <Text className='poster-tag'>每天 5 分钟，和孩子一起认识 AI</Text>
          <Text className='poster-day'>
            完成第 <Text className='day-num'>{day}</Text> 天
          </Text>
          <Text className='poster-course'>《{title}》</Text>

          <View className='poster-progress'>
            {stars.map((star, i) => (
              <Text
                key={i}
                className={star.on ? 'star on' : 'star'}
              >
                {star.on ? '★' : '☆'}
              </Text>
            ))}
          </View>

          <Image className='poster-bot' src={botSrc} mode='aspectFit' />

          <View className='poster-qr'>
            <Image className='qr-img' src={qrSrc} mode='aspectFit' />
          </View>
          <Text className='poster-qr-label'>扫码一起认识 AI</Text>
        </View>
      </View>

      <View className='share-bar'>
        <Button className='share-btn main' openType='share'>
          <Image className='btn-ic' src={iconWechat} mode='aspectFit' />
          <Text>微信好友</Text>
        </Button>
        <Button
          className='share-btn sub'
          onClick={() => setShowTimelineTip(true)}
        >
          <Image className='btn-ic' src={iconMoments} mode='aspectFit' />
          <Text>朋友圈</Text>
        </Button>
      </View>

      <View className='back-row'>
        <Text className='back-link' onClick={onBackCourse}>
          返回课程
        </Text>
      </View>

      {showTimelineTip && (
        <View
          className='tl-tip-mask'
          catchMove
          onClick={() => setShowTimelineTip(false)}
        >
          <View className='tl-tip'>
            <Text className='tl-tip-title'>分享到朋友圈</Text>
            <Text className='tl-tip-text'>
              请点击右上角「···」→「分享到朋友圈」，把挑战成果分享给朋友们。
            </Text>
            <View
              className='tl-tip-btn'
              onClick={() => setShowTimelineTip(false)}
            >
              我知道了
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
