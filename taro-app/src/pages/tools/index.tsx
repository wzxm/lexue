import { useState, useMemo } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { tabState } from '../../utils/tabState'
import { useAuthStore } from '../../store/auth.store'
import { useScheduleStore } from '../../store/schedule.store'
import { useStudentStore } from '../../store/student.store'
import { getSchedule, setDefaultSchedule } from '../../api/schedule.api'
import { listStudents } from '../../api/student.api'
import { ROUTES } from '../../constants/routes'
import { groupSchedulesByStudent } from '../../utils/groupSchedulesByStudent'
import ScheduleSwitchDrawer from '../../components/ScheduleSwitchDrawer'
import noDataImg from '../../assets/noData.png'
import ziliaoIcon from '../../assets/ziliao.svg'
import defaultAvatar from '../../assets/default-avatar.png'
import './index.scss'

interface Tool {
  name: string
  icon?: string
  imgIcon?: string
  bgColor: string
  iconColor?: string
}

const toolList: Tool[] = [
  {
    name: '视力测试',
    icon: '\ue603',
    bgColor: '#FFF3E0',
    iconColor: '#FF9800'
  },
  {
    name: '学生赛事',
    icon: '\ue602',
    bgColor: '#E3F2FD',
    iconColor: '#2196F3'
  },
  { name: '学平险', icon: '\ue601', bgColor: '#F3E5F5', iconColor: '#9C27B0' },
  { name: '练习资料', imgIcon: ziliaoIcon, bgColor: '#FFEBEE' }
]

