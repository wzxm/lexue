import { View, Text, Picker, Button } from "@tarojs/components";
import { useState, useEffect, useCallback, useRef } from "react";
import Taro from "@tarojs/taro";
import { createSchedule, updateSchedule } from "../../api/schedule.api";
import { useStudentStore } from "../../store/student.store";
import { useScheduleStore } from "../../store/schedule.store";
import EmptySchedule from "../schedule/components/EmptySchedule";
import { getSemesterOptions, getCurrentSemester, formatDate } from "../../utils/date";
import type { Schedule, Period, PeriodIndex } from "../../types/index";
import PeriodEditorSheet, { type PeriodEditorSheetRef } from "./components/PeriodEditorSheet";
import StudentPickerSheet, { type StudentPickerSheetRef } from "./components/StudentPickerSheet";
import "./index.scss";

const SEMESTER_OPTIONS = getSemesterOptions();
const SEMESTER_LABELS = SEMESTER_OPTIONS.map((o) => o.label);

// 推算当前学期在列表中的位置，找不到就默认第一项
const currentSemesterValue = getCurrentSemester().value;
const DEFAULT_SEMESTER_INDEX = Math.max(
  SEMESTER_OPTIONS.findIndex((o) => o.value === currentSemesterValue),
  0
);

// 上午默认时间段：08:10 起，每节 40 分钟，课间 10 分钟
const MORNING_SLOTS = [
  { startTime: "08:10", endTime: "08:50" },
  { startTime: "09:00", endTime: "09:40" },
  { startTime: "09:50", endTime: "10:30" },
  { startTime: "10:40", endTime: "11:20" },
  { startTime: "11:30", endTime: "12:10" },
  { startTime: "12:20", endTime: "13:00" },
];
// 下午默认时间段：14:00 起，每节 40 分钟，课间 10 分钟
const AFTERNOON_SLOTS = [
  { startTime: "14:00", endTime: "14:40" },
  { startTime: "14:50", endTime: "15:30" },
  { startTime: "15:40", endTime: "16:20" },
  { startTime: "16:30", endTime: "17:10" },
  { startTime: "17:20", endTime: "18:00" },
  { startTime: "18:10", endTime: "18:50" },
];
// 晚上默认时间段
const EVENING_SLOTS = [
  { startTime: "19:00", endTime: "19:45" },
  { startTime: "19:55", endTime: "20:40" },
  { startTime: "20:50", endTime: "21:35" },
  { startTime: "21:45", endTime: "22:30" },
];

// 周数选项
const WEEK_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);
const WEEK_LABELS = WEEK_OPTIONS.map((w) => `${w}`);

