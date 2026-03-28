import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { ROUTES } from '../../constants/routes'

export default function IndexPage() {
  useEffect(() => {
    Taro.reLaunch({ url: ROUTES.SCHEDULE })
  }, [])

  return null
}