export default function ToolsPage () {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const userInfo = useAuthStore(s => s.userInfo)
  const schedules = useScheduleStore(s => s.schedules)
  const currentSchedule = useScheduleStore(s => s.currentSchedule)
  const setCurrentSchedule = useScheduleStore(s => s.setCurrentSchedule)
  const students = useStudentStore(s => s.students)
  const currentStudent = useStudentStore(s => s.currentStudent)
  const setStudents = useStudentStore(s => s.setStudents)
  const setCurrentStudent = useStudentStore(s => s.setCurrentStudent)

  const [showDrawer, setShowDrawer] = useState(false)

  const windowInfo = Taro.getWindowInfo()
  const menuButtonInfo = Taro.getMenuButtonBoundingClientRect()

  const statusBarHeight = windowInfo.statusBarHeight || 0
  const rawNavBar =
    (menuButtonInfo.top - statusBarHeight) * 2 + (menuButtonInfo.height || 0)
  const navBarHeight =
    Number.isFinite(rawNavBar) && rawNavBar > 0 ? rawNavBar : 88

  useDidShow(() => {
    tabState.setVisible(true)
    tabState.setSelected(1)
    if (useAuthStore.getState().isLoggedIn) {
      listStudents()
        .then(setStudents)
        .catch(() => {})
    }
  })

  const goLogin = () => {
    Taro.navigateTo({ url: ROUTES.LOGIN })
  }

  const groupedSchedules = useMemo(
    () => groupSchedulesByStudent(schedules, students),
    [schedules, students]
  )

  /** 当前课表对应学生（与抽屉分组逻辑一致） */
  const headerStudent = useMemo(() => {
    const sid = currentSchedule?.studentId || currentSchedule?.student_id
    if (sid) {
      const fromList = students.find(s => s.id === sid)
      if (fromList) return fromList
    }
    return currentStudent
  }, [currentSchedule, students, currentStudent])

  const headerStudentName = headerStudent?.name || '未命名学生'
  const headerSchoolLine = [headerStudent?.school, headerStudent?.grade]
    .filter(Boolean)
    .join('\uFF0C')

  // 打开抽屉
  const openDrawer = () => {
    if (!isLoggedIn) {
      goLogin()
      return
    }
    setShowDrawer(true)
  }

  // 关闭抽屉
  const closeDrawer = () => {
    setShowDrawer(false)
  }

  const handleSelectSchedule = async (schedule: (typeof schedules)[0]) => {
    if (currentSchedule?.id === schedule.id) {
      closeDrawer()
      return
    }
    try {
      Taro.showLoading({ title: '切换中', mask: true })
      const full = await getSchedule(schedule.id)
      const sid = full.studentId || full.student_id
      if (sid) {
        const st = students.find(s => s.id === sid)
        if (st) setCurrentStudent(st)
      }
      const openId = userInfo?.openId
      if (openId && schedule.owner_openid === openId) {
        await setDefaultSchedule(schedule.id)
      }
      setCurrentSchedule(full)
      closeDrawer()
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '切换失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  // 跳转管理课表
  const goManageSchedule = () => {
    closeDrawer()
    Taro.navigateTo({ url: ROUTES.SCHEDULE_MANAGE })
  }

  // 跳转学生管理
  const goManageStudent = () => {
    closeDrawer()
    Taro.navigateTo({ url: ROUTES.STUDENT_MANAGE })
  }

  return (
    <View className='page-container'>
      {/* 自定义导航栏背景 */}
      <View className='custom-nav-bg' />

      {/* 自定义导航栏内容 */}
      <View
        className='custom-nav-bar'
        style={{
          paddingTop: `${menuButtonInfo.top}px`,
          paddingRight: `${windowInfo.windowWidth - menuButtonInfo.left}px`
        }}
      >
        <View className='nav-title-wrap'>
          {!isLoggedIn ? (
            <View className='user-info' onClick={goLogin}>
              <View className='guest-avatar-small'>
                <Image
                  className='guest-avatar-small-img'
                  src={defaultAvatar}
                  mode='aspectFill'
                />
              </View>
              <View className='user-text'>
                <Text className='name'>登录注册</Text>
                <Text className='school'>等你来用～</Text>
              </View>
            </View>
          ) : (
            <View className='user-info' onClick={openDrawer}>
              <View className='avatar'>我</View>
              <View className='user-text'>
                <View className='name-row'>
                  <Text className='name'>
                    {currentSchedule ? headerStudentName : '暂无课表'}
                  </Text>
                  <Text className='student-sub-icon'>⇌</Text>
                </View>
                <Text className='school'>
                  {currentSchedule
                    ? headerSchoolLine || '未填写学校'
                    : '请选择课表'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View
        style={{ flexShrink: 0, height: `${statusBarHeight + navBarHeight}px` }}
      />
      <View className='content'>
        <View className='section-title'>百宝箱</View>
        <View className='tools-grid'>
          {toolList.map(item => (
            <View key={item.name} className='tool-card'>
              <View
                className='tool-icon-wrap'
                // style={{ background: item.bgColor }}
              >
                {item.imgIcon ? (
                  <Image
                    className='tool-img-icon'
                    src={item.imgIcon}
                    mode='aspectFit'
                  />
                ) : (
                  <Text
                    className='iconfont tool-icon'
                    style={{ color: item.iconColor }}
                  >
                    {item.icon}
                  </Text>
                )}
              </View>
              <Text className='tool-name'>{item.name}</Text>
            </View>
          ))}
        </View>

        <View className='section-header'>
          <Text className='section-title'>大家在看</Text>
          <Text className='section-more'>栏目介绍 {'>'}</Text>
        </View>

        <View className='empty-state'>
          <Image className='empty-img' src={noDataImg} mode='aspectFit' />
          <Text className='empty-text'>暂无内容</Text>
        </View>
      </View>

      <ScheduleSwitchDrawer
        visible={showDrawer}
        onClose={closeDrawer}
        schedules={schedules}
        groupedSchedules={groupedSchedules}
        currentScheduleId={currentSchedule?.id}
        onSelectSchedule={handleSelectSchedule}
        onManageSchedule={goManageSchedule}
        onManageStudent={goManageStudent}
      />
    </View>
  )
}
