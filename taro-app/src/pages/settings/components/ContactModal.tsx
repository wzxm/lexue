import { memo, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import './ContactModal.scss'

interface ContactModalProps {
  visible: boolean
  onClose: () => void
  onCopy: () => void
}

function ContactModal({ visible, onClose, onCopy }: ContactModalProps) {
  const [rendered, setRendered] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (visible) {
      setRendered(true)
      const timer = setTimeout(() => setActive(true), 20)
      return () => clearTimeout(timer)
    }

    setActive(false)
    // 关闭时只做 CSS 淡出，不卸载 fixed 层，避免小程序整页重绘闪烁
  }, [visible])

  if (!rendered) return null

  return (
    <View
      className={`contact-modal-mask ${active ? 'contact-modal-mask--active' : ''}`}
      catchMove={active}
      onClick={active ? onClose : undefined}
    >
      <View
        className={`contact-modal-card ${active ? 'contact-modal-card--active' : ''}`}
        catchMove={active}
        onClick={(e) => e.stopPropagation()}
      >
        <View className='contact-modal-body'>
          <Text className='contact-modal-title'>您可通过以下方式联系我们：</Text>
          <Text className='contact-modal-line'>📮 email：up91@foxmail.com</Text>
          <Text className='contact-modal-line'>✉️ 微信号：atgoing</Text>
        </View>
        <View className='contact-modal-actions'>
          <View className='contact-modal-btn contact-modal-btn--cancel' onClick={onClose}>
            关闭
          </View>
          <View className='contact-modal-btn contact-modal-btn--confirm' onClick={onCopy}>
            立即复制
          </View>
        </View>
      </View>
    </View>
  )
}

export default memo(ContactModal)
