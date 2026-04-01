import { View, Text, PageContainer } from '@tarojs/components'
import { useState, useEffect, useMemo } from 'react'
import './WeekPickerSheet.scss'

type QuickMode = 'odd' | 'even' | 'all' | null

interface WeekPickerSheetProps {
  show: boolean
  totalWeeks: number
  selectedWeeks: number[]
  onCancel: () => void
  onConfirm: (weeks: number[]) => void
  onAfterLeave?: () => void
}

function detectQuickMode(weeks: number[], totalWeeks: number): QuickMode {
  if (weeks.length === 0) return null
  const allWeeks = Array.from({ length: totalWeeks }, (_, i) => i + 1)
  const oddWeeks = allWeeks.filter(w => w % 2 === 1)
  const evenWeeks = allWeeks.filter(w => w % 2 === 0)

  if (weeks.length === totalWeeks) return 'all'
  if (weeks.length === oddWeeks.length && oddWeeks.every(w => weeks.includes(w))) return 'odd'
  if (weeks.length === evenWeeks.length && evenWeeks.every(w => weeks.includes(w))) return 'even'
  return null
}

export default function WeekPickerSheet({
  show,
  totalWeeks,
  selectedWeeks,
  onCancel,
  onConfirm,
  onAfterLeave,
}: WeekPickerSheetProps) {
  const [draft, setDraft] = useState<number[]>([])

  useEffect(() => {
    if (show) setDraft([...selectedWeeks])
  }, [show])

  const quickMode = useMemo(() => detectQuickMode(draft, totalWeeks), [draft, totalWeeks])

  const allWeeks = useMemo(
    () => Array.from({ length: totalWeeks }, (_, i) => i + 1),
    [totalWeeks],
  )

  const toggleWeek = (week: number) => {
    setDraft(prev =>
      prev.includes(week) ? prev.filter(w => w !== week) : [...prev, week].sort((a, b) => a - b),
    )
  }

  const applyQuick = (mode: QuickMode) => {
    if (mode === quickMode) {
      setDraft([])
      return
    }
    if (mode === 'all') {
      setDraft([...allWeeks])
    } else if (mode === 'odd') {
      setDraft(allWeeks.filter(w => w % 2 === 1))
    } else if (mode === 'even') {
      setDraft(allWeeks.filter(w => w % 2 === 0))
    }
  }

  return (
    <PageContainer
      show={show}
      position='bottom'
      round
      zIndex={1000}
      onClickOverlay={onCancel}
      onAfterLeave={onAfterLeave ?? onCancel}
    >
      <View className='wp-sheet'>
        <View className='wp-sheet__header'>
          <Text className='wp-sheet__cancel' onClick={onCancel}>取消</Text>
          <Text className='wp-sheet__title'>周数</Text>
          <Text className='wp-sheet__done' onClick={() => onConfirm(draft)}>完成</Text>
        </View>

        <View className='wp-sheet__quick'>
          <View
            className={`wp-sheet__quick-item ${quickMode === 'odd' ? 'wp-sheet__quick-item--active' : ''}`}
            onClick={() => applyQuick('odd')}
          >
            <View className={`wp-sheet__radio ${quickMode === 'odd' ? 'wp-sheet__radio--checked' : ''}`}>
              {quickMode === 'odd' && <Text className='wp-sheet__radio-dot'>✓</Text>}
            </View>
            <Text className='wp-sheet__quick-label'>单周</Text>
          </View>
          <View
            className={`wp-sheet__quick-item ${quickMode === 'even' ? 'wp-sheet__quick-item--active' : ''}`}
            onClick={() => applyQuick('even')}
          >
            <View className={`wp-sheet__radio ${quickMode === 'even' ? 'wp-sheet__radio--checked' : ''}`}>
              {quickMode === 'even' && <Text className='wp-sheet__radio-dot'>✓</Text>}
            </View>
            <Text className='wp-sheet__quick-label'>双周</Text>
          </View>
          <View
            className={`wp-sheet__quick-item ${quickMode === 'all' ? 'wp-sheet__quick-item--active' : ''}`}
            onClick={() => applyQuick('all')}
          >
            <View className={`wp-sheet__radio ${quickMode === 'all' ? 'wp-sheet__radio--checked' : ''}`}>
              {quickMode === 'all' && <Text className='wp-sheet__radio-dot'>✓</Text>}
            </View>
            <Text className='wp-sheet__quick-label'>全选</Text>
          </View>
        </View>

        <View className='wp-sheet__grid'>
          {allWeeks.map(week => (
            <View
              key={week}
              className={`wp-sheet__week ${draft.includes(week) ? 'wp-sheet__week--selected' : ''}`}
              onClick={() => toggleWeek(week)}
            >
              <Text className={`wp-sheet__week-text ${draft.includes(week) ? 'wp-sheet__week-text--selected' : ''}`}>
                {week}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </PageContainer>
  )
}
