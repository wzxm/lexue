import { memo, useEffect, useState } from 'react'
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuthStore } from '../../../store/auth.store'
import { updateProfile } from '../../../api/auth.api'
import defaultAvatar from '../../../assets/default-avatar.png'
import { getDisplayAvatarUrl } from '../../../utils/avatar'
import './EditProfileModal.scss'

interface EditProfileModalProps {
  visible: boolean
  onClose: () => void
}

function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const userInfo = useAuthStore(s => s.userInfo)
  const setUserInfo = useAuthStore(s => s.setUserInfo)
  const [rendered, setRendered] = useState(false)
  const [active, setActive] = useState(false)
  const [draftNickname, setDraftNickname] = useState('')
  const [draftAvatarUrl, setDraftAvatarUrl] = useState(defaultAvatar)
  const [saving, setSaving] = useState(false)
  const [updatingAvatar, setUpdatingAvatar] = useState(false)
  const [nicknameFocus, setNicknameFocus] = useState(false)

  useEffect(() => {
    if (!visible) {
      setActive(false)
      setNicknameFocus(false)
      return
    }

    setRendered(true)
    setDraftNickname(userInfo?.nickname || '')
    setDraftAvatarUrl(getDisplayAvatarUrl(userInfo?.avatarUrl, defaultAvatar))
    setNicknameFocus(false)
    const timer = setTimeout(() => setActive(true), 20)
    return () => clearTimeout(timer)
  }, [visible, userInfo?.nickname, userInfo?.avatarUrl])

  const handleSyncNickname = () => {
    setNicknameFocus(true)
  }

  const handleChooseAvatar = async (e: any) => {
    if (updatingAvatar) return
    const tempPath = e?.detail?.avatarUrl || ''
    if (!tempPath) {
      Taro.showToast({ title: '未获取到头像', icon: 'none' })
      return
    }

    const previousAvatarUrl = getDisplayAvatarUrl(userInfo?.avatarUrl, defaultAvatar)
    setUpdatingAvatar(true)
    setDraftAvatarUrl(tempPath)

    try {
      Taro.showLoading({ title: '上传中...' })
      const ext = tempPath.split('.').pop() || 'jpg'
      const openIdPrefix = userInfo?.openId?.slice(0, 8) || 'user'
      const cloudPath = `user-avatar/${openIdPrefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`
      const uploadRes = await Taro.cloud.uploadFile({
        cloudPath,
        filePath: tempPath,
      })
      const profile = await updateProfile({ avatarUrl: uploadRes.fileID })
      setUserInfo(profile)
      setDraftAvatarUrl(profile.avatarUrl || uploadRes.fileID)
      Taro.showToast({ title: '头像已更新', icon: 'success' })
    } catch (err: any) {
      setDraftAvatarUrl(previousAvatarUrl)
      Taro.showToast({ title: err?.message || '头像更新失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setUpdatingAvatar(false)
    }
  }

  const handleSave = async () => {
    if (saving || updatingAvatar) return
    const nickname = draftNickname.trim()
    if (!nickname) {
      Taro.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    if (nickname.length > 20) {
      Taro.showToast({ title: '名称最多20个字', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const profile = await updateProfile({ nickname })
      setUserInfo(profile)
      Taro.showToast({ title: '资料已更新', icon: 'success' })
      onClose()
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '修改失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (!rendered) return null

  return (
    <View className={`edit-profile-layer ${active ? 'edit-profile-layer--active' : ''}`}>
      <View
        className='edit-profile-overlay'
        catchMove={active}
        onClick={active ? onClose : undefined}
      />
      <View className={`edit-profile-modal ${active ? 'edit-profile-modal--active' : ''}`}>
        <View className='edit-profile-modal-header'>
          <Text className='edit-profile-modal-title'>修改资料</Text>
        </View>
        <View className='edit-profile-modal-body'>
          <Button
            className='edit-profile-avatar-btn'
            openType='chooseAvatar'
            loading={updatingAvatar}
            disabled={updatingAvatar || !active}
            onChooseAvatar={handleChooseAvatar}
          >
            <View className='edit-profile-avatar-wrap'>
              <View className='edit-profile-avatar'>
                <Image className='edit-profile-avatar-img' src={draftAvatarUrl} mode='aspectFill' />
              </View>
              <View className='edit-profile-camera-badge'>
                <Text className='iconfont edit-profile-camera-icon'>&#xe631;</Text>
              </View>
            </View>
          </Button>

          <View className='edit-profile-form-group'>
            <View className='edit-profile-form-label'>
              <Text className='edit-profile-form-label-text'>昵称</Text>
              <View className='edit-profile-sync-btn' onClick={handleSyncNickname}>
                <Text className='edit-profile-sync-text'>同步微信昵称</Text>
              </View>
            </View>
            <View className='edit-profile-input-row'>
              <Input
                className='edit-profile-input'
                type='nickname'
                maxlength={20}
                focus={active && nicknameFocus}
                value={draftNickname}
                placeholder='请输入新名称'
                onInput={(e) => setDraftNickname(e.detail.value)}
                onBlur={() => setNicknameFocus(false)}
              />
            </View>
          </View>
        </View>
        <View className='edit-profile-modal-footer'>
          <View className='edit-profile-cancel' onClick={onClose}>
            取消
          </View>
          <View className='edit-profile-confirm' onClick={handleSave}>
            {saving ? '保存中...' : '保存'}
          </View>
        </View>
      </View>
    </View>
  )
}

export default memo(EditProfileModal)