export default function ScheduleFormPage() {
  const router = Taro.useRouter();
  const editScheduleId = router.params?.id || "";
  const isEditMode = Boolean(editScheduleId);

  const students = useStudentStore((s) => s.students);
  const schedules = useScheduleStore((s) => s.schedules);
  const addSchedule = useScheduleStore((s) => s.addSchedule);
  const setSchedules = useScheduleStore((s) => s.setSchedules);
  const currentSchedule = useScheduleStore((s) => s.currentSchedule);
  const setCurrentSchedule = useScheduleStore((s) => s.setCurrentSchedule);

  const [semesterIndex, setSemesterIndex] = useState(DEFAULT_SEMESTER_INDEX);
  const [startDate, setStartDate] = useState("");
  const [totalWeeks, setTotalWeeks] = useState(20);
  const [weekPickerIndex, setWeekPickerIndex] = useState(19);
  const [studentIndex, setStudentIndex] = useState(0); // 列表已按 createTime desc 排序，第一个就是最新
  const [morningCount, setMorningCount] = useState(4);
  const [afternoonCount, setAfternoonCount] = useState(4);
  const [eveningCount, setEveningCount] = useState(0);
  const [periodTimeOverrides, setPeriodTimeOverrides] = useState<Record<number, { startTime: string; endTime: string }>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [currentScheduleId, setCurrentScheduleId] = useState<string | null>(null);
  const periodSheetRef = useRef<PeriodEditorSheetRef>(null);
  const studentSheetRef = useRef<StudentPickerSheetRef>(null);

  const studentLabels = students.length > 0 ? students.map((s) => s.name) : ["默认"];

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: isEditMode ? "课表详情" : "新建课表" });
    // 学生列表已按 createTime desc 排序，始终默认选第一个
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) return;
    const target = schedules.find((s) => s.id === editScheduleId || s._id === editScheduleId);
    if (!target) return;

    const semesterIdx = Math.max(
      SEMESTER_OPTIONS.findIndex((o) => o.value === target.semester),
      0
    );
    setSemesterIndex(semesterIdx);

    const studentId = target.student_id || "";
    if (studentId && students.length > 0) {
      const idx = students.findIndex((s) => s.id === studentId);
      if (idx >= 0) setStudentIndex(idx);
    }

    const sd = target.start_date || target.startDate || "";
    if (sd) setStartDate(sd);

    const weeks = target.total_weeks || target.totalWeeks || 20;
    const safeWeeks = clamp(weeks, 1, 30);
    setTotalWeeks(safeWeeks);
    setWeekPickerIndex(safeWeeks - 1);

    const config = target.period_config;
    const frontendConfig = target.periodConfig;
    setMorningCount(clamp(Number(config?.morning_count ?? frontendConfig?.morningCount) || 4, 1, 6));
    setAfternoonCount(clamp(Number(config?.afternoon_count ?? frontendConfig?.afternoonCount) || 4, 1, 6));
    setEveningCount(clamp(Number(config?.evening_count ?? frontendConfig?.eveningCount) || 0, 0, 4));

    if (Array.isArray(target.periods)) {
      const overrides = target.periods.reduce<Record<number, { startTime: string; endTime: string }>>((acc, p) => {
        if (p?.index && p.startTime && p.endTime) {
          acc[p.index] = { startTime: p.startTime, endTime: p.endTime };
        }
        return acc;
      }, {});
      setPeriodTimeOverrides(overrides);
    }
  }, [isEditMode, editScheduleId, schedules, students]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const buildPeriodList = useCallback((slots: { startTime: string; endTime: string }[], count: number, startIdx: number) => {
    return slots.slice(0, count).map((s, i) => ({
      index: startIdx + i,
      startTime: s.startTime,
      endTime: s.endTime,
      label: `第${startIdx + i}节课`,
    }));
  }, []);

  const applyPeriodOverrides = useCallback(
    (periods: { index: number; startTime: string; endTime: string; label: string }[]) => {
      return periods.map((p) => ({
        ...p,
        ...(periodTimeOverrides[p.index] || {}),
      }));
    },
    [periodTimeOverrides]
  );

  const morningPeriods = applyPeriodOverrides(buildPeriodList(MORNING_SLOTS, morningCount, 1));
  const afternoonPeriods = applyPeriodOverrides(buildPeriodList(AFTERNOON_SLOTS, afternoonCount, morningCount + 1));
  const eveningPeriods = applyPeriodOverrides(buildPeriodList(EVENING_SLOTS, eveningCount, morningCount + afternoonCount + 1));

  const buildPeriods = (): Period[] => {
    return [...morningPeriods, ...afternoonPeriods, ...eveningPeriods].map((p) => ({
      index: p.index as PeriodIndex,
      startTime: p.startTime,
      endTime: p.endTime,
      label: p.label,
    }));
  };

  const buildPeriodConfig = () => ({
    morning_count: morningCount,
    afternoon_count: afternoonCount,
    evening_count: eveningCount,
  });

  const openPeriodEditor = (period: { index: number; label: string; startTime: string; endTime: string }) => {
    periodSheetRef.current?.open(period);
  };

  const handlePeriodConfirm = (index: number, startTime: string, endTime: string) => {
    setPeriodTimeOverrides((prev) => ({
      ...prev,
      [index]: { startTime, endTime },
    }));
  };

  const onSave = async () => {
    if (loading) return;

    if (!startDate) {
      Taro.showToast({ title: '请选择开学日期', icon: 'none' });
      return;
    }

    const semester = SEMESTER_OPTIONS[semesterIndex];
    const student = students.length > 0 ? students[studentIndex] : null;
    const scheduleName = `${semester.label}课表`;

    setLoading(true);
    Taro.showLoading({ title: isEditMode ? "保存中" : "创建中", mask: true });
    try {
      if (isEditMode) {
        const updatePayload: Partial<Schedule> = {
          name: scheduleName,
          semester: semester.value,
          start_date: startDate,
          total_weeks: totalWeeks,
          periods: buildPeriods(),
          period_config: buildPeriodConfig(),
        };
        if (student?.id) {
          updatePayload.student_id = student.id;
        }
        await updateSchedule(editScheduleId, updatePayload);

        const nextSchedules = schedules.map((s) => {
          const sid = s.id || s._id;
          if (sid !== editScheduleId) return s;
          return {
            ...s,
            name: scheduleName,
            semester: semester.value,
            start_date: startDate,
            startDate,
            student_id: student?.id || s.student_id,
            total_weeks: totalWeeks,
            totalWeeks,
            periods: buildPeriods(),
            periodConfig: {
              morningCount,
              afternoonCount,
              eveningCount,
            },
            period_config: buildPeriodConfig(),
          };
        });
        setSchedules(nextSchedules);

        const currentId = currentSchedule?.id || currentSchedule?._id;
        if (currentSchedule && currentId === editScheduleId) {
          setCurrentSchedule({
            ...currentSchedule,
            name: scheduleName,
            semester: semester.value,
            start_date: startDate,
            startDate,
            student_id: student?.id || currentSchedule.student_id,
            total_weeks: totalWeeks,
            totalWeeks,
            periods: buildPeriods(),
            periodConfig: {
              morningCount,
              afternoonCount,
              eveningCount,
            },
            period_config: buildPeriodConfig(),
          });
        }

        Taro.showToast({ title: "保存成功", icon: "success" });
        setTimeout(() => {
          Taro.navigateBack();
        }, 300);
        return;
      }

      const raw = await createSchedule({
        student_id: student?.id,
        name: `${semester.label}课表`,
        semester: semester.value,
        totalWeeks,
        startDate,
        periods: buildPeriods(),
        periodConfig: {
          morningCount,
          afternoonCount,
          eveningCount,
        },
      });
      const r = raw as unknown as Record<string, unknown>;
      const schedule: Schedule = {
        id: (r._id || r.id || "") as string,
        student_id: (r.student_id || student?.id || "") as string,
        name: (r.name || `${semester.label}课表`) as string,
        semester: (r.semester || semester.value) as string,
        start_date: ((r.start_date || startDate) as string) || undefined,
        startDate: ((r.start_date || startDate) as string) || undefined,
        total_weeks: (r.total_weeks || totalWeeks) as number,
        totalWeeks: (r.total_weeks || totalWeeks) as number,
        invite_code: (r.invite_code || '') as string,
        inviteCode: (r.invite_code || '') as string,
        periods: buildPeriods(),
        periodConfig: {
          morningCount,
          afternoonCount,
          eveningCount,
        },
        period_config: buildPeriodConfig(),
        courses: [],
        viewMode: 'week',
        view_mode: 'week',
        is_default: (r.is_default ?? false) as boolean,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addSchedule(schedule);
      setCurrentSchedule(schedule);
      Taro.showToast({ title: "创建成功", icon: "success" });
      setTimeout(() => {
        setStep(2);
        setCurrentScheduleId(schedule.id);
      }, 500);
    } catch (err: any) {
      Taro.showToast({ title: err.message || (isEditMode ? "保存失败" : "创建失败"), icon: "none", duration: 3000 });
    } finally {
      Taro.hideLoading();
      setLoading(false);
    }
  };

  const renderSteps = () => (
    <View className="steps">
      <View className={`step ${step === 1 ? 'step--active' : 'step--done'}`}>
        <View className="step-dot">
          <Text>1</Text>
        </View>
        <View className="step-info">
          <Text className="step-text">创建课表</Text>
          <Text className="step-desc">学期与时间设置</Text>
        </View>
      </View>
      <View className={`step-connector${step === 2 ? ' step-connector--active' : ''}`} />
      <View className={`step ${step === 2 ? 'step--active' : 'step--inactive'}`}>
        <View className="step-dot">
          <Text>2</Text>
        </View>
        <View className="step-info">
          <Text className="step-text">添加课程</Text>
          <Text className="step-desc">录入课程信息</Text>
        </View>
      </View>
    </View>
  );

  const renderPeriodSection = (
    emoji: string,
    title: string,
    count: number,
    setCount: (fn: (v: number) => number) => void,
    min: number,
    max: number,
    periods: { index: number; startTime: string; endTime: string; label: string }[],
    showSectionTitle = false,
  ) => (
    <View className="form-card">
      {showSectionTitle && <Text className="form-section-title">设置时间</Text>}
      <View className="period-header">
        <View className="period-header-left">
          <Text className="period-icon">{emoji}</Text>
          <Text className="period-label">{title}</Text>
        </View>
        <View className="counter">
          <View
            className={`counter-btn${count <= min ? ' counter-btn--disabled' : ''}`}
            onClick={() => setCount(v => clamp(v - 1, min, max))}
          >
            <View className="counter-btn-icon counter-btn-icon--minus" />
          </View>
          <Text className="counter-val">{count}</Text>
          <View
            className={`counter-btn${count >= max ? ' counter-btn--disabled' : ''}`}
            onClick={() => setCount(v => clamp(v + 1, min, max))}
          >
            <View className="counter-btn-icon counter-btn-icon--plus" />
          </View>
        </View>
      </View>
      {periods.map(p => (
        <View key={p.index} className="period-row" onClick={() => openPeriodEditor(p)}>
          <Text className="period-name">{p.label}</Text>
          <View className="period-time-wrap">
            <Text className="period-time">{p.startTime}–{p.endTime}</Text>
            <View className="period-arrow-icon" />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View className="sf-page">
      {renderSteps()}

      {step === 1 && (
        <View className="sf-scroll-body">
          <View className="form-card">
            <Text className="form-section-title">选择学年</Text>
            <Picker mode="selector" range={SEMESTER_LABELS} value={semesterIndex} onChange={e => setSemesterIndex(Number(e.detail.value))}>
              <View className="form-row">
                <Text className="form-label">学期</Text>
                <View className="form-value-wrap">
                  <Text className="form-value form-value--filled">{SEMESTER_LABELS[semesterIndex]}</Text>
                  <View className="form-arrow-icon" />
                </View>
              </View>
            </Picker>
            <Text className="form-subtext">默认按当前日期推算学期</Text>
          </View>

          <View className="form-card">
            <Text className="form-section-title">日期与周数</Text>
            <Picker
              mode="date"
              value={startDate || formatDate(new Date(), 'YYYY-MM-DD')}
              onChange={e => setStartDate(e.detail.value as string)}
            >
              <View className="form-row">
                <Text className="form-label">
                  开学日期<Text className="form-label-required">*</Text>
                </Text>
                <View className="form-value-wrap">
                  <Text className={`form-value${startDate ? ' form-value--filled' : ''}`}>
                    {startDate || '用于计算当前周数'}
                  </Text>
                  <View className="form-arrow-icon" />
                </View>
              </View>
            </Picker>
            <Picker
              mode="selector"
              range={WEEK_LABELS}
              value={weekPickerIndex}
              onChange={e => {
                const idx = Number(e.detail.value)
                setWeekPickerIndex(idx)
                setTotalWeeks(WEEK_OPTIONS[idx])
              }}
              className="form-picker"
            >
              <View className="form-row">
                <Text className="form-label">本学期周数</Text>
                <View className="form-value-wrap">
                  <Text className="form-value form-value--filled">{totalWeeks}</Text>
                  <View className="form-arrow-icon" />
                </View>
              </View>
            </Picker>
          </View>

          <View className="form-card">
            <Text className="form-section-title">归属学生</Text>
            <View className="form-row" onClick={() => studentSheetRef.current?.open()}>
              <Text className="form-label">学生</Text>
              <View className="form-value-wrap">
                <Text className="form-value form-value--filled">{studentLabels[studentIndex] || '默认'}</Text>
                <View className="form-arrow-icon" />
              </View>
            </View>
          </View>

          {renderPeriodSection('☀️', '上午课节数', morningCount, setMorningCount, 1, 6, morningPeriods, true)}
          {renderPeriodSection('🌤', '下午课节数', afternoonCount, setAfternoonCount, 1, 6, afternoonPeriods)}
          {renderPeriodSection('🌙', '晚上课节数', eveningCount, setEveningCount, 0, 4, eveningPeriods)}

          <View className="bottom-spacer" />
        </View>
      )}

      {step === 1 && (
        <View className="footer">
          <Button className="save-btn" onClick={onSave} loading={loading}>
            {loading ? (isEditMode ? '保存中' : '创建中') : '保存'}
          </Button>
        </View>
      )}

      <StudentPickerSheet
        ref={studentSheetRef}
        students={students}
        selectedIndex={studentIndex}
        onSelect={setStudentIndex}
      />

      <PeriodEditorSheet ref={periodSheetRef} onConfirm={handlePeriodConfirm} />

      {step === 2 && (
        <EmptySchedule
          scheduleId={currentScheduleId ?? undefined}
          useRedirect
          onAddLater={() => Taro.navigateBack()}
        />
      )}
    </View>
  );
}
