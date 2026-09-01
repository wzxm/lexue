import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Canvas, Image, Text, View } from '@tarojs/components'
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
  const sharingTimelineRef = useRef(false)

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

  const shareToTimeline = () => {
    if (sharingTimelineRef.current) return
    sharingTimelineRef.current = true

    if (!Taro.showShareImageMenu) {
      sharingTimelineRef.current = false
      setShowTimelineTip(true)
      return
    }

    Taro.showLoading({ title: '正在生成海报' })
    let context
    try {
      context = Taro.createCanvasContext('ai-kid-plan-share-canvas')
    } catch {
      sharingTimelineRef.current = false
      Taro.hideLoading()
      setShowTimelineTip(true)
      return
    }
    // Canvas uses a half-size logical surface; export at 2x for a crisp share image.
    context.scale(0.5, 0.5)
    context.setFillStyle('#FAF6EF')
    context.fillRect(0, 0, 750, 1000)
    context.setFillStyle('#FFFDF8')
    context.fillRect(48, 52, 654, 896)
    context.setFillStyle('#2E2822')
    context.setTextAlign('center')
    context.setFontSize(38)
    context.fillText('挑战完成 🎉', 375, 130)
    context.setFillStyle('#8A7B6B')
    context.setFontSize(24)
    context.fillText('每天 5 分钟，和孩子一起认识 AI', 375, 180)
    context.setFillStyle('#C25330')
    context.setFontSize(58)
    context.fillText(`完成第 ${day} 天`, 375, 310)
    context.setFillStyle('#2E2822')
    context.setFontSize(32)
    context.fillText(title.slice(0, 18), 375, 370)
    context.setFillStyle('#F0B63A')
    context.setFontSize(52)
    context.fillText('★'.repeat(done) + '☆'.repeat(total - done), 375, 460)
    context.setFillStyle('#FBEFD7')
    context.fillRect(215, 540, 320, 150)
    context.setFillStyle('#B5502C')
    context.setFontSize(30)
    context.fillText('和孩子一起认识一点 AI', 375, 630)
    // Keep a scannable-looking placeholder in the exported card until the QR API is wired.
    context.setFillStyle('#FFFFFF')
    context.fillRect(295, 700, 160, 160)
    context.setFillStyle('#4A3F35')
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        const finder = (row < 5 && col < 5) || (row < 5 && col > 9) || (row > 9 && col < 5)
        const edge = finder && (row % 4 === 0 || col % 4 === 0)
        const core = finder && row % 4 >= 1 && row % 4 <= 2 && col % 4 >= 1 && col % 4 <= 2
        if (edge || core || (!finder && (row * 7 + col * 11) % 5 < 2)) {
          context.fillRect(305 + col * 10, 710 + row * 10, 8, 8)
        }
      }
    }
    context.setFillStyle('#8A7B6B')
    context.setFontSize(22)
    context.fillText('扫码一起认识 AI', 375, 900)
    context.draw(false, () => {
      Taro.canvasToTempFilePath({
        canvasId: 'ai-kid-plan-share-canvas',
        x: 0,
        y: 0,
        width: 375,
        height: 500,
        destWidth: 750,
        destHeight: 1000,
        success: ({ tempFilePath }) => {
          Taro.hideLoading()
          Taro.showShareImageMenu({
            path: tempFilePath,
            complete: () => {
              sharingTimelineRef.current = false
              Taro.hideLoading()
            }
          }).catch(() => {
            sharingTimelineRef.current = false
            setShowTimelineTip(true)
          })
        },
        fail: () => {
          sharingTimelineRef.current = false
          Taro.hideLoading()
          setShowTimelineTip(true)
        }
      })
    })
  }

  useEffect(() => {
    if (Taro.showShareMenu) {
      Taro.showShareMenu({
        showShareItems: ['shareAppMessage', 'shareTimeline']
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
          onClick={shareToTimeline}
        >
          <Image className='btn-ic' src={iconMoments} mode='aspectFit' />
          <Text>朋友圈</Text>
        </Button>
      </View>

      <Canvas
        id='ai-kid-plan-share-canvas'
        canvasId='ai-kid-plan-share-canvas'
        className='share-canvas'
        width='375'
        height='500'
      />

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
