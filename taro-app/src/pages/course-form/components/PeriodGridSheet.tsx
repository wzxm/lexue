import { View, Text, PageContainer } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { WeekDay, PeriodIndex } from '../../../types/index'
import './PeriodGridSheet.scss'

export interface SlotSelection {
  day_of_week: WeekDay
  slot: PeriodIndex
}

interface PeriodGridSheetProps {
  show: boolean
  periodCount: number
  selected: SlotSelection[]
  occupied?: SlotSelection[]
  singleSelect?: boolean
  onClose: () => void
  onConfirm: (selections: SlotSelection[]) => void
  onAfterLeave?: () => void
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function isSelected(list: SlotSelection[], day: WeekDay, slot: PeriodIndex) {
  return list.some(s => s.day_of_week === day && s.slot === slot)
}

function isOccupied(list: SlotSelection[], day: WeekDay, slot: PeriodIndex) {
  return list.some(s => s.day_of_week === day && s.slot === slot)
}

export default function PeriodGridSheet({
  show,
  periodCount,
  selected,
  occupied = [],
  singleSelect = false,
  onClose,
  onConfirm,
  onAfterLeave,
}: PeriodGridSheetProps) {
  const [draft, setDraft] = useState<SlotSelection[]>([])

  useEffect(() => {
    if (show) setDraft([...selected])
  }, [show])

  const toggleCell = (day: WeekDay, slot: PeriodIndex) => {
    if (isOccupied(occupied, day, slot)) return
    if (singleSelect) {
      setDraft(prev => {
        const alreadySelected = prev.some(s => s.day_of_week === day && s.slot === slot)
        return alreadySelected ? [] : [{ day_of_week: day, slot }]
      })
      return
    }
    setDraft(prev => {
      const exists = prev.findIndex(s => s.day_of_week === day && s.slot === slot)
      if (exists >= 0) return prev.filter((_, i) => i !== exists)
      return [...prev, { day_of_week: day, slot }]
    })
  }

  const handleConfirm = () => {
    onConfirm(draft)
  }

  return (
    <PageContainer
      show={show}
      position='bottom'
      round
      zIndex={1000}
      onClickOverlay={onClose}
      onAfterLeave={onAfterLeave ?? onClose}
    >
      <View className='pg-sheet'>
        <View className='pg-sheet__tip'>
          <Text className='pg-sheet__tip-main'>
            {singleSelect ? '点击格子选择上课时间' : '点击课表格子，添加更多课节'}
          </Text>
          {!singleSelect && (
            <Text className='pg-sheet__tip-sub'>(若区分单双周，稍后可单独设置)</Text>
          )}
        </View>

        <View className='pg-sheet__grid'>
          {/* 表头 */}
          <View className='pg-sheet__row'>
            <View className='pg-sheet__corner'>
              <Text className='pg-sheet__corner-text'>课节</Text>
            </View>
            {WEEKDAY_LABELS.map((label, idx) => (
              <View key={idx} className='pg-sheet__header-cell'>
                <Text className='pg-sheet__header-text'>{label}</Text>
              </View>
            ))}
          </View>

          {/* 网格行 */}
          {Array.from({ length: periodCount }, (_, pIdx) => {
            const slot = (pIdx + 1) as PeriodIndex
            return (
              <View key={pIdx} className='pg-sheet__row'>
                <View className='pg-sheet__period-label'>
                  <Text className='pg-sheet__period-num'>{slot}</Text>
                </View>
                {WEEKDAY_LABELS.map((_, dIdx) => {
                  const day = (dIdx + 1) as WeekDay
                  const sel = isSelected(draft, day, slot)
                  const occ = isOccupied(occupied, day, slot)
                  return (
                    <View
                      key={dIdx}
                      className={`pg-sheet__cell ${sel ? 'pg-sheet__cell--selected' : ''} ${occ ? 'pg-sheet__cell--occupied' : ''}`}
                      onClick={() => toggleCell(day, slot)}
                    >
                      {sel && <Text className='pg-sheet__check'>✓</Text>}
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>

        <View className='pg-sheet__footer'>
          <View className='pg-sheet__btn' onClick={handleConfirm}>
            <Text className='pg-sheet__btn-text'>确定</Text>
          </View>
        </View>
      </View>
    </PageContainer>
  )
}
