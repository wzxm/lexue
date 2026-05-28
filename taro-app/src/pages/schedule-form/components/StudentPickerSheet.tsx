import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { forwardRef, useImperativeHandle, useState } from "react";
import { ROUTES } from "../../../constants/routes";
import type { Student } from "../../../types/index";

export interface StudentPickerSheetRef {
  open: () => void;
}

interface StudentPickerSheetProps {
  students: Student[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const StudentPickerSheet = forwardRef<StudentPickerSheetRef, StudentPickerSheetProps>(
  ({ students, selectedIndex, onSelect }, ref) => {
    const [visible, setVisible] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setVisible(true),
    }));

    const close = () => setVisible(false);

    const handleSelect = (index: number) => {
      onSelect(index);
      close();
    };

    return (
      <View
        className={`sheet-overlay${visible ? " sheet-overlay--visible" : ""}`}
        onClick={close}
        catchMove
      >
        <View className="sheet-panel" onClick={(e) => e.stopPropagation()}>
          <View className="student-sheet">
            <View className="student-sheet-header">
              <Text className="student-sheet-title">选择归属学生</Text>
              <Text className="student-sheet-close" onClick={close}>×</Text>
            </View>
            <View className="student-sheet-list">
              {students.map((s, idx) => (
                <View
                  key={s.id}
                  className={`student-sheet-item ${idx === selectedIndex ? "student-sheet-item--active" : ""}`}
                  onClick={() => handleSelect(idx)}
                >
                  <Text className="student-sheet-name">{s.name}</Text>
                  {idx === selectedIndex && <Text className="student-sheet-check">✓</Text>}
                </View>
              ))}
            </View>
            <View className="student-sheet-footer">
              <Text
                className="student-sheet-manage"
                onClick={() => {
                  close();
                  Taro.navigateTo({ url: ROUTES.STUDENT_MANAGE });
                }}
              >
                学生管理
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  },
);

StudentPickerSheet.displayName = "StudentPickerSheet";

export default StudentPickerSheet;
