import { View, Text, Image } from '@tarojs/components'
import type { Schedule } from '../../types'
import type { GroupedSchedules } from '../../utils/groupSchedulesByStudent'
import noDataImg from '../../assets/noData.png'
import './index.scss'

export interface ScheduleSwitchDrawerProps {
  visible: boolean
  onClose: () => void
  schedules: Schedule[]
  groupedSchedules: GroupedSchedules[]
  currentScheduleId: string | undefined
  onSelectSchedule: (schedule: Schedule) => void | Promise<void>
  onManageSchedule: () => void
  onManageStudent: () => void
}

export default function ScheduleSwitchDrawer ({
  visible,
  onClose,
  schedules,
  groupedSchedules,
  currentScheduleId,
  onSelectSchedule,
  onManageSchedule,
  onManageStudent
}: ScheduleSwitchDrawerProps) {
  if (!visible) return null

  return (
    <View className='schedule-switch-drawer'>
      <View className='ssd-mask' onClick={onClose}>
        <View className='ssd-panel' onClick={e => e.stopPropagation()}>
          <View className='ssd-header'>
            <View className='ssd-title-wrap'>
              <Text className='ssd-title'>切换课表</Text>
            </View>
          </View>

          <View className='ssd-body'>
            {schedules.length === 0 ? (
              <View className='ssd-empty'>
                <Image
                  className='ssd-empty-img'
                  src={noDataImg}
                  mode='aspectFit'
                />
                <Text className='ssd-empty-text'>暂无数据</Text>
              </View>
            ) : (
              <View className='ssd-list'>
                {groupedSchedules.map((group, gIdx) => (
                  <View key={gIdx} className='ssd-group'>
                    <View className='ssd-group-header'>
                      <Text className='ssd-student-name'>
                        {group.studentName}
                      </Text>
                      {(group.school || group.grade) && (
                        <>
                          <Text className='ssd-student-divider'>|</Text>
                          <Text className='ssd-student-meta'>
                            {[group.school, group.grade]
                              .filter(Boolean)
                              .join('\uFF0C')}
                          </Text>
                        </>
                      )}
                    </View>
                    {group.items.map(schedule => {
                      const isActive = currentScheduleId === schedule.id
                      return (
                        <View
                          key={schedule.id}
                          className={`ssd-schedule-item ${
                            isActive ? 'ssd-schedule-item--active' : ''
                          }`}
                          onClick={() => void onSelectSchedule(schedule)}
                        >
                          <Text
                            className={`ssd-schedule-name ${
                              isActive ? 'ssd-schedule-name--active' : ''
                            }`}
                          >
                            {schedule.semester || schedule.name}
                          </Text>
                          {isActive && (
                            <Text className='ssd-check-icon'>✓</Text>
                          )}
                        </View>
                      )
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View
            className='ssd-footer'
            style={{
              alignItems: 'center',
              gap: '20px'
            }}
          >
            <View className='ssd-manage-btn' onClick={onManageSchedule}>
              <Text className='ssd-manage-icon iconfont'>&#xe696;</Text>
              <Text className='ssd-manage-text'>课表管理</Text>
            </View>
            <View
              style={{
                width: '1px',
                height: '16px',
                backgroundColor: '#E5E5E5',
                flexShrink: 0
              }}
            />
            <View className='ssd-manage-btn' onClick={onManageStudent}>
              <Text className='ssd-manage-icon iconfont'>&#xe600;</Text>
              <Text className='ssd-manage-text'>学生管理</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
