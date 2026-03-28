import { useState, useMemo } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { tabState } from "../../utils/tabState";
import { useAuthStore } from "../../store/auth.store";
import { useScheduleStore } from "../../store/schedule.store";
import { ROUTES } from "../../constants/routes";
import noDataImg from "../../assets/noData.png";
import ziliaoIcon from "../../assets/ziliao.svg";
import "./index.scss";

interface Tool {
  name: string;
  icon?: string;
  imgIcon?: string;
  bgColor: string;
  iconColor?: string;
}

const toolList: Tool[] = [
  {
    name: "视力测试",
    icon: "\ue603",
    bgColor: "#FFF3E0",
    iconColor: "#FF9800",
  },
  {
    name: "学生赛事",
    icon: "\ue602",
    bgColor: "#E3F2FD",
    iconColor: "#2196F3",
  },
  { name: "学平险", icon: "\ue601", bgColor: "#F3E5F5", iconColor: "#9C27B0" },
  { name: "练习资料", imgIcon: ziliaoIcon, bgColor: "#FFEBEE" },
];

export default function ToolsPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userInfo = useAuthStore((s) => s.userInfo);
  const schedules = useScheduleStore((s) => s.schedules);
  const currentSchedule = useScheduleStore((s) => s.currentSchedule);
  const setCurrentSchedule = useScheduleStore((s) => s.setCurrentSchedule);

  const [showDrawer, setShowDrawer] = useState(false);

  useDidShow(() => {
    tabState.setSelected(1);
  });

  const windowInfo = Taro.getWindowInfo();
  const menuButtonInfo = Taro.getMenuButtonBoundingClientRect();

  const statusBarHeight = windowInfo.statusBarHeight || 0;
  const navBarHeight = (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height;

  const goLogin = () => {
    Taro.navigateTo({ url: ROUTES.LOGIN });
  };

  // 按学生分组课表
  const groupedSchedules = useMemo(() => {
    const map = new Map<string, { studentName: string; school: string; grade: string; items: typeof schedules }>();
    for (const s of schedules) {
      const key = s.studentId || "default";
      if (!map.has(key)) {
        // 此处用课表 name 做学生名称的 fallback
        map.set(key, { studentName: s.name || "默认", school: "", grade: "", items: [] });
      }
      map.get(key)!.items.push(s);
    }
    return Array.from(map.values());
  }, [schedules]);

  // 打开抽屉
  const openDrawer = () => {
    if (!isLoggedIn) {
      goLogin();
      return;
    }
    setShowDrawer(true);
  };

  // 关闭抽屉
  const closeDrawer = () => {
    setShowDrawer(false);
  };

  // 选择课表
  const handleSelectSchedule = (schedule: (typeof schedules)[0]) => {
    setCurrentSchedule(schedule);
    closeDrawer();
  };

  // 跳转管理课表
  const goManageSchedule = () => {
    closeDrawer();
    Taro.switchTab({ url: ROUTES.SCHEDULE });
  };

  return (
    <View className="page-container">
      {/* 自定义导航栏背景 */}
      <View className="custom-nav-bg" />

      {/* 自定义导航栏内容 */}
      <View
        className="custom-nav-bar"
        style={{
          paddingTop: `${menuButtonInfo.top}px`,
          paddingRight: `${windowInfo.windowWidth - menuButtonInfo.left}px`,
        }}
      >
        <View className="nav-title-wrap">
          {!isLoggedIn ? (
            <View className="user-info" onClick={goLogin}>
              <View className="user-text">
                <Text className="name">登录注册</Text>
                <Text className="school">等你来用～</Text>
              </View>
            </View>
          ) : (
            <View className="user-info" onClick={openDrawer}>
              <View className="avatar">{userInfo?.nickname?.[0] || "我"}</View>
              <View className="user-text">
                <View className="name-row">
                  <Text className="name">{userInfo?.nickname || "我的课表"}</Text>
                  <Text className="swap-icon">⇌</Text>
                </View>
                <Text className="school">东东东东风东路小学</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={{ flexShrink: 0, height: `${statusBarHeight + navBarHeight}px` }} />
      <View className="content">
        <View className="section-title">百宝箱</View>
        <View className="tools-grid">
          {toolList.map((item) => (
            <View key={item.name} className="tool-card">
              <View
                className="tool-icon-wrap"
                // style={{ background: item.bgColor }}
              >
                {item.imgIcon ? (
                  <Image className="tool-img-icon" src={item.imgIcon} mode="aspectFit" />
                ) : (
                  <Text className="iconfont tool-icon" style={{ color: item.iconColor }}>
                    {item.icon}
                  </Text>
                )}
              </View>
              <Text className="tool-name">{item.name}</Text>
            </View>
          ))}
        </View>

        <View className="section-header">
          <Text className="section-title">大家在看</Text>
          <Text className="section-more">栏目介绍 {">"}</Text>
        </View>

        <View className="empty-state">
          <Image className="empty-img" src={noDataImg} mode="aspectFit" />
          <Text className="empty-text">暂无内容</Text>
        </View>
      </View>

      {/* 切换课表侧边抽屉 */}
      {showDrawer && (
        <View className="drawer-mask" onClick={closeDrawer}>
          <View className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            {/* 标题区域 */}
            <View className="drawer-header">
              <View className="drawer-title-wrap">
                <Text className="drawer-title">切换课表</Text>
              </View>
              {/* <View className="drawer-close" onClick={closeDrawer}> */}
              {/* <Text className="drawer-close-icon">←</Text> */}
              {/* </View> */}
            </View>

            {/* 课表列表区域 */}
            <View className="drawer-body">
              {schedules.length === 0 ? (
                <View className="drawer-empty">
                  <Image className="drawer-empty-img" src={noDataImg} mode="aspectFit" />
                  <Text className="drawer-empty-text">暂无数据</Text>
                </View>
              ) : (
                <View className="drawer-list">
                  {groupedSchedules.map((group, gIdx) => (
                    <View key={gIdx} className="drawer-group">
                      {/* 学生信息头 */}
                      <View className="drawer-group-header">
                        <Text className="drawer-student-name">{group.studentName}</Text>
                        {(group.school || group.grade) && (
                          <Text className="drawer-student-info">
                            {" | "}
                            {group.school}
                            {group.grade ? `，${group.grade}` : ""}
                          </Text>
                        )}
                      </View>
                      {/* 该学生下的课表列表 */}
                      {group.items.map((schedule) => {
                        const isActive = currentSchedule?.id === schedule.id;
                        return (
                          <View
                            key={schedule.id}
                            className={`drawer-schedule-item ${isActive ? "drawer-schedule-item--active" : ""}`}
                            onClick={() => handleSelectSchedule(schedule)}
                          >
                            <Text className={`drawer-schedule-name ${isActive ? "drawer-schedule-name--active" : ""}`}>{schedule.semester || schedule.name}</Text>
                            {isActive && <Text className="drawer-check-icon">✓</Text>}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 底部管理课表按钮 - 固定在底部 */}
            <View className="drawer-footer">
              <View className="drawer-manage-btn" onClick={goManageSchedule}>
                <Text className="drawer-manage-icon">⚙</Text>
                <Text className="drawer-manage-text">管理课表</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
