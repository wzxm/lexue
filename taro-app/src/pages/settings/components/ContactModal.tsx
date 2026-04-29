import { View, Text } from '@tarojs/components'
import './ContactModal.scss'

interface ContactModalProps {
  visible: boolean
  onClose: () => void
  onCopy: () => void
}

export default function ContactModal({ visible, onClose, onCopy }: ContactModalProps) {
  if (!visible) return null

  return (
    <View className='contact-modal-mask' onClick={onClose}>
      <View className='contact-modal-card' onClick={(e) => e.stopPropagation()}>
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
