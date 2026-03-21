import { View, Text, Button } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import * as shareApi from '../../api/share.api'
import './index.scss'

export default function ShareCodePage() {
  const router = useRouter()
  const scheduleId = router.params.scheduleId || ''

  const [code, setCode] = useState('')
  const [expireAt, setExpireAt] = useState('')
  const [loading, setLoading] = useState(true)

  const generateCode = async (sid?: string) => {
    setLoading(true)
    try {
      const res = await shareApi.generateCode(sid || scheduleId)
      const expire = new Date(res.expiresAt)
      setCode(res.code)
      setExpireAt(`${expire.getMonth() + 1}月${expire.getDate()}日`)
    } catch {
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generateCode(scheduleId)
  }, [])

  const copyCode = () => {
    Taro.setClipboardData({
      data: code,
      success: () => Taro.showToast({ title: '已复制口令', icon: 'success' }),
    })
  }

  const regenerateCode = async () => {
    await generateCode()
    Taro.showToast({ title: '口令已更新', icon: 'success' })
  }

  return (
    <View className='page'>
      {loading ? (
        <View className='loading-state'>
          <Text className='loading-text'>生成口令中...</Text>
        </View>
      ) : (
        <View className='content'>
          <View className='header-area'>
            <View className='icon-wrap'>
              <Text className='icon-emoji'>🔑</Text>
            </View>
            <Text className='page-title'>课表分享口令</Text>
            <Text className='page-desc'>将口令发给家人，对方可复制你的课表</Text>
          </View>

          <View className='code-card'>
            <Text className='code-text'>{code}</Text>
            <View className='expire-badge'>
              <Text className='expire-text'>7天有效 · 到期 {expireAt}</Text>
            </View>
          </View>

          <Button className='btn-copy' onClick={copyCode}>复制口令</Button>
          <Text className='btn-regen' onClick={regenerateCode}>重新生成</Text>

          <View className='tips-card'>
            <View className='tips-header'>
              <Text className='tips-title'>📋 使用说明</Text>
            </View>
            <View className='tips-list'>
              {['将口令发送给家人或朋友', '对方打开乐学课表小程序', '在课表页点击「输入口令」', '输入口令即可复制课表数据'].map((t, i) => (
                <View key={i} className='tips-item'>
                  <Text className='tips-num'>{i + 1}</Text>
                  <Text className='tips-content'>{t}</Text>
                </View>
              ))}
            </View>
            <Text className='tips-note'>* 口令分享不含学生个人隐私信息</Text>
          </View>
        </View>
      )}
    </View>
  )
}
