import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import './index.scss'

interface CloudTipModalProps {
  show: boolean
  title: string
  content: string
  onClose?: () => void
}

export default function CloudTipModal({ show, title, content, onClose }: CloudTipModalProps) {
  const [visible, setVisible] = useState(show)

  useEffect(() => {
    setVisible(show)
  }, [show])

  if (!visible) return null

  return (
    <View className='install_tip'>
      <View className='install_tip_back' onClick={() => { setVisible(false); onClose?.() }} />
      <View className='install_tip_detail'>
        <View className='install_tip_close' onClick={() => { setVisible(false); onClose?.() }}>
          <Text>✕</Text>
        </View>
        <View className='install_tip_detail_title'>{title}</View>
        <View className='install_tip_detail_tip'>{content}</View>
      </View>
    </View>
  )
}
