import { View, Text, Picker, Button } from "@tarojs/components";
import { forwardRef, useImperativeHandle, useState } from "react";
import Taro from "@tarojs/taro";

export interface PeriodEditorTarget {
  index: number;
  label: string;
  startTime: string;
  endTime: string;
}

export interface PeriodEditorSheetRef {
  open: (period: PeriodEditorTarget) => void;
}

interface PeriodEditorSheetProps {
  onConfirm: (index: number, startTime: string, endTime: string) => void;
}

const PeriodEditorSheet = forwardRef<PeriodEditorSheetRef, PeriodEditorSheetProps>(
  ({ onConfirm }, ref) => {
    const [visible, setVisible] = useState(false);
    const [period, setPeriod] = useState<PeriodEditorTarget | null>(null);
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    useImperativeHandle(ref, () => ({
      open: (target) => {
        setPeriod(target);
        setStartTime(target.startTime);
        setEndTime(target.endTime);
        setVisible(true);
      },
    }));

    const close = () => {
      setVisible(false);
      setPeriod(null);
    };

    const handleConfirm = () => {
      if (!period) return;
      if (!startTime || !endTime) {
        Taro.showToast({ title: "请选择完整时间", icon: "none" });
        return;
      }
      if (startTime >= endTime) {
        Taro.showToast({ title: "下课时间需晚于上课时间", icon: "none" });
        return;
      }
      onConfirm(period.index, startTime, endTime);
      close();
    };

    return (
      <View
        className={`sheet-overlay sheet-overlay--period${visible ? " sheet-overlay--visible" : ""}`}
        onClick={close}
        catchMove
      >
        <View className="sheet-panel" onClick={(e) => e.stopPropagation()}>
          <View className="period-sheet">
            <View className="period-sheet-header">
              <Text className="period-sheet-title">{period?.label || "编辑课节时间"}</Text>
              <Text className="period-sheet-close" onClick={close}>×</Text>
            </View>
            <View className="period-sheet-card">
              <Picker mode="time" value={startTime || "08:00"} onChange={(e) => setStartTime(e.detail.value as string)}>
                <View className="period-sheet-row">
                  <Text className="period-sheet-label">上课时间</Text>
                  <View className="period-sheet-right">
                    <Text className="period-sheet-value">{startTime || "08:00"}</Text>
                    <View className="form-arrow-icon" />
                  </View>
                </View>
              </Picker>
              <Picker mode="time" value={endTime || "08:40"} onChange={(e) => setEndTime(e.detail.value as string)}>
                <View className="period-sheet-row">
                  <Text className="period-sheet-label">下课时间</Text>
                  <View className="period-sheet-right">
                    <Text className="period-sheet-value">{endTime || "08:40"}</Text>
                    <View className="form-arrow-icon" />
                  </View>
                </View>
              </Picker>
            </View>
            <Button className="period-sheet-confirm" onClick={handleConfirm}>
              确认
            </Button>
          </View>
        </View>
      </View>
    );
  },
);

PeriodEditorSheet.displayName = "PeriodEditorSheet";

export default PeriodEditorSheet;
